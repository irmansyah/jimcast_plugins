import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base — the built assets are served from the
// jimcast-plugin://<plugin>/ custom protocol, not from a normal domain
// root, so absolute "/" paths would resolve wrong.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
