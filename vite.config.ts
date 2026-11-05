import { defineConfig } from "vite";
import { colyseus } from "colyseus/vite";

// One command (`npm run dev`) serves the game and runs the multiplayer server
// together, on one port.
export default defineConfig({
  plugins: [colyseus({ serverEntry: "./src/server/main.ts" })],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 15100),
    allowedHosts: [".hunter.cryptograss.live"],
  },
  build: { target: "es2022" },
});
