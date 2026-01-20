import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import memoize from "memoizee";
import passport from "passport";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    // Se não houver REPL_ID ou Client ID, retornamos null em vez de estourar erro
    if (!process.env.REPL_ID && !process.env.BLING_CLIENT_ID) {
      console.warn(
        "⚠️ [Auth] REPL_ID ou BLING_CLIENT_ID não configurados. Autenticação desativada."
      );
      return null;
    }

    const issuerUrl =
      process.env.ISSUER_URL &&
      process.env.ISSUER_URL !== "http://127.0.0.1:3000"
        ? process.env.ISSUER_URL
        : "https://replit.com/oidc";

    try {
      return await client.discovery(
        new URL(issuerUrl),
        (process.env.REPL_ID || process.env.BLING_CLIENT_ID)!,
        undefined,
        undefined,
        {
          allowInsecureRequests: true,
        }
      );
    } catch (err) {
      console.error("❌ [Auth] Erro ao conectar com provedor OIDC:", err);
      return null;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);

  // Fallback para session store em memória caso o DB não esteja pronto
  const sessionStore = process.env.DATABASE_URL
    ? new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true, // Alterado para true para facilitar o setup
        ttl: sessionTtl,
        tableName: "sessions",
      })
    : undefined;

  return session({
    secret: process.env.SESSION_SECRET || "zeno-secret-dev",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  // Se a configuração falhar, não registramos as rotas de login
  if (!config) return;

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: (process.env.REPL_ID || process.env.BLING_CLIENT_ID)!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // HACK PARA DESENVOLVIMENTO: Se não houver config de Auth, deixa passar
  const config = await getOidcConfig();
  if (!config) return next();

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
