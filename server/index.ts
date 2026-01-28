import "dotenv/config"; // Carrega as variáveis do .env logo no início
import express, { NextFunction, type Request, Response } from "express";
import { createServer } from "http";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { seedSuperAdmin } from "./scripts/seedSuperAdmin";
import { initializeBlingTokens } from "./services/bling";
import { serveStatic } from "./static";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ✅ CORREÇÃO AQUI: Aumentamos o limite para 50MB para aceitar fotos
app.use(
  express.json({
    limit: "50mb", // Permite JSONs grandes (fotos em Base64)
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" })); // Limite aqui também

app.get("/health/db", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("[DB HEALTH]", error);
    res.status(500).json({
      status: "error",
      message: "database not connected",
    });
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Evita logar o base64 gigante da imagem para não poluir o terminal
        const logData = { ...capturedJsonResponse };
        if (logData.logoUrl && logData.logoUrl.length > 100) {
          logData.logoUrl = "[BASE64 IMAGE HIDDEN]";
        }
        logLine += ` :: ${JSON.stringify(logData)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // 1. Registrar rotas (Isso vai chamar o replitAuth que já corrigimos)
  await registerRoutes(httpServer, app);

  // 2. Seed SUPER_ADMIN
  try {
    await seedSuperAdmin();
  } catch (error) {
    console.error("[SEED] Failed to seed SUPER_ADMIN:", error);
  }

  // 3. Initialize Bling tokens
  try {
    const blingInitialized = await initializeBlingTokens();
    if (blingInitialized) {
      console.log("[Bling] Connection restored from database");
    } else {
      console.log("[Bling] No saved connection found - authorization required");
    }
  } catch (error) {
    console.error("[Bling] Failed to initialize tokens:", error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    // Removido o throw err para evitar crash no Windows em loops de erro
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  // CORREÇÃO PARA WINDOWS: Removido reusePort que causa o erro Assertion Failed
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
