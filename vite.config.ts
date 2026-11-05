import { defineConfig } from "vite";
import { colyseus } from "colyseus/vite";

/** The port the game is served on, in development and in the built server alike. */
const port = Number(process.env.PORT ?? 15100);

// `npm run dev` serves the game and runs the multiplayer server together, on one port.
// `npm run build` then `npm start` does the same from the built files, for a real deploy.
export default defineConfig({
  plugins: [colyseus({ serverEntry: "./src/server/main.ts", serveClient: true, port })],
  server: {
    host: "0.0.0.0",
    port,
    allowedHosts: [".hunter.cryptograss.live"],
  },
  build: { target: "es2022" },
});
