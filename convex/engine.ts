"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Format message text with button links appended
function formatMessage(text: string, buttons?: Array<{text: string, url: string}>) {
  if (!buttons || buttons.length === 0) return text;
  let msg = text;
  for (const btn of buttons) {
    msg += `\n\n${btn.text}: ${btn.url}`;
  }
  return msg;
}

// Handle incoming DM
export const handleDm = internalAction({
  args: { senderId: v.string(), recipientId: v.string(), text: v.string() },
  handler: async (ctx, { senderId, recipientId, text }) => {
    const integration = await ctx.runQuery(internal.queries.getIntegrationByInstagramId, { instagramId: recipientId });
    if (!integration) return;
    if (senderId === recipientId) return;

    await ctx.runMutation(internal.mutations.ensureClient, { instagramId: senderId, token: integration.pageAccessToken });
    await ctx.runMutation(internal.mutations.addLog, { clientInstagramId: senderId, eventType: "dm_received", message: text });

    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, { type: "dm", text, mediaId: "" });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: match.automationId });
      // Sort by step
      const sorted = [...actions].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

      let cumulativeDelay = 0;
      for (const action of sorted) {
        cumulativeDelay += (action.delaySeconds || 0);
        const msg = formatMessage(action.message, action.buttons);

        if (action.type === "send_dm" || action.type === "both") {
          const args = {
            token: integration.pageAccessToken,
            recipientId: senderId,
            text: msg,
            logAutomationId: match.automationId,
            clientInstagramId: senderId,
          };
          if (cumulativeDelay > 0) {
            await ctx.scheduler.runAfter(cumulativeDelay * 1000, internal.instagram.sendDm, args);
          } else {
            await ctx.runAction(internal.instagram.sendDm, args);
          }
        }
      }
    }
  },
});

// Handle incoming comment
export const handleComment = internalAction({
  args: { commentId: v.string(), text: v.string(), senderId: v.string(), mediaId: v.string() },
  handler: async (ctx, { commentId, text, senderId, mediaId }) => {
    const integrations = await ctx.runQuery(internal.queries.getAllIntegrations);
    if (!integrations.length) return;
    const integration = integrations[0];
    if (senderId === integration.instagramId) return;

    await ctx.runMutation(internal.mutations.ensureClient, { instagramId: senderId, token: integration.pageAccessToken });
    await ctx.runMutation(internal.mutations.addLog, { clientInstagramId: senderId, eventType: "comment_received", message: `[post:${mediaId}] ${text}` });

    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, { type: "comment", text, mediaId });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: match.automationId });
      const sorted = [...actions].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

      let cumulativeDelay = 0;
      for (let i = 0; i < sorted.length; i++) {
        const action = sorted[i];
        cumulativeDelay += (action.delaySeconds || 0);
        const msg = formatMessage(action.message, action.buttons);

        // Public reply to comment (only first step that includes reply_comment)
        if (action.type === "reply_comment" || action.type === "both") {
          const replyArgs = {
            token: integration.pageAccessToken, commentId, text: msg,
            logAutomationId: match.automationId, clientInstagramId: senderId,
          };
          if (cumulativeDelay > 0) {
            await ctx.scheduler.runAfter(cumulativeDelay * 1000, internal.instagram.replyComment, replyArgs);
          } else {
            await ctx.runAction(internal.instagram.replyComment, replyArgs);
          }
        }

        // DM: step 0 = Private Reply (via comment_id), step 1+ = regular DM (needs 24h window)
        if (action.type === "send_dm" || action.type === "both") {
          if (i === 0) {
            // First step: use Private Reply API (works without 24h window)
            const prArgs = {
              token: integration.pageAccessToken, igUserId: integration.instagramId,
              commentId, text: msg,
              logAutomationId: match.automationId, clientInstagramId: senderId,
            };
            if (cumulativeDelay > 0) {
              await ctx.scheduler.runAfter(cumulativeDelay * 1000, internal.instagram.sendPrivateReply, prArgs);
            } else {
              await ctx.runAction(internal.instagram.sendPrivateReply, prArgs);
            }
          } else {
            // Follow-up steps: regular DM (works if user replied to private reply)
            const dmArgs = {
              token: integration.pageAccessToken, recipientId: senderId, text: msg,
              logAutomationId: match.automationId, clientInstagramId: senderId,
            };
            // Always scheduled with delay for follow-ups
            await ctx.scheduler.runAfter(cumulativeDelay * 1000, internal.instagram.sendDm, dmArgs);
          }
        }
      }
    }
  },
});
