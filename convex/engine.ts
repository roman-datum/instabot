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
    // Get integration by instagram ID (recipientId = our page's instagram-scoped ID)
    const integration = await ctx.runQuery(internal.queries.getIntegrationByInstagramId, {
      instagramId: recipientId,
    });
    if (!integration) return;

    // Don't respond to ourselves
    if (senderId === recipientId) return;

    // Ensure client exists
    await ctx.runMutation(internal.mutations.ensureClient, {
      instagramId: senderId,
      token: integration.pageAccessToken,
    });

    // Log incoming
    await ctx.runMutation(internal.mutations.addLog, {
      clientInstagramId: senderId,
      eventType: "dm_received",
      message: text,
    });

    // Find matching automations
    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, {
      type: "dm",
      text,
      mediaId: "",
    });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, {
        automationId: match.automationId,
      });

      for (const action of actions) {
        if (action.type === "send_dm" || action.type === "both") {
          if (action.delaySeconds > 0) {
            await ctx.scheduler.runAfter(
              action.delaySeconds * 1000,
              internal.instagram.sendDm,
              {
                token: integration.pageAccessToken,
                recipientId: senderId,
                text: action.message,
                logAutomationId: match.automationId,
                clientInstagramId: senderId,
              }
            );
          } else {
            await ctx.runAction(internal.instagram.sendDm, {
              token: integration.pageAccessToken,
              recipientId: senderId,
              text: action.message,
              logAutomationId: match.automationId,
              clientInstagramId: senderId,
            });
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
    // Find integration by checking all integrations (we match by checking the sender isn't the page itself)
    const integrations = await ctx.runQuery(internal.queries.getAllIntegrations);
    if (!integrations.length) return;
    const integration = integrations[0]; // Single-user: one integration

    // Don't respond to our own comments
    if (senderId === integration.instagramId) return;

    // Ensure client
    await ctx.runMutation(internal.mutations.ensureClient, {
      instagramId: senderId,
      token: integration.pageAccessToken,
    });

    // Log incoming
    await ctx.runMutation(internal.mutations.addLog, {
      clientInstagramId: senderId,
      eventType: "comment_received",
      message: `[post:${mediaId}] ${text}`,
    });

    // Find matching triggers
    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, {
      type: "comment",
      text,
      mediaId,
    });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, {
        automationId: match.automationId,
      });

      for (const action of actions) {
        const delay = action.delaySeconds * 1000;

        // Reply to comment
        if (action.type === "reply_comment" || action.type === "both") {
          const replyFn = internal.instagram.replyComment;
          const replyArgs = {
            token: integration.pageAccessToken,
            commentId,
            text: action.message,
            logAutomationId: match.automationId,
            clientInstagramId: senderId,
          };
          if (delay > 0) {
            await ctx.scheduler.runAfter(delay, replyFn, replyArgs);
          } else {
            await ctx.runAction(replyFn, replyArgs);
          }
        }

        // Send DM
        if (action.type === "send_dm" || action.type === "both") {
          const dmFn = internal.instagram.sendDm;
          const dmArgs = {
            token: integration.pageAccessToken,
            recipientId: senderId,
            text: action.message,
            logAutomationId: match.automationId,
            clientInstagramId: senderId,
          };
          if (delay > 0) {
            await ctx.scheduler.runAfter(delay, dmFn, dmArgs);
          } else {
            await ctx.runAction(dmFn, dmArgs);
          }
        }
      }
    }
  },
});
