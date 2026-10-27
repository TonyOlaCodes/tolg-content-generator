/**
 * All-in-one server: serves the Next.js client and hosts the realtime game
 * server on the same origin and port, so `npm run dev` gives you a single URL
 * that friends can open on a phone.
 *
 * In production this same file serves the built Next.js app (`npm start`,
 * `NODE_ENV=production`) which is what the Dockerfile runs.
 */

import { createServer } from "node:http";
import next from "next";
import { attachGameServer } from "./server/index";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  // Next only hands out its upgrade handler once it is prepared; in development it
  // carries hot reload on the same socket.
  const upgradeHandler =
    typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;

  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      console.error("[web] request failed", error);
      response.statusCode = 500;
      response.end("Internal error");
    });
  });

  const { manager } = attachGameServer(server);

  // Next.js needs to see its own upgrades (hot reload in development); the game
  // socket took /ws for itself inside attachGameServer.
  server.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/ws")) return;
    if (!upgradeHandler) {
      socket.destroy();
      return;
    }
    upgradeHandler(request, socket, head).catch(() => socket.destroy());
  });

  server.listen(port, hostname, () => {
    console.log(`[elephant] ready on http://${hostname}:${port} (game socket ws://${hostname}:${port}/ws)`);
  });

  const shutdown = (): void => {
    console.log("[elephant] shutting down");
    const stats = manager.stats();
    console.log(`[elephant] closing ${stats.rooms} room(s) with ${stats.players} player(s)`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error: unknown) => {
  console.error("[elephant] failed to start", error);
  process.exit(1);
});
