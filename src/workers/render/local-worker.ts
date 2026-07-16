/**
 * Local FFmpeg render worker stub (Phase 4).
 * Polls / receives RenderJob rows and produces Instagram Reels.
 * Isolated from the Vercel frontend deployment.
 */
import "dotenv/config";

console.log(
  "[tolg-render-worker] Local worker entrypoint ready. Full FFmpeg pipeline lands in Phase 4.",
);
console.log(
  "Set RENDER_WORKER_URL / RENDER_WORKER_SECRET and run: npm run worker:render",
);

process.exit(0);
