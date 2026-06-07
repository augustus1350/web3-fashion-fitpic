import { config as loadEnv } from "dotenv";
import {
  PGLITE_DATA_DIR,
  applyIntegrationModeToEnv,
  canReachPostgres,
  initPgliteDatabase,
  syncPostgresSchema,
  writeIntegrationMode,
} from "./dbMode";

export default async function globalSetup(): Promise<void> {
  loadEnv({ path: ".env" });
  loadEnv({ path: ".env.test" });

  const preferredUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  const preferPostgres = process.env.FORCE_TEST_POSTGRES === "1";
  const strictPostgres = process.env.STRICT_TEST_POSTGRES === "1";
  const reachable = preferredUrl ? await canReachPostgres(preferredUrl) : false;

  if (preferredUrl && reachable) {
    console.log("[integration] Using PostgreSQL:", maskDatabaseUrl(preferredUrl));
    syncPostgresSchema(preferredUrl);

    const config = {
      mode: "postgres" as const,
      databaseUrl: preferredUrl,
    };
    writeIntegrationMode(config);
    applyIntegrationModeToEnv(config);
    return;
  }

  if (preferredUrl && preferPostgres && strictPostgres) {
    throw new Error(
      [
        "STRICT_TEST_POSTGRES=1 but PostgreSQL is unreachable.",
        `Tried: ${maskDatabaseUrl(preferredUrl)}`,
        "Start Docker: npm run test:integration:docker",
        "Or remove STRICT_TEST_POSTGRES to fall back to PGlite.",
      ].join("\n"),
    );
  }

  if (preferredUrl && preferPostgres) {
    console.warn(
      `[integration] PostgreSQL unreachable (${maskDatabaseUrl(preferredUrl)}). Falling back to PGlite.`,
    );
  }

  console.log("[integration] Using embedded PGlite (no Docker required).");
  console.log(`[integration] Data directory: ${PGLITE_DATA_DIR}`);

  await initPgliteDatabase();

  const config = {
    mode: "pglite" as const,
    dataDir: PGLITE_DATA_DIR,
  };
  writeIntegrationMode(config);
  applyIntegrationModeToEnv(config);
}

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return "<invalid-database-url>";
  }
}
