import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";

export const ensureClient = internalMutation({
  args: { instagramId: v.string(), token: v.string() },
  handler: async (ctx, { instagramId }) => {
    const e = await ctx.db.query("clients").withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId)).first();
    if (e) return e._id;
    return await ctx.db.insert("clients", { instagramId, firstSeen: Date.now() });
  },
});

export const addLog = internalMutation({
  args: { automationId: v.optional(v.id("automations")), triggerId: v.optional(v.id("triggers")), clientInstagramId: v.string(), eventType: v.string(), message: v.string() },
  handler: async (ctx, args) => { await ctx.db.insert("logs", { ...args, timestamp: Date.now() }); },
});

const integrationArgs = { accessToken: v.string(), pageAccessToken: v.string(), pageId: v.string(), instagramId: v.string(), igBusinessId: v.optional(v.string()), pageName: v.optional(v.string()), expiresAt: v.optional(v.number()) };

async function doSaveIntegration(ctx: any, args: any) {
  // Upsert: check instagramId first, then igBusinessId (handles IG Login → FB Login reconnect)
  let existing = await ctx.db.query("integrations").withIndex("by_ig_id", (q: any) => q.eq("instagramId", args.instagramId)).first();
  if (!existing && args.igBusinessId) {
    existing = await ctx.db.query("integrations").withIndex("by_igba", (q: any) => q.eq("igBusinessId", args.igBusinessId)).first();
  }
  if (existing) {
    await ctx.db.patch(existing._id, { ...args, connectedAt: Date.now() });
    return existing._id;
  }
  return await ctx.db.insert("integrations", { ...args, connectedAt: Date.now() });
}

export const internalSaveIntegration = internalMutation({ args: integrationArgs, handler: async (ctx, args) => doSaveIntegration(ctx, args) });
export const saveIntegration = mutation({ args: integrationArgs, handler: async (ctx, args) => doSaveIntegration(ctx, args) });

const buttonValidator = v.optional(v.array(v.object({ text: v.string(), url: v.string() })));
const actionSchema = v.object({
  type: v.union(v.literal("send_dm"), v.literal("reply_comment"), v.literal("both")),
  message: v.string(), delaySeconds: v.number(), buttons: buttonValidator,
  replyKeyword: v.optional(v.string()), quickReplies: v.optional(v.array(v.string())), commentReplies: v.optional(v.array(v.string())),
});

export const createAutomation = mutation({
  args: {
    name: v.string(),
    integrationId: v.id("integrations"),
    trigger: v.object({
      type: v.union(v.literal("dm"), v.literal("comment")),
      matchType: v.union(v.literal("contains"), v.literal("exact"), v.literal("starts_with"), v.literal("any")),
      keywords: v.array(v.string()), postFilter: v.union(v.literal("all"), v.literal("selected")), selectedPostIds: v.array(v.string()),
    }),
    actions: v.array(actionSchema),
  },
  handler: async (ctx, { name, integrationId, trigger, actions }) => {
    const aid = await ctx.db.insert("automations", { name, isActive: true, createdAt: Date.now(), integrationId });
    await ctx.db.insert("triggers", { automationId: aid, ...trigger });
    for (let i = 0; i < actions.length; i++) { await ctx.db.insert("actions", { automationId: aid, step: i, ...actions[i] }); }
    return aid;
  },
});

