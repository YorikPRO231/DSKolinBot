import passport from 'passport';
import { Strategy as DiscordStrategy, Profile } from 'passport-discord';
import { Request } from 'express';

interface ExtendedProfile extends Profile {
  accessToken?: string;
}

export function setupPassport() {
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((obj, done) => {
    done(null, obj as any);
  });

  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.CLIENT_ID || "",
        clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
        callbackURL: `${process.env.DASHBOARD_URL}/auth/discord/callback`,
        scope: ["identify", "guilds", "guilds.members.read"],
      },
      (
        accessToken: string,
        refreshToken: string,
        profile: ExtendedProfile,
        done: (err: any, user?: any) => void,
      ) => {
        profile.accessToken = accessToken;
        return done(null, profile);
      },
    ),
  );

  return passport;
}