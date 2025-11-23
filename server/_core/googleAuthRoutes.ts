/**
 * Google OAuth Routes
 * Handles Google authentication flow
 */

import type { Express, Request, Response } from 'express';
import passport from 'passport';

export function registerGoogleAuthRoutes(app: Express) {
  // Initiate Google OAuth flow
  app.get(
    '/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  // Google OAuth callback
  app.get(
    '/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
    (req: Request, res: Response) => {
      // Successful authentication, redirect to home
      res.redirect('/');
    }
  );

  // Logout route
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // Get current user
  app.get('/api/auth/me', (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });
}
