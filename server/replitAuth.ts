import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import memoize from "memoizee";
import * as client from "openid-client";
import passport from "passport";

const getOidcConfig = memoize(
  async () => {
    // No Railway, se AUTH_STRATEGY for local, ignoramos OIDC para evitar erro 502/500
    if (process.env.AUTH_STRATEGY === "local") return null;

    if (!process.env.REPL_ID && !process.env.BLING_CLIENT_ID) {
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
        { allowInsecureRequests: true }
      );
    } catch (err) {
      console.error("❌ [Auth] Erro OIDC (Ignorado em modo Local):", err);
      return null;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);

  const sessionStore = process.env.DATABASE_URL
    ? new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        ttl: sessionTtl / 1000,
        tableName: "sessions",
      })
    : undefined;

  return session({
    secret: process.env.SESSION_SECRET || "zeno-secret-dev",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      // MODIFICAÇÃO AQUI: Garante que funcione em HTTP (localhost)
      secure: false,
      // MODIFICAÇÃO AQUI: 'lax' funciona melhor que 'none' para evitar bloqueios localmente
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  // Configuração crítica para Railway reconhecer o HTTPS vindo do Edge
  app.set("trust proxy", 1);

  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  const config = await getOidcConfig();
  if (!config) return;

  // ... (Restante da lógica OIDC mantida apenas como fallback)
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
