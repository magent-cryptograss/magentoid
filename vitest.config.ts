import { defineConfig } from "vitest/config";

// Tests only need the rules, so they skip vite.config.ts and its game server.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
