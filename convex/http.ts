import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const FRONTEND = "https://direct.botmake.site";

http.route({ path: "/auth/callback", method: "GET", handler: httpAction(async (ctx, request) => {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const error = url.searchParams.get("error");
  const workspaceId = url.searchParams.get("state") || undefined;
  const frontendUrl = process.env.FRONTEND_URL || FRONTEND;
  if (error || !code) return Response.redirect(`${frontendUrl}?auth=error`, 302);
  try { await ctx.runAction(internal.auth.exchangeAndSave, { code: code.replace(/#_$/, ""), workspaceId }); return Response.redirect(`${frontendUrl}?auth=success`, 302); }
  catch (e: any) { console.error("OAuth error:", e.message); return Response.redirect(`${frontendUrl}?auth=error`, 302); }
})});

http.route({ path: "/auth/fb-callback", method: "GET", handler: httpAction(async (ctx, request) => {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const error = url.searchParams.get("error");
  const workspaceId = url.searchParams.get("state") || undefined;
  const frontendUrl = process.env.FRONTEND_URL || FRONTEND;
  if (error || !code) return Response.redirect(`${frontendUrl}?auth=error&msg=${encodeURIComponent(error || "no_code")}`, 302);
  try { await ctx.runAction(internal.auth.exchangeAndSaveFb, { code, workspaceId }); return Response.redirect(`${frontendUrl}?auth=success`, 302); }
  catch (e: any) { console.error("FB OAuth error:", e.message); return Response.redirect(`${frontendUrl}?auth=error&msg=${encodeURIComponent(e.message || "unknown")}`, 302); }
})});

http.route({ path: "/auth/deauthorize", method: "POST", handler: httpAction(async (ctx, request) => {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");
    if (signedRequest) {
      const [, payload] = signedRequest.split(".");
      const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      const data = JSON.parse(decoded);
      if (data.user_id) await ctx.runMutation(internal.mutations.deauthorizeUser, { instagramId: String(data.user_id) });
    }
  } catch (e: any) { console.error("Deauthorize error:", e.message); }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
})});

http.route({ path: "/auth/delete", method: "POST", handler: httpAction(async (ctx, request) => {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");
    let userId = "unknown";
    if (signedRequest) {
      const [, payload] = signedRequest.split(".");
      const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      const data = JSON.parse(decoded);
      userId = String(data.user_id || "unknown");
    }
    const confirmationCode = `del_${Date.now()}_${userId}`;
    if (userId !== "unknown") await ctx.runMutation(internal.mutations.deleteUserData, { instagramId: userId });
    return new Response(JSON.stringify({ url: `${FRONTEND}/data-deletion?code=${confirmationCode}`, confirmation_code: confirmationCode }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Delete callback error:", e.message);
    return new Response(JSON.stringify({ url: `${FRONTEND}/data-deletion`, confirmation_code: `del_${Date.now()}` }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
})});

http.route({ path: "/webhook", method: "GET", handler: httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.WEBHOOK_VERIFY_TOKEN)
    return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
  return new Response("Forbidden", { status: 403 });
})});

http.route({ path: "/webhook", method: "POST", handler: httpAction(async (ctx, request) => {
  const body = await request.json();

  console.log("WEBHOOK RAW:", JSON.stringify(body).slice(0, 2000));
  await ctx.runMutation(internal.mutations.addLog, {
    clientInstagramId: "webhook", eventType: "webhook_received",
    message: `entries:${(body.entry || []).length} object:${body.object} raw:${JSON.stringify(body).slice(0, 200)}`,
  });

  for (const entry of body.entry || []) {
    const entryAccountId = String(entry.id || "");
    console.log("ENTRY ID:", entryAccountId, "messaging:", !!entry.messaging, "changes:", !!entry.changes);

    if (entry.messaging) {
      for (const event of entry.messaging) {
        const senderId = String(event.sender?.id);
        const recipientId = String(event.recipient?.id);
        if (event.message?.text) {
          await ctx.scheduler.runAfter(0, internal.engine.handleDm, {
            senderId, recipientId: entryAccountId || recipientId,
            text: event.message.text, messageId: event.message.mid || "",
          });
        }
        if (event.postback?.title) {
          await ctx.scheduler.runAfter(0, internal.engine.handleDm, {
            senderId, recipientId: entryAccountId || recipientId,
            text: event.postback.title, messageId: "",
          });
        }
      }
    }

    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === "comments" && change.value) {
          const val = change.value;
          console.log("COMMENT event:", val.id, val.from?.id, val.media?.id, entryAccountId, val.text);
          await ctx.scheduler.runAfter(0, internal.engine.handleComment, {
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
