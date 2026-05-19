import { Router } from 'express';
import passport from 'passport';

const router = Router();

router.get('/discord', passport.authenticate('discord'));

router.get(
  '/discord/callback',
  passport.authenticate('discord', { 
    failureRedirect: '/login?error=auth_failed', 
    keepSessionInfo: true
  }),
  async (req, res) => {
    try {
      const returnTo = req.session?.returnTo || '/dashboard';
      if (req.session) {
        delete req.session.returnTo;
      }

      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect(returnTo);
      });
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect('/login?error=auth_failed');
    }
  }
);

export default router;