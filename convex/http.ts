import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// OAuth callback
http.route({
  path: "/auth/callback", method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const frontendUrl = process.env.FRONTEND_URL || "https://instabot-virid.vercel.app";
    if (error || !code) return Response.redirect(`${frontendUrl}?auth=error`, 302);
    const cleanCode = code.replace(/#_$/, "");
    try { await ctx.runAction(internal.auth.exchangeAndSave, { code: cleanCode }); return Response.redirect(`${frontendUrl}?auth=success`, 302); }
    catch (e: any) { console.error("OAuth error:", e.message); return Response.redirect(`${frontendUrl}?auth=error`, 302); }
  }),
});

// Deauthorize + Data deletion
http.route({ path: "/auth/deauthorize", method: "POST", handler: httpAction(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })) });
http.route({ path: "/auth/delete", method: "POST", handler: httpAction(async () => new Response(JSON.stringify({ url: "https://instabot-virid.vercel.app", confirmation_code: `del_${Date.now()}` }), { status: 200, headers: { "Content-Type": "application/json" } })) });

// Webhook verification
http.route({
  path: "/webhook", method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const token = url.searchParams.get("hub.verify_token");
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }),
});

// Webhook events
http.route({
  path: "/webhook", method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    for (const entry of body.entry || []) {
      // entry.id = the IG account ID that OWNS the content (post owner / DM recipient)
      const entryAccountId = String(entry.id || "");

      // DM messages
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const senderId = String(event.sender?.id);
          const recipientId = String(event.recipient?.id);
          if (event.message?.text) {
            await ctx.runAction(internal.engine.handleDm, {
              senderId, recipientId: entryAccountId || recipientId,
              text: event.message.text, messageId: event.message.mid || "",
            });
          }
          if (event.postback?.title) {
            await ctx.runAction(internal.engine.handleDm, {
              senderId, recipientId: entryAccountId || recipientId,
              text: event.postback.title, messageId: "",
            });
          }
        }
      }

      // Comment events -- pass entryAccountId so engine knows WHICH account owns the post
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "comments" && change.value) {
            const val = change.value;
            await ctx.runAction(internal.engine.handleComment, {
              commentId: String(val.id),
              text: val.text || "",
              senderId: String(val.from?.id),
              mediaId: String(val.media?.id),
              accountId: entryAccountId,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }),
});

export default http;
