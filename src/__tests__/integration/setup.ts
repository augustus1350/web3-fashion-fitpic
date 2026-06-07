import { existsSync } from "node:fs";
import { beforeEach } from "vitest";
import {
  INTEGRATION_MODE_FILE,
  PGLITE_DATA_DIR,
  applyIntegrationModeToEnv,
  readIntegrationMode,
} from "./dbMode";

if (existsSync(INTEGRATION_MODE_FILE)) {
  const mode = readIntegrationMode();
  if (mode) {
    applyIntegrationModeToEnv(mode);
  }
} else {
  process.env.USE_PGLITE = "1";
  process.env.PGLITE_DATA_DIR = PGLITE_DATA_DIR;
  delete process.env.DATABASE_URL;
}

beforeEach(async () => {
  const { resetDatabase } = await import("./helpers/db");
  await resetDatabase();
});
