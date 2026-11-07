import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**", "**/liquid-glass-react-master/**"] }
  },
  build: {
    target: "chrome110",
    rollupOptions: {
      input: {
        widget: resolve(dirname, "index.html"),
        settings: resolve(dirname, "settings.html")
      }
    }
  }
});
