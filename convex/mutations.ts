import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";

// --- Internal mutations ---

export const ensureClient = internalMutation({
  args: { instagramId: v.string(), token: v.string() },
  handler: async (ctx, { instagramId }) => {
    const existing = await ctx.db
      .query("clients")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("clients", { instagramId, firstSeen: Date.now() });
  },
});

export const addLog = internalMutation({
  args: {
    automationId: v.optional(v.id("automations")),
    triggerId: v.optional(v.id("triggers")),
    clientInstagramId: v.string(),
    eventType: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", { ...args, timestamp: Date.now() });
  },
});

// --- Public mutations ---

export const saveIntegration = mutation({
  args: {
    accessToken: v.string(),
    pageAccessToken: v.string(),
    pageId: v.string(),
    instagramId: v.string(),
    pageName: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const old = await ctx.db.query("integrations").collect();
    for (const o of old) await ctx.db.delete(o._id);
    return await ctx.db.insert("integrations", { ...args, connectedAt: Date.now() });
  },
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
    action: v.object({
      type: v.union(v.literal("send_dm"), v.literal("reply_comment"), v.literal("both")),
      message: v.string(),
      delaySeconds: v.number(),
    }),
  },
  handler: async (ctx, { name, trigger, action }) => {
    const automationId = await ctx.db.insert("automations", { name, isActive: true, createdAt: Date.now() });
    await ctx.db.insert("triggers", { automationId, ...trigger });
    await ctx.db.insert("actions", { automationId, ...action });
    return automationId;
  },
});

export const toggleAutomation = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, { id }) => {
    const auto = await ctx.db.get(id);
    if (!auto) return;
    await ctx.db.patch(id, { isActive: !auto.isActive });
  },
});

export const deleteAutomation = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, { id }) => {
    const triggers = await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", id)).collect();
    for (const t of triggers) await ctx.db.delete(t._id);
    const actions = await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", id)).collect();
    for (const a of actions) await ctx.db.delete(a._id);
    await ctx.db.delete(id);
  },
});

export const removeIntegration = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("integrations").collect();
    for (const i of all) await ctx.db.delete(i._id);
  },
});
