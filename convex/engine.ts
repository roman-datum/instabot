"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

function pickRandom(arr: string[]): string { return arr[Math.floor(Math.random() * arr.length)]; }

export const handleDm = internalAction({
  args: { senderId: v.string(), recipientId: v.string(), text: v.string(), messageId: v.optional(v.string()) },
  handler: async (ctx, { senderId, recipientId, text }) => {
    let integ = await ctx.runQuery(internal.queries.getIntegrationByInstagramId, { instagramId: recipientId });
    if (!integ) { const all = await ctx.runQuery(internal.queries.getAllIntegrations); integ = all.find((i: any) => i.instagramId !== senderId) || null; }
    if (!integ || senderId === integ.instagramId) return;
    await ctx.runMutation(internal.mutations.ensureClient, { instagramId: senderId, token: integ.pageAccessToken });

    const matchedAutoId = await ctx.runMutation(internal.mutations.consumePendingFollowup, { clientInstagramId: senderId, text });
    if (matchedAutoId) {
      await ctx.runMutation(internal.mutations.addLog, { automationId: matchedAutoId, clientInstagramId: senderId, eventType: "followup_triggered", message: `[@${integ.pageName}] "${text}"` });
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: matchedAutoId });
      const followups = [...actions].filter(a => (a.step ?? 0) >= 1).sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      let cd = 0;
      for (const action of followups) {
        cd += (action.delaySeconds || 0);
        const args = { token: integ.pageAccessToken, recipientId: senderId, text: action.message, logAutomationId: matchedAutoId, clientInstagramId: senderId, quickReplies: action.quickReplies || undefined, buttons: action.buttons || undefined };
        if (cd > 0) await ctx.scheduler.runAfter(cd * 1000, internal.instagram.sendDm, args);
        else await ctx.runAction(internal.instagram.sendDm, args);
      }
      return;
    }

    const matches = await ctx.runQuery(internal.queries.findMatchingTriggersForIntegration, { integrationId: integ._id, type: "dm", text, mediaId: "" });
    if (matches.length === 0) return;
    await ctx.runMutation(internal.mutations.addLog, { clientInstagramId: senderId, eventType: "dm_matched", message: `[@${integ.pageName}] ${text}` });
    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: match.automationId });
      const sorted = [...actions].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      let cd = 0;
      for (const action of sorted) {
        cd += (action.delaySeconds || 0);
        if (action.type === "send_dm" || action.type === "both") {
          const args = { token: integ.pageAccessToken, recipientId: senderId, text: action.message, logAutomationId: match.automationId, clientInstagramId: senderId, quickReplies: action.quickReplies || undefined, buttons: action.buttons || undefined };
          if (cd > 0) await ctx.scheduler.runAfter(cd * 1000, internal.instagram.sendDm, args);
          else await ctx.runAction(internal.instagram.sendDm, args);
        }
      }
    }
  },
});

export const handleComment = internalAction({
  args: { commentId: v.string(), text: v.string(), senderId: v.string(), mediaId: v.string(), accountId: v.string() },
  handler: async (ctx, { commentId, text, senderId, mediaId, accountId }) => {
    let integ = await ctx.runQuery(internal.queries.getIntegrationByInstagramId, { instagramId: accountId });
    if (!integ) { const all = await ctx.runQuery(internal.queries.getAllIntegrations); integ = all.find((i: any) => i.instagramId !== senderId) || null; }
    if (!integ || senderId === integ.instagramId) return;

    const existing = await ctx.runQuery(internal.queries.checkRecentLog, { key: `comment:${commentId}` });
    if (existing) return;

    const matches = await ctx.runQuery(internal.queries.findMatchingTriggersForIntegration, { integrationId: integ._id, type: "comment", text, mediaId });
    if (matches.length === 0) return;

    await ctx.runMutation(internal.mutations.ensureClient, { instagramId: senderId, token: integ.pageAccessToken });
    await ctx.runMutation(internal.mutations.addLog, { clientInstagramId: senderId, eventType: "comment_matched", message: `[@${integ.pageName} post:${mediaId}] ${text} [dedup:comment:${commentId}]` });

    for (const match of matches) {
      const actions = await ctx.runQuery(internal.queries.getActionsByAutomation, { automationId: match.automationId });
      const sorted = [...actions].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      const step0 = sorted.find(a => (a.step ?? 0) === 0);
      if (!step0) continue;
      const d0 = step0.delaySeconds || 0;

      // Reply to comment (public) -- independent, errors don't block DM
      if (step0.type === "reply_comment" || step0.type === "both") {
        try {
          const cr = step0.commentReplies;
          const rt = (cr?.length) ? pickRandom(cr) : step0.message;
          const rArgs = { token: integ.pageAccessToken, commentId, text: rt, logAutomationId: match.automationId, clientInstagramId: senderId };
          if (d0 > 0) await ctx.scheduler.runAfter(d0 * 1000, internal.instagram.replyComment, rArgs);
          else await ctx.runAction(internal.instagram.replyComment, rArgs);
        } catch (e: any) {
          await ctx.runMutation(internal.mutations.addLog, { automationId: match.automationId, clientInstagramId: senderId, eventType: "error", message: `replyComment failed: ${e.message}` });
        }
      }

      // Private Reply DM -- independent, errors don't block reply
      if (step0.type === "send_dm" || step0.type === "both") {
        try {
          const prArgs = { token: integ.pageAccessToken, igUserId: integ.instagramId, commentId, text: step0.message, logAutomationId: match.automationId, clientInstagramId: senderId, quickReplies: step0.quickReplies || undefined, buttons: step0.buttons || undefined };
          if (d0 > 0) await ctx.scheduler.runAfter(d0 * 1000, internal.instagram.sendPrivateReply, prArgs);
          else await ctx.runAction(internal.instagram.sendPrivateReply, prArgs);
        } catch (e: any) {
          await ctx.runMutation(internal.mutations.addLog, { automationId: match.automationId, clientInstagramId: senderId, eventType: "error", message: `privateReply failed: ${e.message}` });
        }
      }

      // Register pending followup
      if (step0.replyKeyword && sorted.some(a => (a.step ?? 0) >= 1)) {
        await ctx.runMutation(internal.mutations.createPendingFollowup, { clientInstagramId: senderId, automationId: match.automationId, replyKeyword: step0.replyKeyword });
      }
    }
  },
});
