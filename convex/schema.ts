import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Facebook/Instagram integration credentials
  integrations: defineTable({
    accessToken: v.string(),
    pageAccessToken: v.string(),
    pageId: v.string(),
    instagramId: v.string(),
    pageName: v.optional(v.string()),
    connectedAt: v.number(),
  }),

  // Automation (group of triggers + actions)
  automations: defineTable({
    name: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }),

  // Trigger: what starts the automation
  triggers: defineTable({
    automationId: v.id("automations"),
    type: v.union(v.literal("dm"), v.literal("comment")),
    matchType: v.union(
      v.literal("contains"),
      v.literal("exact"),
      v.literal("starts_with"),
      v.literal("any")
    ),
    keywords: v.array(v.string()),
    // For comment triggers: which posts to watch
    postFilter: v.union(v.literal("all"), v.literal("selected")),
    selectedPostIds: v.array(v.string()),
  }).index("by_automation", ["automationId"]),

  // Action: what to do when trigger fires
  actions: defineTable({
    automationId: v.id("automations"),
    type: v.union(v.literal("send_dm"), v.literal("reply_comment"), v.literal("both")),
    message: v.string(),
    delaySeconds: v.number(), // 0 = instant
  }).index("by_automation", ["automationId"]),

  // Client cache (Instagram users who interacted)
  clients: defineTable({
    instagramId: v.string(),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    profilePic: v.optional(v.string()),
    firstSeen: v.number(),
  }).index("by_instagram_id", ["instagramId"]),

  // Execution logs
  logs: defineTable({
    automationId: v.optional(v.id("automations")),
    triggerId: v.optional(v.id("triggers")),
    clientInstagramId: v.string(),
    eventType: v.string(), // "dm_received", "comment_received", "dm_sent", "comment_replied", "error"
    message: v.string(),
    timestamp: v.number(),
  }).index("by_time", ["timestamp"]),
});
