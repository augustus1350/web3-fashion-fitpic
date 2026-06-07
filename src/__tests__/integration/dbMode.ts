import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resetPgliteDatabase } from "../../lib/pgliteSchema";
import { canReachPostgres } from "../../lib/postgres";

export const INTEGRATION_MODE_FILE = path.join(
  process.cwd(),
  ".integration-test-mode.json",
);
export const PGLITE_DATA_DIR = path.join(process.cwd(), ".test-pglite-data");

export type IntegrationDbMode = "postgres" | "pglite";

export interface IntegrationDbModeConfig {
  mode: IntegrationDbMode;
  dataDir?: string;
  databaseUrl?: string;
}

export { canReachPostgres };

export async function initPgliteDatabase(): Promise<void> {
  await resetPgliteDatabase(PGLITE_DATA_DIR);
}

export function syncPostgresSchema(databaseUrl: string): void {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}

export function writeIntegrationMode(config: IntegrationDbModeConfig): void {
  writeFileSync(INTEGRATION_MODE_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function readIntegrationMode(): IntegrationDbModeConfig | null {
  if (!existsSync(INTEGRATION_MODE_FILE)) {
    return null;
  }

  return JSON.parse(readFileSync(INTEGRATION_MODE_FILE, "utf-8")) as IntegrationDbModeConfig;
}

export function applyIntegrationModeToEnv(
  config: IntegrationDbModeConfig,
): void {
  if (config.mode === "pglite") {
    process.env.USE_PGLITE = "1";
    process.env.PGLITE_DATA_DIR = config.dataDir ?? PGLITE_DATA_DIR;
    return;
  }

  process.env.USE_PGLITE = "0";
  if (config.databaseUrl) {
    process.env.DATABASE_URL = config.databaseUrl;
  }
}
