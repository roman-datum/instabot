"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const CALLBACK_URL = "https://merry-puffin-860.eu-west-1.convex.site/auth/callback";

export const exchangeAndSave = internalAction({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
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

<<<<<<< HEAD
    // Step 3: Get profile
=======
    // Get profile: id = app-scoped, user_id = Instagram Business Account ID
>>>>>>> aff95c7c5978220e3fa3a37b3e659b7d6a376024
    const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=user_id,username,name,id&access_token=${longToken}`);
    const profile = await profileRes.json();
    console.log("Profile:", JSON.stringify(profile));

<<<<<<< HEAD
    // Step 4: Subscribe to webhooks (messages, comments, postbacks)
    const subRes = await fetch(`https://graph.instagram.com/v25.0/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks,comments&access_token=${longToken}`, {
      method: "POST",
    });
    const subData = await subRes.json();
    console.log("Webhook subscription:", JSON.stringify(subData));
=======
    const appScopedId = profile.id;
    const igBusinessId = profile.user_id; // This is what webhook entry.id sends

    // Subscribe to webhooks
    await fetch(`https://graph.instagram.com/v25.0/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks,comments&access_token=${longToken}`, { method: "POST" });
>>>>>>> aff95c7c5978220e3fa3a37b3e659b7d6a376024

    await ctx.runMutation(internal.mutations.internalSaveIntegration, {
      accessToken: longToken, pageAccessToken: longToken,
      pageId: appScopedId, instagramId: appScopedId,
      igBusinessId: igBusinessId || "",
      pageName: profile.username || profile.name || appScopedId,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  },
});
