import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({ path: "/auth/callback", method: "GET", handler: httpAction(async (ctx, request) => {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const error = url.searchParams.get("error");
  const frontendUrl = process.env.FRONTEND_URL || "https://instabot-virid.vercel.app";
  if (error || !code) return Response.redirect(`${frontendUrl}?auth=error`, 302);
  try { await ctx.runAction(internal.auth.exchangeAndSave, { code: code.replace(/#_$/, "") }); return Response.redirect(`${frontendUrl}?auth=success`, 302); }
  catch (e: any) { console.error("OAuth error:", e.message); return Response.redirect(`${frontendUrl}?auth=error`, 302); }
})});

http.route({ path: "/auth/deauthorize", method: "POST", handler: httpAction(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })) });
http.route({ path: "/auth/delete", method: "POST", handler: httpAction(async () => new Response(JSON.stringify({ url: "https://instabot-virid.vercel.app", confirmation_code: `del_${Date.now()}` }), { status: 200, headers: { "Content-Type": "application/json" } })) });

http.route({ path: "/webhook", method: "GET", handler: httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.WEBHOOK_VERIFY_TOKEN)
    return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
  return new Response("Forbidden", { status: 403 });
})});

http.route({ path: "/webhook", method: "POST", handler: httpAction(async (ctx, request) => {
  const body = await request.json();

  // Log raw payload for debugging
  console.log("WEBHOOK RAW:", JSON.stringify(body).slice(0, 2000));

  for (const entry of body.entry || []) {
    const entryAccountId = String(entry.id || "");
    console.log("ENTRY ID:", entryAccountId, "has messaging:", !!entry.messaging, "has changes:", !!entry.changes);

    if (entry.messaging) {
      for (const event of entry.messaging) {
        const senderId = String(event.sender?.id);
        const recipientId = String(event.recipient?.id);
        console.log("DM event: sender=", senderId, "recipient=", recipientId, "entryId=", entryAccountId);
        if (event.message?.text) {
          await ctx.runAction(internal.engine.handleDm, { senderId, recipientId: entryAccountId || recipientId, text: event.message.text, messageId: event.message.mid || "" });
        }
        if (event.postback?.title) {
          await ctx.runAction(internal.engine.handleDm, { senderId, recipientId: entryAccountId || recipientId, text: event.postback.title, messageId: "" });
        }
      }
    }

    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === "comments" && change.value) {
          const val = change.value;
          console.log("COMMENT event: commentId=", val.id, "senderId=", val.from?.id, "mediaId=", val.media?.id, "entryId=", entryAccountId, "text=", val.text);
          await ctx.runAction(internal.engine.handleComment, {
            commentId: String(val.id), text: val.text || "",
            senderId: String(val.from?.id), mediaId: String(val.media?.id),
            accountId: entryAccountId,
          });
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
})});

export default http;
