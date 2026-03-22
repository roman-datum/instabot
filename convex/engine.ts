"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const handleDm = internalAction({
  args: { senderId: v.string(), recipientId: v.string(), text: v.string() },
  handler: async (ctx, { senderId, recipientId, text }) => {
    const integrations = await ctx.runQuery(internal.queries.getAllIntegrations);
    if (!integrations.length) return;
    const integ = integrations[0];
    if (senderId === integ.instagramId) return;

    await ctx.runMutation(internal.mutations.ensureClient, { instagramId: senderId, token: integ.pageAccessToken });
    await ctx.runMutation(internal.mutations.addLog, { clientInstagramId: senderId, eventType: "dm_received", message: text });

    // 1. Check pending followups (user replied after Private Reply)
    const matchedAutoId = await ctx.runMutation(internal.mutations.consumePendingFollowup, {
      clientInstagramId: senderId, text,
    });

    if (matchedAutoId) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: matchedAutoId });
      const followups = [...actions].filter(a => (a.step ?? 0) >= 1).sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      let cumDelay = 0;
      for (const action of followups) {
        cumDelay += (action.delaySeconds || 0);
        const args = {
          token: integ.pageAccessToken, recipientId: senderId, text: action.message,
          logAutomationId: matchedAutoId, clientInstagramId: senderId,
          quickReplies: action.quickReplies || undefined,
          buttons: action.buttons || undefined,
        };
        if (cumDelay > 0) { await ctx.scheduler.runAfter(cumDelay * 1000, internal.instagram.sendDm, args); }
        else { await ctx.runAction(internal.instagram.sendDm, args); }
      }
      return;
    }

    // 2. Regular DM triggers
    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, { type: "dm", text, mediaId: "" });
    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: match.automationId });
      const sorted = [...actions].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      let cumDelay = 0;
      for (const action of sorted) {
        cumDelay += (action.delaySeconds || 0);
        if (action.type === "send_dm" || action.type === "both") {
          const args = {
            token: integ.pageAccessToken, recipientId: senderId, text: action.message,
            logAutomationId: match.automationId, clientInstagramId: senderId,
            quickReplies: action.quickReplies || undefined,
            buttons: action.buttons || undefined,
          };
          if (cumDelay > 0) { await ctx.scheduler.runAfter(cumDelay * 1000, internal.instagram.sendDm, args); }
          else { await ctx.runAction(internal.instagram.sendDm, args); }
        }
      }
    }
  },
});

export const handleComment = internalAction({
  args: { commentId: v.string(), text: v.string(), senderId: v.string(), mediaId: v.string() },
  handler: async (ctx, { commentId, text, senderId, mediaId }) => {
    const integrations = await ctx.runQuery(internal.queries.getAllIntegrations);
    if (!integrations.length) return;
    const integ = integrations[0];
    if (senderId === integ.instagramId) return;

    await ctx.runMutation(internal.mutations.ensureClient, { instagramId: senderId, token: integ.pageAccessToken });
    await ctx.runMutation(internal.mutations.addLog, { clientInstagramId: senderId, eventType: "comment_received", message: `[post:${mediaId}] ${text}` });

    const matches = await ctx.runQuery(internal.queries.findMatchingTriggers, { type: "comment", text, mediaId });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: match.automationId });
      const sorted = [...actions].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      const step0 = sorted.find(a => (a.step ?? 0) === 0);
      if (!step0) continue;

      const delay0 = step0.delaySeconds || 0;

      // Public comment reply (random from commentReplies or default message)
      if (step0.type === "reply_comment" || step0.type === "both") {
        const commentReplies = step0.commentReplies;
        const replyText = (commentReplies && commentReplies.length > 0) ? pickRandom(commentReplies) : step0.message;
        const rArgs = { token: integ.pageAccessToken, commentId, text: replyText, logAutomationId: match.automationId, clientInstagramId: senderId };
        if (delay0 > 0) { await ctx.scheduler.runAfter(delay0 * 1000, internal.instagram.replyComment, rArgs); }
        else { await ctx.runAction(internal.instagram.replyComment, rArgs); }
      }

      // Private Reply DM
      if (step0.type === "send_dm" || step0.type === "both") {
        const prArgs = {
          token: integ.pageAccessToken, igUserId: integ.instagramId, commentId, text: step0.message,
          logAutomationId: match.automationId, clientInstagramId: senderId,
          quickReplies: step0.quickReplies || undefined,
          buttons: step0.buttons || undefined,
        };
        if (delay0 > 0) { await ctx.scheduler.runAfter(delay0 * 1000, internal.instagram.sendPrivateReply, prArgs); }
        else { await ctx.runAction(internal.instagram.sendPrivateReply, prArgs); }
      }

      // Register pending followup if there are next steps
      if (step0.replyKeyword && sorted.some(a => (a.step ?? 0) >= 1)) {
        await ctx.runMutation(internal.mutations.createPendingFollowup, {
          clientInstagramId: senderId, automationId: match.automationId, replyKeyword: step0.replyKeyword,
        });
      }
    }
  },
});
