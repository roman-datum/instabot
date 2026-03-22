"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

const CALLBACK_URL = "https://merry-puffin-860.eu-west-1.convex.site/auth/callback";

export const exchangeAndSave = internalAction({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const appId = process.env.INSTAGRAM_APP_ID!;
    const appSecret = process.env.INSTAGRAM_APP_SECRET!;

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

    const profileRes = await fetch(`https://graph.instagram.com/v19.0/me?fields=user_id,username,name,id&access_token=${longToken}`);
    const profile = await profileRes.json();
    const igAppScopedId = profile.id || profile.user_id;

    await ctx.runMutation(internal.mutations.internalSaveIntegration, {
      accessToken: longToken, pageAccessToken: longToken,
      pageId: igAppScopedId, instagramId: igAppScopedId,
      pageName: profile.username || profile.name || igAppScopedId,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  },
});
