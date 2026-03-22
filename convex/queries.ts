import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

// --- Internal ---

export const getIntegrationByInstagramId = internalQuery({
  args: { instagramId: v.string() },
  handler: async (ctx, { instagramId }) => {
    return await ctx.db.query("integrations").withIndex("by_ig_id", (q) => q.eq("instagramId", instagramId)).first();
  },
});

export const getAllIntegrations = internalQuery({ args: {}, handler: async (ctx) => await ctx.db.query("integrations").collect() });

// Find triggers for a specific integration
export const findMatchingTriggersForIntegration = internalQuery({
  args: { integrationId: v.id("integrations"), type: v.union(v.literal("dm"), v.literal("comment")), text: v.string(), mediaId: v.string() },
  handler: async (ctx, { integrationId, type, text, mediaId }) => {
    const autos = await ctx.db.query("automations").withIndex("by_integration", (q) => q.eq("integrationId", integrationId)).collect();
    const activeIds = autos.filter(a => a.isActive).map(a => a._id);
    // Also include automations without integrationId (legacy)
    const legacyAutos = await ctx.db.query("automations").collect();
    for (const la of legacyAutos) { if (la.isActive && !la.integrationId && !activeIds.includes(la._id)) activeIds.push(la._id); }

    const allTriggers = await ctx.db.query("triggers").collect();
    const triggers = allTriggers.filter(t => activeIds.includes(t.automationId) && t.type === type);
    const matched: typeof triggers = [];
    const lt = text.toLowerCase();
    for (const trigger of triggers) {
      if (type === "comment" && trigger.postFilter === "selected" && !trigger.selectedPostIds.includes(mediaId)) continue;
      if (trigger.matchType === "any") { matched.push(trigger); continue; }
      const kws = trigger.keywords.map(k => k.toLowerCase());
      if (trigger.matchType === "contains" && kws.some(kw => lt.includes(kw))) matched.push(trigger);
      else if (trigger.matchType === "exact" && kws.some(kw => lt === kw)) matched.push(trigger);
      else if (trigger.matchType === "starts_with" && kws.some(kw => lt.startsWith(kw))) matched.push(trigger);
    }
    return matched;
  },
});

export const getActionsByAutomation = internalQuery({
  args: { automationId: v.id("automations") },
  handler: async (ctx, { automationId }) => await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", automationId)).collect(),
});

// --- Public ---

export const listIntegrations = query({ args: {}, handler: async (ctx) => await ctx.db.query("integrations").collect() });

export const getIntegration = query({ args: {}, handler: async (ctx) => {
  const all = await ctx.db.query("integrations").collect();
  return all[0] ?? null;
}});

export const listAutomationsByIntegration = query({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, { integrationId }) => {
    const autos = await ctx.db.query("automations").withIndex("by_integration", (q) => q.eq("integrationId", integrationId)).collect();
    const result = [];
    for (const auto of autos) {
      const triggers = await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", auto._id)).collect();
      const actions = await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", auto._id)).collect();
      result.push({ ...auto, triggers, actions });
    }
    return result;
  },
});

// Legacy: list all (for backward compat)
export const listAutomations = query({ args: {}, handler: async (ctx) => {
  const autos = await ctx.db.query("automations").collect();
  const result = [];
  for (const auto of autos) {
    const triggers = await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", auto._id)).collect();
    const actions = await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", auto._id)).collect();
    result.push({ ...auto, triggers, actions });
  }
  return result;
}});

export const listLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => await ctx.db.query("logs").withIndex("by_time").order("desc").take(limit ?? 50),
});

export const listClients = query({ args: {}, handler: async (ctx) => await ctx.db.query("clients").collect() });
