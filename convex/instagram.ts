"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Instagram API with Instagram Login uses graph.instagram.com
const GRAPH_URL = "https://graph.instagram.com/v19.0";

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
      const url = `${GRAPH_URL}/me/messages?access_token=${token}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        automationId: logAutomationId,
        clientInstagramId,
        eventType: "error",
        message: `sendDm: ${e.message}`,
      });
    }
  },
});

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
        automationId: logAutomationId,
        clientInstagramId,
        eventType: "error",
        message: `replyComment: ${e.message}`,
      });
    }
  },
});
