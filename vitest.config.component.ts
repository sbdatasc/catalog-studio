import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "component",
    environment: "jsdom",
    include: ["artifacts/studio/src/**/*.test.tsx", "artifacts/studio/src/**/*.test.ts"],
    globals: true,
    setupFiles: ["artifacts/studio/src/tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["artifacts/studio/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/tests/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "artifacts/studio/src"),
    },
  },
});
