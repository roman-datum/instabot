import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Instagram webhook verification (GET)
http.route({
  path: "/webhook",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const token = url.searchParams.get("hub.verify_token");

    const secret = process.env.WEBHOOK_VERIFY_TOKEN;
    if (mode === "subscribe" && token === secret) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }),
});

// Instagram webhook events (POST)
http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    for (const entry of body.entry || []) {
      // DM messages
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const senderId = String(event.sender?.id);
          const recipientId = String(event.recipient?.id);

          if (event.message?.text) {
            await ctx.runAction(internal.engine.handleDm, {
              senderId,
              recipientId,
              text: event.message.text,
            });
          }

          if (event.postback?.title) {
            await ctx.runAction(internal.engine.handleDm, {
              senderId,
              recipientId,
              text: event.postback.title,
            });
          }
        }
      }

      // Comment events
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "comments" && change.value) {
            const val = change.value;
            await ctx.runAction(internal.engine.handleComment, {
              commentId: String(val.id),
              text: val.text || "",
              senderId: String(val.from?.id),
              mediaId: String(val.media?.id),
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }),
});

export default http;
