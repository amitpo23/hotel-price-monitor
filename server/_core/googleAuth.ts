/**
 * Google OAuth 2.0 Authentication
 * Replaces Manus OAuth with Google authentication
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Request, Response, NextFunction } from 'express';
import { upsertUser, getUserByOpenId } from '../db';
import { ENV } from './env';

// Google OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '664887167219-edmv61m0o464915fl9r4bheddb9vdtgv.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

/**
 * Configure Passport with Google Strategy
 */
export function configureGoogleAuth() {
  console.log('[GoogleAuth] Configuring with:', {
    clientID: GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
    hasSecret: !!GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL
  });
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Use Google ID as openId
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value || '';
          const name = profile.displayName || '';

          // Upsert user in database
          await upsertUser({
            openId: googleId,
            name,
            email,
            loginMethod: 'google',
            lastSignedIn: new Date(),
          });

          // Get user from database
          const user = await getUserByOpenId(googleId);

          if (!user) {
            return done(new Error('Failed to create user'));
          }

          return done(null, user);
        } catch (error) {
          console.error('[GoogleAuth] Error during authentication:', error);
          return done(error as Error);
        }
      }
    )
  );

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.openId);
  });

  // Deserialize user from session
  passport.deserializeUser(async (openId: string, done) => {
    try {
      const user = await getUserByOpenId(openId);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });
}

/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Get current user from request
 */
export function getCurrentUser(req: Request) {
  return req.user || null;
}
