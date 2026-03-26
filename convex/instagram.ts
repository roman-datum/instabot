"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// IGQ tokens (IG Login) → graph.instagram.com; EAA tokens (FB Login) → graph.facebook.com
function graphUrl(token: string) {
  return token.startsWith("EAA") ? "https://graph.facebook.com/v25.0" : "https://graph.instagram.com/v25.0";
}
// EAA tokens must use /me/messages (not /{igUserId}/messages)
function msgEndpoint(token: string, igUserId?: string) {
  if (token.startsWith("EAA")) return `${graphUrl(token)}/me/messages`;
  return igUserId ? `${graphUrl(token)}/${igUserId}/messages` : `${graphUrl(token)}/me/messages`;
}

async function sendMsg(token: string, igUserId: string | undefined, recipient: any, message: any) {
  const res = await fetch(msgEndpoint(token, igUserId), {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ recipient, message }),
  });
  return { res, data: await res.json() };
}

type CarouselCard = { title: string; subtitle?: string; imageUrl?: string; buttons?: { text: string; url: string }[] };

// Build message payload: supports text, buttons (generic template), quickReplies, imageUrl, videoUrl, audioUrl, fileUrl, carousel
function buildPayloads(text: string, buttons?: { text: string; url: string }[], quickReplies?: string[], imageUrl?: string, videoUrl?: string, audioUrl?: string, fileUrl?: string, carousel?: CarouselCard[]) {
  const payloads: any[] = [];

  // 1. Media attachments as separate messages
  if (imageUrl) {
    payloads.push({ attachment: { type: "image", payload: { url: imageUrl } } });
  }
  if (videoUrl) {
    payloads.push({ attachment: { type: "video", payload: { url: videoUrl } } });
  }
  if (audioUrl) {
    payloads.push({ attachment: { type: "audio", payload: { url: audioUrl } } });
  }
  if (fileUrl) {
    payloads.push({ attachment: { type: "file", payload: { url: fileUrl } } });
  }

  // 2. Carousel → generic template with multiple elements
  if (carousel?.length) {
    const elements = carousel.slice(0, 10).map(card => {
      const el: any = { title: card.title };
      if (card.subtitle) el.subtitle = card.subtitle;
      if (card.imageUrl) {
        el.image_url = card.imageUrl;
        el.default_action = { type: "web_url", url: card.imageUrl };
      }
      if (card.buttons?.length) {
        el.buttons = card.buttons.map(b => ({ type: "web_url", url: b.url, title: b.text }));
        if (!el.default_action && card.buttons[0]?.url) {
          el.default_action = { type: "web_url", url: card.buttons[0].url };
        }
      }
      return el;
    });
    payloads.push({
      attachment: { type: "template", payload: { template_type: "generic", elements } },
    });
  } else if (buttons?.length) {
    // 3. Buttons → generic template (single card)
    const templateMsg: any = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: text.slice(0, 80),
            subtitle: text.length > 80 ? text.slice(80, 160) : undefined,
            buttons: buttons.map(b => ({ type: "web_url", url: b.url, title: b.text })),
          }],
        },
      },
    };
    payloads.push(templateMsg);
  } else {
    // 4. Plain text (with optional quick replies)
    const textMsg: any = { text };
    if (quickReplies?.length) {
      textMsg.quick_replies = quickReplies.map(qr => ({ content_type: "text", title: qr, payload: qr }));
    }
    payloads.push(textMsg);
  }

  return payloads;
}

export const sendDm = internalAction({
  args: { token: v.string(), igUserId: v.optional(v.string()), recipientId: v.string(), text: v.string(), logAutomationId: v.id("automations"), clientInstagramId: v.string(), quickReplies: v.optional(v.array(v.string())), buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))), imageUrl: v.optional(v.string()), videoUrl: v.optional(v.string()), audioUrl: v.optional(v.string()), fileUrl: v.optional(v.string()), carousel: v.optional(v.array(v.object({ title: v.string(), subtitle: v.optional(v.string()), imageUrl: v.optional(v.string()), buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))) }))) },
  handler: async (ctx, { token, igUserId, recipientId, text, logAutomationId, clientInstagramId, quickReplies, buttons, imageUrl, videoUrl, audioUrl, fileUrl, carousel }) => {
    try {
      const payloads = buildPayloads(text, buttons || undefined, quickReplies || undefined, imageUrl, videoUrl, audioUrl, fileUrl, carousel || undefined);
      let lastOk = true; let lastData: any = {};
      for (const msg of payloads) {
        const { res, data } = await sendMsg(token, igUserId, { id: recipientId }, msg);
        lastOk = res.ok; lastData = data;
        if (!res.ok) break;
      }
      await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: lastOk ? "dm_sent" : "error", message: lastOk ? `DM: ${text.slice(0, 100)}` : `DM Error: ${JSON.stringify(lastData)}` });
    } catch (e: any) { await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: "error", message: `sendDm: ${e.message}` }); }
  },
});

export const sendPrivateReply = internalAction({
  args: { token: v.string(), igUserId: v.string(), commentId: v.string(), text: v.string(), logAutomationId: v.id("automations"), clientInstagramId: v.string(), quickReplies: v.optional(v.array(v.string())), buttons: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))) },
  handler: async (ctx, { token, igUserId, commentId, text, logAutomationId, clientInstagramId, quickReplies, buttons }) => {
    try {
      // Private reply supports text + quick replies only (no templates)
      let msgText = text;
      if (buttons?.length) for (const btn of buttons) msgText += `\n\n${btn.text}: ${btn.url}`;
      const msgPayload: any = { text: msgText };
      if (quickReplies?.length) msgPayload.quick_replies = quickReplies.map(qr => ({ content_type: "text", title: qr, payload: qr }));
      const { res, data } = await sendMsg(token, igUserId, { comment_id: commentId }, msgPayload);
      await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: res.ok ? "private_reply_sent" : "error", message: res.ok ? `Private reply (${commentId}): ${msgText.slice(0, 80)}` : `PR Error: ${JSON.stringify(data)}` });
    } catch (e: any) { await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: "error", message: `sendPrivateReply: ${e.message}` }); }
  },
});

export const replyComment = internalAction({
  args: { token: v.string(), commentId: v.string(), text: v.string(), logAutomationId: v.id("automations"), clientInstagramId: v.string() },
  handler: async (ctx, { token, commentId, text, logAutomationId, clientInstagramId }) => {
    try {
      const res = await fetch(`${graphUrl(token)}/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: res.ok ? "comment_replied" : "error", message: res.ok ? `Comment reply: ${text.slice(0, 100)}` : `Comment Error: ${JSON.stringify(data)}` });
    } catch (e: any) { await ctx.runMutation(internal.mutations.addLog, { automationId: logAutomationId, clientInstagramId, eventType: "error", message: `replyComment: ${e.message}` }); }
  },
});
