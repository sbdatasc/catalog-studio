import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    globalSetup: ["tests/integration/helpers/setup.ts"],
    setupFiles: ["tests/integration/helpers/workerSetup.ts"],
    coverage: {
      provider: "v8",
      include: ["artifacts/api-server/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
    alias: {
      "@workspace/db": path.resolve(__dirname, "lib/db/src/index.ts"),
    },
  },
});
