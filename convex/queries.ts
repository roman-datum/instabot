import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

export const getIntegrationByInstagramId = internalQuery({
  args: { instagramId: v.string() },
  handler: async (ctx, { instagramId }) => {
    // Try app-scoped ID first, then IGBA ID, then Page ID (FB Login webhook entry.id may be pageId)
    const byAppId = await ctx.db.query("integrations").withIndex("by_ig_id", (q) => q.eq("instagramId", instagramId)).first();
    if (byAppId) return byAppId;
    const byIgba = await ctx.db.query("integrations").withIndex("by_igba", (q) => q.eq("igBusinessId", instagramId)).first();
    if (byIgba) return byIgba;
    return await ctx.db.query("integrations").withIndex("by_page_id", (q) => q.eq("pageId", instagramId)).first();
  },
});

export const getAllIntegrations = internalQuery({ args: {}, handler: async (ctx) => await ctx.db.query("integrations").collect() });

export const findMatchingTriggersForIntegration = internalQuery({
  args: { integrationId: v.id("integrations"), type: v.union(v.literal("dm"), v.literal("comment")), text: v.string(), mediaId: v.string() },
  handler: async (ctx, { integrationId, type, text, mediaId }) => {
    const autos = await ctx.db.query("automations").withIndex("by_integration", (q) => q.eq("integrationId", integrationId)).collect();
    const activeIds = autos.filter(a => a.isActive).map(a => a._id);
    const legacy = await ctx.db.query("automations").collect();
    for (const la of legacy) { if (la.isActive && !la.integrationId && !activeIds.includes(la._id)) activeIds.push(la._id); }

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

export const checkRecentLog = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const recent = await ctx.db.query("logs").withIndex("by_time").order("desc").take(50);
    const cutoff = Date.now() - 30000;
    return recent.some(l => l.timestamp > cutoff && l.message.includes(`[dedup:${key}]`));
  },
});

export const listIntegrations = query({ args: {}, handler: async (ctx) => await ctx.db.query("integrations").collect() });
export const getIntegration = query({ args: {}, handler: async (ctx) => { const all = await ctx.db.query("integrations").collect(); return all[0] ?? null; }});

export const getWorkspaceByPassword = query({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    const ws = await ctx.db.query("workspaces").withIndex("by_password", (q) => q.eq("password", password)).first();
    if (!ws) return null;
    return { _id: ws._id, name: ws.name, maxAccounts: ws.maxAccounts };
  },
});

export const listIntegrationsByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => await ctx.db.query("integrations").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
});

export const countIntegrationsByWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const all = await ctx.db.query("integrations").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect();
    return all.length;
  },
});

export const listAutomationsByIntegration = query({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, { integrationId }) => {
    const autos = await ctx.db.query("automations").withIndex("by_integration", (q) => q.eq("integrationId", integrationId)).collect();
    const result = [];
    for (const a of autos) {
      const triggers = await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect();
      const actions = await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect();
      result.push({ ...a, triggers, actions });
    }
    return result;
  },
});

export const listAutomations = query({ args: {}, handler: async (ctx) => {
  const autos = await ctx.db.query("automations").collect();
  const result = [];
  for (const a of autos) {
    const triggers = await ctx.db.query("triggers").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect();
    const actions = await ctx.db.query("actions").withIndex("by_automation", (q) => q.eq("automationId", a._id)).collect();
    result.push({ ...a, triggers, actions });
  }
  return result;
}});

export const listLogs = query({ args: { limit: v.optional(v.number()) }, handler: async (ctx, { limit }) => await ctx.db.query("logs").withIndex("by_time").order("desc").take(limit ?? 50) });
export const listClients = query({ args: {}, handler: async (ctx) => await ctx.db.query("clients").collect() });

export const getFbAuthSession = internalQuery({
  args: { sessionId: v.id("fbAuthSessions") },
  handler: async (ctx, { sessionId }) => await ctx.db.get(sessionId),
});

export const getFbAuthSessionPublic = query({
  args: { sessionId: v.id("fbAuthSessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.expiresAt < Date.now()) return null;
    // Return only safe fields (no tokens)
    return { _id: s._id, pages: s.pages.map(p => ({ igId: p.igId, igUsername: p.igUsername, pageName: p.pageName })) };
  },
});
