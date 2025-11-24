import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// Check if Google OAuth is configured
function isGoogleOAuthConfigured(): boolean {
  return !!(ENV.googleClientId && ENV.googleClientSecret);
}

// Exchange Google authorization code for tokens
async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ access_token: string; id_token?: string }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  return response.json();
}

// Get user info from Google
async function getGoogleUserInfo(accessToken: string): Promise<{ sub: string; email: string; name: string; picture?: string }> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to get Google user info");
  }

  return response.json();
}

export function registerOAuthRoutes(app: Express) {
  // Google OAuth login redirect
  app.get("/api/oauth/google", (req: Request, res: Response) => {
    if (!isGoogleOAuthConfigured()) {
      res.status(500).json({ error: "Google OAuth not configured" });
      return;
    }

    const redirectUri = ENV.googleCallbackUrl || `${req.protocol}://${req.get("host")}/api/oauth/google/callback`;
    const state = Buffer.from(JSON.stringify({ provider: "google", returnUrl: "/" })).toString("base64");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", ENV.googleClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    res.redirect(authUrl.toString());
  });

  // Google OAuth callback
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    if (error) {
      console.error("[Google OAuth] Error:", error);
      res.redirect("/?error=oauth_failed");
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code required" });
      return;
    }

    try {
      const redirectUri = ENV.googleCallbackUrl || `${req.protocol}://${req.get("host")}/api/oauth/google/callback`;
      const tokens = await exchangeGoogleCode(code, redirectUri);
      const googleUser = await getGoogleUserInfo(tokens.access_token);

      // Use Google sub (subject) as openId
      const openId = `google_${googleUser.sub}`;

      await db.upsertUser({
        openId,
        name: googleUser.name || null,
        email: googleUser.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleUser.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (err) {
      console.error("[Google OAuth] Callback failed:", err);
      res.redirect("/?error=oauth_failed");
    }
  });

  // Original Manus OAuth callback (keep for backward compatibility)
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // Auth status endpoint
  app.get("/api/oauth/status", (req: Request, res: Response) => {
    res.json({
      googleOAuth: isGoogleOAuthConfigured(),
      manusOAuth: !!(ENV.oAuthServerUrl && ENV.appId),
    });
  });
}
