import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "unit",
    environment: "node",
    include: ["artifacts/api-server/src/**/*.unit.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["artifacts/api-server/src/**/*.ts"],
      exclude: ["**/*.unit.test.ts", "**/*.test.ts"],
    },
    alias: {
      "@workspace/db": path.resolve(__dirname, "lib/db/src/index.ts"),
    },
  },
});
