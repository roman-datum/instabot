"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Handle incoming DM
export const handleDm = internalAction({
  args: {
    senderId: v.string(),
    recipientId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { senderId, recipientId, text }) => {
    const integration = await ctx.runQuery(internal.queries.getIntegrationByInstagramId, {
      instagramId: recipientId,
    });
    if (!integration) return;
    if (senderId === recipientId) return;

    await ctx.runMutation(internal.mutations.ensureClient, {
      instagramId: senderId, token: integration.pageAccessToken,
    });

    await ctx.runMutation(internal.mutations.addLog, {
      clientInstagramId: senderId, eventType: "dm_received", message: text,
    });

    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, {
      type: "dm", text, mediaId: "",
    });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, {
        automationId: match.automationId,
      });

      for (const action of actions) {
        if (action.type === "send_dm" || action.type === "both") {
          const args = {
            token: integration.pageAccessToken,
            recipientId: senderId,
            text: action.message,
            logAutomationId: match.automationId,
            clientInstagramId: senderId,
          };
          if (action.delaySeconds > 0) {
            await ctx.scheduler.runAfter(action.delaySeconds * 1000, internal.instagram.sendDm, args);
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
  args: {
    commentId: v.string(),
    text: v.string(),
    senderId: v.string(),
    mediaId: v.string(),
  },
  handler: async (ctx, { commentId, text, senderId, mediaId }) => {
    const integrations = await ctx.runQuery(internal.queries.getAllIntegrations);
    if (!integrations.length) return;
    const integration = integrations[0];

    if (senderId === integration.instagramId) return;

    await ctx.runMutation(internal.mutations.ensureClient, {
      instagramId: senderId, token: integration.pageAccessToken,
    });

    await ctx.runMutation(internal.mutations.addLog, {
      clientInstagramId: senderId, eventType: "comment_received",
      message: `[post:${mediaId}] ${text}`,
    });

    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, {
      type: "comment", text, mediaId,
    });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, {
        automationId: match.automationId,
      });

      for (const action of actions) {
        const delay = action.delaySeconds * 1000;

        // Public reply to comment
        if (action.type === "reply_comment" || action.type === "both") {
          const replyArgs = {
            token: integration.pageAccessToken,
            commentId,
            text: action.message,
            logAutomationId: match.automationId,
            clientInstagramId: senderId,
          };
          if (delay > 0) {
            await ctx.scheduler.runAfter(delay, internal.instagram.replyComment, replyArgs);
          } else {
            await ctx.runAction(internal.instagram.replyComment, replyArgs);
          }
        }

        // Private Reply DM (uses comment_id as recipient -- no 24h window needed!)
        if (action.type === "send_dm" || action.type === "both") {
          const privateArgs = {
            token: integration.pageAccessToken,
            igUserId: integration.instagramId,
            commentId,
            text: action.message,
            logAutomationId: match.automationId,
            clientInstagramId: senderId,
          };
          if (delay > 0) {
            await ctx.scheduler.runAfter(delay, internal.instagram.sendPrivateReply, privateArgs);
          } else {
            await ctx.runAction(internal.instagram.sendPrivateReply, privateArgs);
          }
        }
      }
    }
  },
});
