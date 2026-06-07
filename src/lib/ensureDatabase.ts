import { config as loadEnv } from "dotenv";
import { DEV_PGLITE_DIR, ensurePgliteSchema } from "./pgliteSchema";
import { canReachPostgres } from "./postgres";

/**
 * Prepares the database before `npm run dev` or `npm run db:seed`.
 * Uses PostgreSQL when reachable; otherwise falls back to embedded PGlite.
 */
export async function ensureDatabaseReady(): Promise<void> {
  loadEnv({ path: ".env" });

  const databaseUrl = process.env.DATABASE_URL;
  const usePglite = process.env.USE_PGLITE === "1";

  if (usePglite) {
    const dataDir = process.env.PGLITE_DATA_DIR ?? DEV_PGLITE_DIR;
    process.env.PGLITE_DATA_DIR = dataDir;
    process.env.USE_PGLITE = "1";
    await ensurePgliteSchema(dataDir);
    console.log(`[db] Using PGlite at ${dataDir}`);
    return;
  }

  if (databaseUrl && (await canReachPostgres(databaseUrl))) {
    console.log("[db] Using PostgreSQL");
    return;
  }

  console.log(
    "[db] PostgreSQL unavailable at DATABASE_URL — using embedded PGlite (no Docker required).",
  );
  console.log("[db] Tip: run `docker compose up -d` for real PostgreSQL.");

  process.env.USE_PGLITE = "1";
  process.env.PGLITE_DATA_DIR = DEV_PGLITE_DIR;
  await ensurePgliteSchema(DEV_PGLITE_DIR);
}
