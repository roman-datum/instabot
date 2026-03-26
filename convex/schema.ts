import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    password: v.string(),
    maxAccounts: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_password", ["password"]),

  integrations: defineTable({
    accessToken: v.string(), pageAccessToken: v.string(), pageId: v.string(),
    instagramId: v.string(), igBusinessId: v.optional(v.string()), pageName: v.optional(v.string()),
    connectedAt: v.number(), expiresAt: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  }).index("by_ig_id", ["instagramId"]).index("by_igba", ["igBusinessId"]).index("by_page_id", ["pageId"]).index("by_workspace", ["workspaceId"]),

  automations: defineTable({
    name: v.string(), isActive: v.boolean(), createdAt: v.number(),
    integrationId: v.optional(v.id("integrations")), // which IG account
  }).index("by_integration", ["integrationId"]),

  triggers: defineTable({
    automationId: v.id("automations"),
    type: v.union(v.literal("dm"), v.literal("comment")),
    matchType: v.union(v.literal("contains"), v.literal("exact"), v.literal("starts_with"), v.literal("any")),
    keywords: v.array(v.string()),
    postFilter: v.union(v.literal("all"), v.literal("selected")),
    selectedPostIds: v.array(v.string()),
  }).index("by_automation", ["automationId"]),

  actions: defineTable({
    automationId: v.id("automations"), step: v.optional(v.number()),
    type: v.union(v.literal("send_dm"), v.literal("reply_comment"), v.literal("both")),
    message: v.string(), delaySeconds: v.number(),
    buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    carousel: v.optional(v.array(v.object({ title: v.string(), subtitle: v.optional(v.string()), imageUrl: v.optional(v.string()), buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))) }))),
    replyKeyword: v.optional(v.string()),
    quickReplies: v.optional(v.array(v.string())),
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
  }).index("by_time", ["timestamp"]).index("by_client", ["clientInstagramId"]),
});
