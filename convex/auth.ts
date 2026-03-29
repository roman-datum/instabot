"use node";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
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

// Step 1: Exchange FB code → save session with available pages (don't connect yet)
export const exchangeAndSaveFb = internalAction({
  args: { code: v.string(), workspaceId: v.optional(v.string()) },
  handler: async (ctx, { code, workspaceId }): Promise<{ type: "connected"; count: number } | { type: "select"; sessionId: string }> => {
    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;

    const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(FB_CALLBACK_URL)}&client_secret=${appSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(`FB token exchange failed: ${JSON.stringify(tokenData)}`);

    const longRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`);
    const longData = await longRes.json();
    const longUserToken = longData.access_token || tokenData.access_token;

    // Check granted permissions
    const permsRes = await fetch(`https://graph.facebook.com/v25.0/me/permissions?access_token=${longUserToken}`);
    const permsData = await permsRes.json();
    console.log("FB Permissions:", JSON.stringify(permsData));

    // Get ALL pages with pagination
    let allPages: any[] = [];
    let pagesUrl: string | null = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&limit=100&access_token=${longUserToken}`;
    let rawFirstResponse: any = null;
    while (pagesUrl) {
      const pagesRes: Response = await fetch(pagesUrl);
      const pagesData: any = await pagesRes.json();
      if (!rawFirstResponse) rawFirstResponse = pagesData;
      if (pagesData.data?.length) allPages.push(...pagesData.data);
      pagesUrl = pagesData.paging?.next || null;
    }

    // Filter pages with Instagram accounts
    const igPages = allPages.filter((p: any) => p.instagram_business_account).map((p: any) => ({
      pageId: String(p.id),
      pageName: String(p.name || p.id),
      pageToken: String(p.access_token),
      igId: String(p.instagram_business_account.id),
      igUsername: String(p.instagram_business_account.username || p.instagram_business_account.name || p.instagram_business_account.id),
    }));

    const grantedPerms = (permsData.data || []).filter((p: any) => p.status === "granted").map((p: any) => p.permission).join(",");
    await ctx.runMutation(internal.mutations.addLog, {
      clientInstagramId: "auth", eventType: "fb_auth_pages",
      message: `perms=[${grantedPerms}] raw_data_len=${rawFirstResponse?.data?.length ?? "null"} pages=${allPages.length} ig=${igPages.length}: ${igPages.map(p => `@${p.igUsername}`).join(", ").slice(0, 100)}`,
    });
    // DEBUG: log full raw response and token prefix
    await ctx.runMutation(internal.mutations.addLog, {
      clientInstagramId: "auth", eventType: "fb_auth_debug",
      message: `token_prefix=${longUserToken.slice(0, 20)} raw=${JSON.stringify(rawFirstResponse).slice(0, 500)}`,
    });

    if (igPages.length === 0) {
      if (allPages.length === 0) {
        throw new Error("Facebook не вернул ни одной страницы. Выберите конкретные страницы в диалоге Facebook вместо «все текущие и будущие».");
      }
      const pageNames = allPages.map((p: any) => p.name).join(", ");
      throw new Error(`К страницам (${pageNames}) не привязан Instagram Business. Привяжите Instagram к Facebook-странице.`);
    }

    // If only 1 page with IG — connect directly (no need for selector)
    if (igPages.length === 1) {
      const p = igPages[0];
      const subRes = await fetch(`https://graph.facebook.com/v25.0/${p.pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${p.pageToken}`, { method: "POST" });
      const subData = await subRes.json();
      console.log(`Webhook sub for ${p.igUsername}:`, JSON.stringify(subData));
      await ctx.runMutation(internal.mutations.internalSaveIntegration, {
        accessToken: p.pageToken, pageAccessToken: p.pageToken,
        pageId: p.pageId, instagramId: p.igId, igBusinessId: p.igId,
        pageName: p.igUsername, expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
        workspaceId: workspaceId as any || undefined,
      });
      return { type: "connected" as const, count: 1 };
    }

    // Multiple pages — save session for frontend picker
    const sessionId = await ctx.runMutation(internal.mutations.saveFbAuthSession, {
      userToken: longUserToken, pages: igPages,
      workspaceId: workspaceId as any || undefined,
    });
    return { type: "select" as const, sessionId };
  },
});

// Step 2: Connect selected pages from the session
export const connectSelectedFbPages = internalAction({
  args: { sessionId: v.id("fbAuthSessions"), selectedIgIds: v.array(v.string()) },
  handler: async (ctx, { sessionId, selectedIgIds }) => {
    const session = await ctx.runQuery(internal.queries.getFbAuthSession, { sessionId });
    if (!session || session.expiresAt < Date.now()) throw new Error("Session expired. Please reconnect via Facebook.");

    let connectedCount = 0;
    for (const page of session.pages) {
      if (!selectedIgIds.includes(page.igId)) continue;

      const subRes = await fetch(`https://graph.facebook.com/v25.0/${page.pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${page.pageToken}`, { method: "POST" });
      const subData = await subRes.json();
      console.log(`Webhook sub for ${page.igUsername}:`, JSON.stringify(subData));

      await ctx.runMutation(internal.mutations.internalSaveIntegration, {
        accessToken: page.pageToken, pageAccessToken: page.pageToken,
        pageId: page.pageId, instagramId: page.igId, igBusinessId: page.igId,
        pageName: page.igUsername, expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
        workspaceId: session.workspaceId || undefined,
      });
      connectedCount++;
    }

    // Clean up session
    await ctx.runMutation(internal.mutations.deleteFbAuthSession, { sessionId });

    await ctx.runMutation(internal.mutations.addLog, {
      clientInstagramId: "auth", eventType: "fb_auth_result",
      message: `Connected ${connectedCount} selected pages`,
    });

    if (connectedCount === 0) throw new Error("No pages selected");
    return connectedCount;
  },
});

// Public action: called from frontend to connect selected pages
export const connectFbPages = action({
  args: { sessionId: v.id("fbAuthSessions"), selectedIgIds: v.array(v.string()) },
  handler: async (ctx, args): Promise<number> => {
    return await ctx.runAction(internal.auth.connectSelectedFbPages, args) as number;
  },
});
