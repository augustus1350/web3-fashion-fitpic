import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.test" });

const pgliteDataDir = path.join(process.cwd(), ".test-pglite-data");

// Default to PGlite in workers; globalSetup writes .integration-test-mode.json
// and setup.ts applies the final mode before tests run.
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./src/__tests__/integration/setup.ts"],
    globalSetup: ["./src/__tests__/integration/globalSetup.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      NODE_ENV: "test",
      USE_PGLITE: "1",
      PGLITE_DATA_DIR: pgliteDataDir,
      DATABASE_URL: "",
      FOUNDER_FIDS: process.env.FOUNDER_FIDS ?? "1",
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
