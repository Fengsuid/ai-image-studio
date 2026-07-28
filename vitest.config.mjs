import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/**/*.test.js",
      "packages/agent-core/src/**/*.test.js",
      "packages/canvas-core/tests/**/*.test.js"
    ]
  }
});
