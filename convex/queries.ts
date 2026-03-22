import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

// --- Internal queries (used by engine) ---

export const getIntegrationByInstagramId = internalQuery({
  args: { instagramId: v.string() },
  handler: async (ctx, { instagramId }) => {
    const all = await ctx.db.query("integrations").collect();
    return all.find((i) => i.instagramId === instagramId) ?? null;
  },
});

export const getAllIntegrations = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("integrations").collect();
  },
});

export const findMatchingTriggers = internalQuery({
  args: {
    type: v.union(v.literal("dm"), v.literal("comment")),
    text: v.string(),
    mediaId: v.string(),
  },
  handler: async (ctx, { type, text, mediaId }) => {
    const automations = await ctx.db.query("automations").collect();
    const activeIds = automations.filter((a) => a.isActive).map((a) => a._id);

    const allTriggers = await ctx.db.query("triggers").collect();
    const triggers = allTriggers.filter(
      (t) => activeIds.includes(t.automationId) && t.type === type
    );

    const matched: typeof triggers = [];
    const lowerText = text.toLowerCase();

    for (const trigger of triggers) {
      // Post filter for comments
      if (type === "comment" && trigger.postFilter === "selected") {
        if (!trigger.selectedPostIds.includes(mediaId)) continue;
      }

      if (trigger.matchType === "any") {
        matched.push(trigger);
        continue;
      }

      const keywords = trigger.keywords.map((k) => k.toLowerCase());

      if (trigger.matchType === "contains") {
        if (keywords.some((kw) => lowerText.includes(kw))) {
          matched.push(trigger);
        }
      } else if (trigger.matchType === "exact") {
        if (keywords.some((kw) => lowerText === kw)) {
          matched.push(trigger);
        }
      } else if (trigger.matchType === "starts_with") {
        if (keywords.some((kw) => lowerText.startsWith(kw))) {
          matched.push(trigger);
        }
      }
    }

    return matched;
  },
});

export const getActionsByAutomation = internalQuery({
  args: { automationId: v.id("automations") },
  handler: async (ctx, { automationId }) => {
    return await ctx.db
      .query("actions")
      .withIndex("by_automation", (q) => q.eq("automationId", automationId))
      .collect();
  },
});

// --- Public queries (used by frontend) ---

export const listAutomations = query({
  args: {},
  handler: async (ctx) => {
    const automations = await ctx.db.query("automations").collect();
    const result = [];

    for (const auto of automations) {
      const triggers = await ctx.db
        .query("triggers")
        .withIndex("by_automation", (q) => q.eq("automationId", auto._id))
        .collect();
      const actions = await ctx.db
        .query("actions")
        .withIndex("by_automation", (q) => q.eq("automationId", auto._id))
        .collect();
      result.push({ ...auto, triggers, actions });
    }

    return result;
  },
});

export const getIntegration = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("integrations").collect();
    return all[0] ?? null;
  },
});

export const listLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_time")
      .order("desc")
      .take(limit ?? 50);
    return logs;
  },
});

export const listClients = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clients").collect();
  },
});
