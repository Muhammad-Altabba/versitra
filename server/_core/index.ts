import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import session from "express-session";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import gitOAuthRouter from "./gitOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { upsertUser } from "../db";
import { sdk } from "./sdk";
import * as jose from "jose";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Session middleware for OAuth state management
  app.use(
    session({
      secret: ENV.cookieSecret,
      resave: false,
      saveUninitialized: true, // Changed to true to ensure session is created
      cookie: {
        secure: ENV.isProduction,
        httpOnly: true,
        sameSite: ENV.isProduction ? 'none' : 'lax', // Allow cross-site for OAuth
        maxAge: 1000 * 60 * 15, // 15 minutes
      },
      proxy: true, // Trust proxy headers in production
    })
  );
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // OAuth callback under /api/oauth/callback (Manus OAuth)
  registerOAuthRoutes(app);
  
  // Git OAuth routes (GitHub & GitLab)
  app.use('/api', gitOAuthRouter);
  
  // Test-only REST login endpoint (only in test/CI mode)
  const isTestMode = process.env.NODE_ENV === "test" || process.env.CI === "true";
  if (isTestMode) {
    app.post('/api/test-login', async (req, res) => {
      try {
        const { userId = 'test-user-id', name = 'Test User', email = 'test@example.com', role = 'user' } = req.body || {};
        
        // Create or update test user in database
        await upsertUser({
          id: userId,
          name,
          email,
          role,
          loginMethod: 'test',
          lastSignedIn: new Date(),
        });
        
        // Create simple JWT token for test mode (bypasses Manus SDK)
        const secret = new TextEncoder().encode(ENV.cookieSecret);
        const token = await new jose.SignJWT({ 
          sub: userId, 
          name, 
          email, 
          role 
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('1y')
          .sign(secret);
        
        // Set session cookie
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, token, cookieOptions);
        
        res.json({ success: true, user: { id: userId, name, email, role } });
      } catch (error) {
        console.error('Test login error:', error);
        res.status(500).json({ error: 'Test login failed', details: String(error) });
      }
    });
    console.log('[Test Mode] REST test login endpoint enabled at /api/test-login');
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
