"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

function formatMessage(text: string, buttons?: Array<{text: string, url: string}>) {
  if (!buttons || buttons.length === 0) return text;
  let msg = text;
  for (const btn of buttons) { msg += `\n\n${btn.text}: ${btn.url}`; }
  return msg;
}

// Handle incoming DM
export const handleDm = internalAction({
  args: { senderId: v.string(), recipientId: v.string(), text: v.string() },
  handler: async (ctx, { senderId, recipientId, text }) => {
    const integration = await ctx.runQuery(internal.queries.getIntegrationByInstagramId, { instagramId: recipientId });
    if (!integration) {
      // Try finding any integration (sender/recipient may be swapped)
      const all = await ctx.runQuery(internal.queries.getAllIntegrations);
      if (!all.length) return;
    }
    const integrations = await ctx.runQuery(internal.queries.getAllIntegrations);
    if (!integrations.length) return;
    const integ = integration || integrations[0];
    if (senderId === integ.instagramId) return;

    await ctx.runMutation(internal.mutations.ensureClient, { instagramId: senderId, token: integ.pageAccessToken });
    await ctx.runMutation(internal.mutations.addLog, { clientInstagramId: senderId, eventType: "dm_received", message: text });

    // 1. Check pending followups FIRST (user replied to Private Reply)
    const matchedAutomationId = await ctx.runMutation(internal.mutations.consumePendingFollowup, {
      clientInstagramId: senderId, text,
    });

    if (matchedAutomationId) {
      // Execute step 1+ for this automation
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: matchedAutomationId });
      const followups = [...actions].filter(a => (a.step ?? 0) >= 1).sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

      let cumulativeDelay = 0;
      for (const action of followups) {
        cumulativeDelay += (action.delaySeconds || 0);
        const msg = formatMessage(action.message, action.buttons);
        const args = {
          token: integ.pageAccessToken, recipientId: senderId, text: msg,
          logAutomationId: matchedAutomationId, clientInstagramId: senderId,
        };
        if (cumulativeDelay > 0) {
          await ctx.scheduler.runAfter(cumulativeDelay * 1000, internal.instagram.sendDm, args);
        } else {
          await ctx.runAction(internal.instagram.sendDm, args);
        }
      }
      return; // Don't process regular triggers
    }

    // 2. Regular DM triggers
    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, { type: "dm", text, mediaId: "" });
    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: match.automationId });
      const sorted = [...actions].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

      let cumulativeDelay = 0;
      for (const action of sorted) {
        cumulativeDelay += (action.delaySeconds || 0);
        const msg = formatMessage(action.message, action.buttons);
        if (action.type === "send_dm" || action.type === "both") {
          const args = { token: integ.pageAccessToken, recipientId: senderId, text: msg, logAutomationId: match.automationId, clientInstagramId: senderId };
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
      const step0 = sorted.find(a => (a.step ?? 0) === 0);

      if (!step0) continue;

      // Execute step 0: Private Reply
      const msg0 = formatMessage(step0.message, step0.buttons);
      const delay0 = step0.delaySeconds || 0;

      if (step0.type === "reply_comment" || step0.type === "both") {
        const rArgs = { token: integration.pageAccessToken, commentId, text: msg0, logAutomationId: match.automationId, clientInstagramId: senderId };
        if (delay0 > 0) { await ctx.scheduler.runAfter(delay0 * 1000, internal.instagram.replyComment, rArgs); }
        else { await ctx.runAction(internal.instagram.replyComment, rArgs); }
      }

      if (step0.type === "send_dm" || step0.type === "both") {
        const prArgs = { token: integration.pageAccessToken, igUserId: integration.instagramId, commentId, text: msg0, logAutomationId: match.automationId, clientInstagramId: senderId };
        if (delay0 > 0) { await ctx.scheduler.runAfter(delay0 * 1000, internal.instagram.sendPrivateReply, prArgs); }
        else { await ctx.runAction(internal.instagram.sendPrivateReply, prArgs); }
      }

      // If step0 has replyKeyword and there are follow-up steps → register pending
      if (step0.replyKeyword && sorted.some(a => (a.step ?? 0) >= 1)) {
        await ctx.runMutation(internal.mutations.createPendingFollowup, {
          clientInstagramId: senderId,
          automationId: match.automationId,
          replyKeyword: step0.replyKeyword,
        });
      }
    }
  },
});
