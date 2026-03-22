"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const GRAPH_URL = "https://graph.instagram.com/v19.0";

// Send DM via regular messaging (requires 24h window from user's last DM)
export const sendDm = internalAction({
  args: {
    token: v.string(),
    recipientId: v.string(),
    text: v.string(),
    logAutomationId: v.id("automations"),
    clientInstagramId: v.string(),
  },
  handler: async (ctx, { token, recipientId, text, logAutomationId, clientInstagramId }) => {
    try {
      const url = `${GRAPH_URL}/me/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      });

      const data = await res.json();
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId,
        clientInstagramId,
        eventType: res.ok ? "dm_sent" : "error",
        message: res.ok ? `DM: ${text.slice(0, 100)}` : `Error: ${JSON.stringify(data)}`,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId, clientInstagramId,
        eventType: "error", message: `sendDm: ${e.message}`,
      });
    }
  },
});

// Send Private Reply to a commenter (uses comment_id, no 24h window needed!)
// This is how ManyChat/ChatFuel do comment-to-DM.
// Limitations: 1 message per comment, within 7 days of comment.
export const sendPrivateReply = internalAction({
  args: {
    token: v.string(),
    igUserId: v.string(), // Your IG user ID (the page/account ID)
    commentId: v.string(),
    text: v.string(),
    logAutomationId: v.id("automations"),
    clientInstagramId: v.string(),
  },
  handler: async (ctx, { token, igUserId, commentId, text, logAutomationId, clientInstagramId }) => {
    try {
      const url = `${GRAPH_URL}/${igUserId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text },
        }),
      });

      const data = await res.json();
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId,
        clientInstagramId,
        eventType: res.ok ? "private_reply_sent" : "error",
        message: res.ok ? `Private reply (comment ${commentId}): ${text.slice(0, 80)}` : `Error: ${JSON.stringify(data)}`,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId, clientInstagramId,
        eventType: "error", message: `sendPrivateReply: ${e.message}`,
      });
    }
  },
});

// Reply publicly to a comment
export const replyComment = internalAction({
  args: {
    token: v.string(),
    commentId: v.string(),
    text: v.string(),
    logAutomationId: v.id("automations"),
    clientInstagramId: v.string(),
  },
  handler: async (ctx, { token, commentId, text, logAutomationId, clientInstagramId }) => {
    try {
      const url = `${GRAPH_URL}/${commentId}/replies?message=${encodeURIComponent(text)}&access_token=${token}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const data = await res.json();
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId,
        clientInstagramId,
        eventType: res.ok ? "comment_replied" : "error",
        message: res.ok ? `Reply: ${text.slice(0, 100)}` : `Error: ${JSON.stringify(data)}`,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId, clientInstagramId,
        eventType: "error", message: `replyComment: ${e.message}`,
      });
    }
  },
});
