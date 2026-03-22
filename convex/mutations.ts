import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";

export const ensureClient = internalMutation({
  args: { instagramId: v.string(), token: v.string() },
  handler: async (ctx, { instagramId }) => {
    const existing = await ctx.db.query("clients").withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId)).first();
    if (existing) return existing._id;
    return await ctx.db.insert("clients", { instagramId, firstSeen: Date.now() });
  },
});

export const addLog = internalMutation({
  args: { automationId: v.optional(v.id("automations")), triggerId: v.optional(v.id("triggers")), clientInstagramId: v.string(), eventType: v.string(), message: v.string() },
  handler: async (ctx, args) => { await ctx.db.insert("logs", { ...args, timestamp: Date.now() }); },
});

const integrationArgs = {
  accessToken: v.string(), pageAccessToken: v.string(), pageId: v.string(),
  instagramId: v.string(), pageName: v.optional(v.string()), expiresAt: v.optional(v.number()),
};

async function doSaveIntegration(ctx: any, args: any) {
  const old = await ctx.db.query("integrations").collect();
  for (const o of old) await ctx.db.delete(o._id);
  return await ctx.db.insert("integrations", { ...args, connectedAt: Date.now() });
}

// Internal version (for auth.ts)
export const internalSaveIntegration = internalMutation({
  args: integrationArgs,
  handler: async (ctx, args) => doSaveIntegration(ctx, args),
});

// Public version (for frontend manual input if needed)
export const saveIntegration = mutation({
  args: integrationArgs,
  handler: async (ctx, args) => doSaveIntegration(ctx, args),
});

const buttonValidator = v.optional(v.array(v.object({ text: v.string(), url: v.string() })));
const actionSchema = v.object({
  type: v.union(v.literal("send_dm"), v.literal("reply_comment"), v.literal("both")),
  message: v.string(), delaySeconds: v.number(), buttons: buttonValidator, replyKeyword: v.optional(v.string()),
});

export const createAutomation = mutation({
  args: {
    name: v.string(),
    trigger: v.object({
      type: v.union(v.literal("dm"), v.literal("comment")),
      matchType: v.union(v.literal("contains"), v.literal("exact"), v.literal("starts_with"), v.literal("any")),
      keywords: v.array(v.string()),
      postFilter: v.union(v.literal("all"), v.literal("selected")),
      selectedPostIds: v.array(v.string()),
    }),
    actions: v.array(actionSchema),
  },
  handler: async (ctx, { name, trigger, actions }) => {
    const automationId = await ctx.db.insert("automations", { name, isActive: true, createdAt: Date.now() });
    await ctx.db.insert("triggers", { automationId, ...trigger });
    for (let i = 0; i < actions.length; i++) { await ctx.db.insert("actions", { automationId, step: i, ...actions[i] }); }
    return automationId;
  },
});

// Edit automation: replace trigger + actions
export const editAutomation = mutation({
  args: {
    id: v.id("automations"),
    name: v.string(),
    trigger: v.object({
      type: v.union(v.literal("dm"), v.literal("comment")),
      matchType: v.union(v.literal("contains"), v.literal("exact"), v.literal("starts_with"), v.literal("any")),
      keywords: v.array(v.string()),
      postFilter: v.union(v.literal("all"), v.literal("selected")),
      selectedPostIds: v.array(v.string()),
    }),
    actions: v.array(actionSchema),
  },
  handler: async (ctx, { id, name, trigger, actions }) => {
    await ctx.db.patch(id, { name });
    // Delete old triggers + actions
    for (const t of await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(t._id);
    for (const a of await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(a._id);
    // Insert new
    await ctx.db.insert("triggers", { automationId: id, ...trigger });
    for (let i = 0; i < actions.length; i++) { await ctx.db.insert("actions", { automationId: id, step: i, ...actions[i] }); }
  },
});

export const toggleAutomation = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, { id }) => { const a = await ctx.db.get(id); if (a) await ctx.db.patch(id, { isActive: !a.isActive }); },
});

export const deleteAutomation = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, { id }) => {
    for (const t of await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(t._id);
    for (const a of await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", id)).collect()) await ctx.db.delete(a._id);
    await ctx.db.delete(id);
  },
});

export const removeIntegration = mutation({ args: {}, handler: async (ctx) => { for (const i of await ctx.db.query("integrations").collect()) await ctx.db.delete(i._id); } });

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
    const pendings = await ctx.db.query("pendingFollowups").withIndex("by_client", (q) => q.eq("clientInstagramId", clientInstagramId)).collect();
    const now = Date.now(); const lt = text.toLowerCase().trim();
    for (const p of pendings) {
      if (p.expiresAt < now) { await ctx.db.delete(p._id); continue; }
      if (lt.includes(p.replyKeyword.toLowerCase().trim())) { await ctx.db.delete(p._id); return p.automationId; }
    }
    return null;
  },
});