export const editAutomation = mutation({
  args: {
    id: v.id("automations"), name: v.string(),
    trigger: v.object({
      type: v.union(v.literal("dm"), v.literal("comment")),
      matchType: v.union(v.literal("contains"), v.literal("exact"), v.literal("starts_with"), v.literal("any")),
      keywords: v.array(v.string()), postFilter: v.union(v.literal("all"), v.literal("selected")), selectedPostIds: v.array(v.string()),
    }),
    actions: v.array(actionSchema),
  },
  handler: async (ctx, { id, name, trigger, actions }) => {
    await ctx.db.patch(id, { name });
    for (const t of await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(t._id);
    for (const a of await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(a._id);
    await ctx.db.insert("triggers", { automationId: id, ...trigger });
    for (let i = 0; i < actions.length; i++) { await ctx.db.insert("actions", { automationId: id, step: i, ...actions[i] }); }
  },
});

export const toggleAutomation = mutation({ args: { id: v.id("automations") }, handler: async (ctx, { id }) => { const a = await ctx.db.get(id); if (a) await ctx.db.patch(id, { isActive: !a.isActive }); } });

export const deleteAutomation = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, { id }) => {
    for (const t of await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(t._id);
    for (const a of await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(a._id);
    await ctx.db.delete(id);
  },
});

export const removeIntegration = mutation({
  args: { id: v.id("integrations") },
  handler: async (ctx, { id }) => {
    // Delete all automations for this integration
    const autos = await ctx.db.query("automations").withIndex("by_integration", (q) => q.eq("integrationId", id)).collect();
    for (const a of autos) {
      for (const t of await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect()) await ctx.db.delete(t._id);
      for (const ac of await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect()) await ctx.db.delete(ac._id);
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(id);
  },
});

export const deleteUserData = internalMutation({
  args: { instagramId: v.string() },
  handler: async (ctx, { instagramId }) => {
    const integ = await ctx.db.query("integrations").withIndex("by_ig_id", (q) => q.eq("instagramId", instagramId)).first();
    if (integ) {
      const autos = await ctx.db.query("automations").withIndex("by_integration", (q) => q.eq("integrationId", integ._id)).collect();
      for (const a of autos) {
        for (const t of await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect()) await ctx.db.delete(t._id);
        for (const ac of await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect()) await ctx.db.delete(ac._id);
        await ctx.db.delete(a._id);
      }
      await ctx.db.delete(integ._id);
    }
    const client = await ctx.db.query("clients").withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId)).first();
    if (client) await ctx.db.delete(client._id);
    const followups = await ctx.db.query("pendingFollowups").withIndex("by_client", (q) => q.eq("clientInstagramId", instagramId)).collect();
    for (const f of followups) await ctx.db.delete(f._id);
    const logs = await ctx.db.query("logs").withIndex("by_client", (q) => q.eq("clientInstagramId", instagramId)).collect();
    for (const l of logs) await ctx.db.delete(l._id);
  },
});

export const deauthorizeUser = internalMutation({
  args: { instagramId: v.string() },
  handler: async (ctx, { instagramId }) => {
    const integ = await ctx.db.query("integrations").withIndex("by_ig_id", (q) => q.eq("instagramId", instagramId)).first();
    if (!integ) return;
    const autos = await ctx.db.query("automations").withIndex("by_integration", (q) => q.eq("integrationId", integ._id)).collect();
    for (const a of autos) {
      for (const t of await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect()) await ctx.db.delete(t._id);
      for (const ac of await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect()) await ctx.db.delete(ac._id);
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(integ._id);
  },
});

export const createPendingFollowup = internalMutation({
  args: { clientInstagramId: v.string(), automationId: v.id("automations"), replyKeyword: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("pendingFollowups").withIndex("by_client", (q) => q.eq("clientInstagramId", args.clientInstagramId)).collect();
    for (const e of existing) { if (e.automationId === args.automationId) await ctx.db.delete(e._id); }
    await ctx.db.insert("pendingFollowups", { ...args, createdAt: Date.now(), expiresAt: Date.now() + 7*24*60*60*1000 });
  },
});

export const consumePendingFollowup = internalMutation({
  args: { clientInstagramId: v.string(), text: v.string() },
  handler: async (ctx, { clientInstagramId, text }) => {
    const ps = await ctx.db.query("pendingFollowups").withIndex("by_client", (q) => q.eq("clientInstagramId", clientInstagramId)).collect();
    const now = Date.now(); const lt = text.toLowerCase().trim();
    for (const p of ps) {
      if (p.expiresAt < now) { await ctx.db.delete(p._id); continue; }
      if (lt.includes(p.replyKeyword.toLowerCase().trim())) { await ctx.db.delete(p._id); return p.automationId; }
    }
    return null;
  },
});
