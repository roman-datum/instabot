"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const CALLBACK_URL = "https://merry-puffin-860.eu-west-1.convex.site/auth/callback";
const FB_CALLBACK_URL = "https://merry-puffin-860.eu-west-1.convex.site/auth/fb-callback";

export const exchangeAndSave = internalAction({
  args: { code: v.string(), workspaceId: v.optional(v.string()) },
  handler: async (ctx, { code, workspaceId }) => {
    const appId = process.env.INSTAGRAM_APP_ID!;
    const appSecret = process.env.INSTAGRAM_APP_SECRET!;

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: CALLBACK_URL, code }),
    });
    const tokenData = await tokenRes.json();
    let shortToken: string;
    if (tokenData.data && Array.isArray(tokenData.data)) { shortToken = tokenData.data[0].access_token; }
    else if (tokenData.access_token) { shortToken = tokenData.access_token; }
    else { throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`); }

    const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`);
    const longData = await longRes.json();
    const longToken = longData.access_token || shortToken;
    const expiresIn = longData.expires_in || 3600;

    // Get profile: id = app-scoped, user_id = Instagram Business Account ID
    const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=user_id,username,name,id&access_token=${longToken}`);
    const profile = await profileRes.json();
    console.log("Profile:", JSON.stringify(profile));

    const appScopedId = profile.id;
    const igBusinessId = profile.user_id;

    // Subscribe to webhooks
    const subRes = await fetch(`https://graph.instagram.com/v25.0/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks,comments&access_token=${longToken}`, { method: "POST" });
    const subData = await subRes.json();
    console.log("Webhook subscription:", JSON.stringify(subData));

    await ctx.runMutation(internal.mutations.internalSaveIntegration, {
      accessToken: longToken, pageAccessToken: longToken,
      pageId: appScopedId, instagramId: appScopedId,
      igBusinessId: igBusinessId || "",
      pageName: profile.username || profile.name || appScopedId,
      expiresAt: Date.now() + expiresIn * 1000,
      workspaceId: workspaceId as any || undefined,
    });
  },
});

export const exchangeAndSaveFb = internalAction({
  args: { code: v.string(), workspaceId: v.optional(v.string()) },
  handler: async (ctx, { code, workspaceId }) => {
    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;

    // 1. Exchange code for Facebook user access token
    const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(FB_CALLBACK_URL)}&client_secret=${appSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    console.log("FB token exchange:", JSON.stringify(tokenData));
    if (!tokenData.access_token) throw new Error(`FB token exchange failed: ${JSON.stringify(tokenData)}`);

    // 2. Exchange for long-lived user token
    const longRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`);
    const longData = await longRes.json();
    const longUserToken = longData.access_token || tokenData.access_token;
    console.log("FB long-lived token obtained:", !!longUserToken);

    // 3. Get user's Facebook Pages with connected Instagram Business Accounts
    const pagesRes = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${longUserToken}`);
    const pagesData = await pagesRes.json();
    console.log("FB Pages:", JSON.stringify(pagesData));

    if (!pagesData.data?.length) throw new Error("No Facebook Pages found. Make sure your Facebook account has Pages.");

    let connectedCount = 0;
    for (const page of pagesData.data) {
      const igAccount = page.instagram_business_account;
      if (!igAccount) continue;

      const pageToken = page.access_token; // Page tokens from long-lived user tokens are already long-lived
      const igId = String(igAccount.id);
      const igUsername = igAccount.username || igAccount.name || igId;

      // 4. Subscribe Facebook Page to webhooks (EAA tokens work on graph.facebook.com, NOT graph.instagram.com)
      // Reference: datum-chatbot-backend uses graph.facebook.com/{page_id}/subscribed_apps
      const subRes = await fetch(`https://graph.facebook.com/v25.0/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${pageToken}`, { method: "POST" });
      const subData = await subRes.json();
      console.log(`Webhook sub for ${igUsername} (page:${page.id}):`, JSON.stringify(subData));

      // 5. Save integration — igBusinessId = instagramId for FB Login flow
      await ctx.runMutation(internal.mutations.internalSaveIntegration, {
        accessToken: pageToken,
        pageAccessToken: pageToken,
        pageId: String(page.id),
        instagramId: igId,
        igBusinessId: igId,
        pageName: igUsername,
        expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000, // ~60 days
        workspaceId: workspaceId as any || undefined,
      });
      connectedCount++;
    }

    if (connectedCount === 0) throw new Error("No Instagram Business Account linked to your Pages. Link Instagram to a Facebook Page first.");
    console.log(`Connected ${connectedCount} Instagram account(s) via Facebook`);
  },
});
