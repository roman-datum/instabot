import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  integrations: defineTable({
    accessToken: v.string(), pageAccessToken: v.string(), pageId: v.string(),
    instagramId: v.string(), pageName: v.optional(v.string()),
    connectedAt: v.number(), expiresAt: v.optional(v.number()),
  }),
  automations: defineTable({ name: v.string(), isActive: v.boolean(), createdAt: v.number() }),
  triggers: defineTable({
    automationId: v.id("automations"),
    type: v.union(v.literal("dm"), v.literal("comment")),
    matchType: v.union(v.literal("contains"), v.literal("exact"), v.literal("starts_with"), v.literal("any")),
    keywords: v.array(v.string()),
    postFilter: v.union(v.literal("all"), v.literal("selected")),
    selectedPostIds: v.array(v.string()),
  }).index("by_automation", ["automationId"]),
  actions: defineTable({
    automationId: v.id("automations"),
    step: v.optional(v.number()),
    type: v.union(v.literal("send_dm"), v.literal("reply_comment"), v.literal("both")),
    message: v.string(),
    delaySeconds: v.number(),
    buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))),
    replyKeyword: v.optional(v.string()),
    // Quick reply buttons (no URL, user taps -> sends text as DM reply)
    quickReplies: v.optional(v.array(v.string())),
    // Multiple comment reply variants (random pick)
    commentReplies: v.optional(v.array(v.string())),
  }).index("by_automation", ["automationId"]),
  pendingFollowups: defineTable({
    clientInstagramId: v.string(), automationId: v.id("automations"),
    replyKeyword: v.string(), createdAt: v.number(), expiresAt: v.number(),
  }).index("by_client", ["clientInstagramId"]).index("by_expires", ["expiresAt"]),
  clients: defineTable({
    instagramId: v.string(), name: v.optional(v.string()),
    username: v.optional(v.string()), profilePic: v.optional(v.string()), firstSeen: v.number(),
  }).index("by_instagram_id", ["instagramId"]),
  logs: defineTable({
    automationId: v.optional(v.id("automations")), triggerId: v.optional(v.id("triggers")),
    clientInstagramId: v.string(), eventType: v.string(), message: v.string(), timestamp: v.number(),
  }).index("by_time", ["timestamp"]),
});
