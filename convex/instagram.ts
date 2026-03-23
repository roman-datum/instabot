"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const GRAPH_URL = "https://graph.instagram.com/v19.0";

export const sendDm = internalAction({
  args: { token: v.string(), recipientId: v.string(), text: v.string(), logAutomationId: v.id("automations"), clientInstagramId: v.string(), quickReplies: v.optional(v.array(v.string())), buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))) },
  handler: async (ctx, { token, recipientId, text, logAutomationId, clientInstagramId, quickReplies, buttons }) => {
    try {
      let msgText = text;
      if (buttons?.length) for (const btn of buttons) msgText += `\n\n${btn.text}: ${btn.url}`;
      const msgPayload: any = { text: msgText };
      if (quickReplies?.length) msgPayload.quick_replies = quickReplies.map(qr => ({ content_type: "text", title: qr, payload: qr }));
      const res = await fetch(`${GRAPH_URL}/me/messages`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ recipient: { id: recipientId }, message: msgPayload }),
      });
      const data = await res.json();
      await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: res.ok ? "dm_sent" : "error", message: res.ok ? `DM: ${msgText.slice(0, 100)}` : `DM Error: ${JSON.stringify(data)}` });
    } catch (e: any) { await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: "error", message: `sendDm: ${e.message}` }); }
  },
});

export const sendPrivateReply = internalAction({
  args: { token: v.string(), igUserId: v.string(), commentId: v.string(), text: v.string(), logAutomationId: v.id("automations"), clientInstagramId: v.string(), quickReplies: v.optional(v.array(v.string())), buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))) },
  handler: async (ctx, { token, commentId, text, logAutomationId, clientInstagramId, quickReplies, buttons }) => {
    try {
      let msgText = text;
      if (buttons?.length) for (const btn of buttons) msgText += `\n\n${btn.text}: ${btn.url}`;
      const msgPayload: any = { text: msgText };
      if (quickReplies?.length) msgPayload.quick_replies = quickReplies.map(qr => ({ content_type: "text", title: qr, payload: qr }));
      const res = await fetch(`${GRAPH_URL}/me/messages`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ recipient: { comment_id: commentId }, message: msgPayload }),
      });
      const data = await res.json();
      await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: res.ok ? "private_reply_sent" : "error", message: res.ok ? `Private reply (${commentId}): ${msgText.slice(0, 80)}` : `PR Error: ${JSON.stringify(data)}` });
    } catch (e: any) { await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: "error", message: `sendPrivateReply: ${e.message}` }); }
  },
});

export const replyComment = internalAction({
  args: { token: v.string(), commentId: v.string(), text: v.string(), logAutomationId: v.id("automations"), clientInstagramId: v.string() },
  handler: async (ctx, { token, commentId, text, logAutomationId, clientInstagramId }) => {
    try {
      // Use Authorization header, not URL param
      const res = await fetch(`${GRAPH_URL}/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: res.ok ? "comment_replied" : "error", message: res.ok ? `Comment reply: ${text.slice(0, 100)}` : `Comment Error: ${JSON.stringify(data)}` });
    } catch (e: any) { await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: "error", message: `replyComment: ${e.message}` }); }
  },
});
