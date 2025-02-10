import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Enables Jest-like global functions (e.g., `describe`, `it`, `expect`)
    environment: "node", // Ensures tests run in a Node.js environment
    coverage: {
      reporter: ["text", "lcov"], // Enables coverage reports
      include: ["src/**/*.ts"], // Targets only source files
    },
  },
});
