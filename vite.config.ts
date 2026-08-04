import { defineConfig } from "vite";
import type { Plugin } from "vite";

// Vite serves everything in public/ with "Cache-Control: no-cache", which is the
// right default for source you are editing and the wrong one for 8727 map tiles
// that never change. Without this every tile re-request is a fresh 200 over the
// network, so zooming and panning around amplified 117 needed tiles into 1884
// requests, all queued behind the browser's six connections per host. The tiles
// are immutable for a given VERSION, so they are safe to pin.
function cacheFetchedData(): Plugin {
  const header = (req: { url?: string }, res: { setHeader(k: string, v: string): void }) => {
    if (req.url && /^\/(tiles|tiles-clean|mapicons)\//.test(req.url)) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    }
  };
  return {
    name: "cache-fetched-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        header(req, res);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        header(req, res);
        next();
      });
    },
  };
}

// Port 5173 is Vite's default, so it collides with every other Vite project
// running at the same time. Pinned to 5273 to stay out of their way.
//
// strictPort matters as much as the number: without it Vite silently moves to
// the next free port when 5273 is taken, and you end up looking at a stale
// build on the old one wondering why your change did nothing.
export default defineConfig({
  plugins: [cacheFetchedData()],
  server: {
    port: 5273,
    strictPort: true,
  },
  preview: {
    port: 5274,
    strictPort: true,
  },
});
