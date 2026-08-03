import { defineConfig } from "vite";

// Port 5173 is Vite's default, so it collides with every other Vite project
// running at the same time. Pinned to 5273 to stay out of their way.
//
// strictPort matters as much as the number: without it Vite silently moves to
// the next free port when 5273 is taken, and you end up looking at a stale
// build on the old one wondering why your change did nothing.
export default defineConfig({
  server: {
    port: 5273,
    strictPort: true,
  },
  preview: {
    port: 5274,
    strictPort: true,
  },
});
