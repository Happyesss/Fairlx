/**
 * Custom Next.js Server with Socket.IO
 * 
 * This file creates a custom HTTP server that runs both Next.js and Socket.IO.
 * Required because Next.js doesn't natively support WebSocket servers.
 * 
 * USAGE:
 * Replace `npm run dev` with `npx ts-node --project tsconfig.server.json server.ts`
 * Or for production: `node server.js` (after compiling)
 * 
 * NOTE: This is OPTIONAL. The app works without it using polling/Appwrite Realtime.
 * Only needed if you want true dedicated WebSocket push notifications.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createServer, IncomingMessage, ServerResponse } from "http";
import next from "next";
import { initSocketServer, emitToUser } from "./src/lib/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// SECURITY: Internal secret for socket push endpoint
// In development: uses default value for contributor convenience
// In production: REQUIRED - must be set as environment variable
const DEV_DEFAULT_SECRET = "dev-socket-secret-not-for-production";
const SOCKET_PUSH_SECRET = process.env.SOCKET_PUSH_SECRET || (dev ? DEV_DEFAULT_SECRET : undefined);

if (!SOCKET_PUSH_SECRET) {
    console.error("FATAL: SOCKET_PUSH_SECRET environment variable is not set.");
    console.error("This secret is required in production to secure the internal socket push endpoint.");
    console.error("Generate a secure random string and set it in your environment.");
    process.exit(1);
}

if (dev && SOCKET_PUSH_SECRET === DEV_DEFAULT_SECRET) {
    console.warn("⚠️  Using default SOCKET_PUSH_SECRET for development. Do NOT use in production!");
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * Handle internal socket push endpoint
 * POST /internal/socket-push
 * Body: { userId, payload, secret }
 */
async function handleInternalPush(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (req.method !== "POST" || !req.url?.startsWith("/internal/socket-push")) {
        return false; // Not handled
    }

    try {
        // Read body
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());

        // Validate secret
        if (body.secret !== SOCKET_PUSH_SECRET) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return true;
        }

        const { userId, payload } = body;

        if (!userId || !payload) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing userId or payload" }));
            return true;
        }

        // Emit to user via socket
        emitToUser(userId, payload);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return true;
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal error" }));
        return true;
    }
}

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        // Handle internal push endpoint first
        const handled = await handleInternalPush(req, res);
        if (handled) return;

        handle(req, res);
    });

    // Initialize Socket.IO
    initSocketServer(httpServer);

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Socket.IO ready on /api/socket`);
        console.log(`> Internal push endpoint: /internal/socket-push`);
    });
});
