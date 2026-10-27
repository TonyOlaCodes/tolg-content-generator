/**
 * Standalone game server: HTTP health endpoint plus the WebSocket game endpoint.
 * Use this when you want the realtime half on its own host (Render, Railway, Fly,
 * a VPS) with the Next.js client on Vercel.
 *
 *   npm run dev:game      # tsx server/index.ts (port 3001)
 */

import { createServer } from "node:http";
import { SERVER_PORT } from "../game/config";
import { attachGameServer } from "./index";

const server = createServer((request, response) => {
  if (request.url?.startsWith("/health")) {
    const stats = statsReader?.() ?? { rooms: 0, players: 0, playing: 0 };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "elephant-in-the-room", ...stats }));
    return;
  }
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("Elephant in the Room game server. Connect a WebSocket to /ws.\n");
});

const { manager } = attachGameServer(server);
const statsReader = (): { rooms: number; players: number; playing: number } => manager.stats();

const port = Number(process.env.PORT ?? SERVER_PORT);
server.listen(port, "0.0.0.0", () => {
  console.log(`[elephant] game server listening on 0.0.0.0:${port} (websocket path /ws)`);
});

const shutdown = (): void => {
  console.log("[elephant] shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
