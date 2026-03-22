"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
      const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
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
        message: res.ok ? `DM sent: ${text.slice(0, 100)}` : `Error: ${JSON.stringify(data)}`,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId,
        clientInstagramId,
        eventType: "error",
        message: `sendDm exception: ${e.message}`,
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
      const url = `https://graph.facebook.com/v19.0/${commentId}/replies?message=${encodeURIComponent(text)}&access_token=${token}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const data = await res.json();

      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId,
        clientInstagramId,
        eventType: res.ok ? "comment_replied" : "error",
        message: res.ok ? `Replied: ${text.slice(0, 100)}` : `Error: ${JSON.stringify(data)}`,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.mutations.addLog, {
        automationId: logAutomationId,
        clientInstagramId,
        eventType: "error",
        message: `replyComment exception: ${e.message}`,
      });
    }
  },
});

// Helper: get user info from IG (for enriching client data)
export const fetchUserInfo = internalAction({
  args: {
    token: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { token, userId }) => {
    try {
      const url = `https://graph.facebook.com/v19.0/${userId}?access_token=${token}`;
      const res = await fetch(url);
      return await res.json();
    } catch {
      return null;
    }
  },
});
