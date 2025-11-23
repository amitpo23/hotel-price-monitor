// server/_core/googleAuth.ts
/**
 * Google OAuth 2.0 Authentication
 * Replaces Manus OAuth with Google OAuth for independent authentication
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Request, Response, NextFunction } from 'express';
import { upsertUser, getUserByOpenId } from '../db';
import { ENV } from './env';

// Google OAuth credentials from ENV
const GOOGLE_CLIENT_ID = ENV.googleClientId || '664887167219-edmv61m0o464915fl9r4bheddb9vdtgv.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = ENV.googleClientSecret || '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';
const GOOGLE_CALLBACK_URL = ENV.googleCallbackUrl || 'http://localhost:3000/api/auth/google/callback';

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
          const loginMethod = 'google';

          // Upsert user in database
          await upsertUser({
            openId: googleId,
            email,
            name,
            loginMethod,
            lastSignedIn: new Date(),
          });

          // Fetch user from database
          const user = await getUserByOpenId(googleId);
          
          if (!user) {
            return done(new Error('Failed to create/fetch user'));
          }

          return done(null, user);
        } catch (error) {
          console.error('[GoogleAuth] Error in strategy callback:', error);
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
 * Register Google OAuth routes
 */
export function registerGoogleAuthRoutes(app: any) {
  // Initiate Google OAuth flow
  app.get('/api/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
  }));

  // Google OAuth callback
  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
    (req: Request, res: Response) => {
      // Successful authentication, redirect to home
      res.redirect('/');
    }
  );

  // Get current user
  app.get('/api/auth/me', (req: Request, res: Response) => {
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });
}
