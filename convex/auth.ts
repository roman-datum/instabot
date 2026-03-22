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

    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: CALLBACK_URL,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Token exchange response:", JSON.stringify(tokenData));

    // Response: { data: [{ access_token, user_id, permissions }] } or direct object
    let shortToken: string;
    let userId: string;

    if (tokenData.data && Array.isArray(tokenData.data)) {
      shortToken = tokenData.data[0].access_token;
      userId = String(tokenData.data[0].user_id);
    } else if (tokenData.access_token) {
      shortToken = tokenData.access_token;
      userId = String(tokenData.user_id);
    } else {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Step 2: Exchange short-lived for long-lived token
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    );
    const longData = await longRes.json();
    console.log("Long-lived token response:", JSON.stringify({ expires_in: longData.expires_in }));

    const longToken = longData.access_token || shortToken;
    const expiresIn = longData.expires_in || 3600;

    // Step 3: Get user profile info
    const profileRes = await fetch(
      `https://graph.instagram.com/v19.0/me?fields=user_id,username,name,profile_picture_url&access_token=${longToken}`
    );
    const profile = await profileRes.json();
    console.log("Profile:", JSON.stringify(profile));

    // Step 4: Save integration
    await ctx.runMutation(internal.mutations.saveIntegration, {
      accessToken: longToken,
      pageAccessToken: longToken, // Same token for Instagram Login flow
      pageId: userId,
      instagramId: userId,
      pageName: profile.username || profile.name || userId,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  },
});
