import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
  },
  // cubing.js spawns ES module workers for scramble generation.
  worker: {
    format: "es",
  },
});
