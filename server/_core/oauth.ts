import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";
const client = new OAuth2Client(ENV.googleClientId, ENV.googleClientSecret, "https://gamingitem-mm.shop/api/auth/callback/google");



export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/callback/google", async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "code is required" });
      return;
    }
    try {
      const { tokens } = await client.getToken(code);
      
      
      
      
      
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: ENV.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        res.status(400).json({ error: "Invalid Google token" });
        return;
      }
      const openId = `google_${payload.sub}`;
      const name = payload.name || payload.email?.split("@")[0] || "Google User";
      const email = payload.email || null;
      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Google callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });
  app.get("/api/oauth/callback", (req, res) => {
     res.redirect(302, "/");
  });
}
