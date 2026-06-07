import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const DEV_PGLITE_DIR = path.join(process.cwd(), ".dev-pglite-data");
const CACHED_SCHEMA_SQL = path.join(process.cwd(), "prisma", "pglite-schema.sql");

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function getPrismaSchemaSql(): string {
  if (existsSync(CACHED_SCHEMA_SQL)) {
    return stripBom(readFileSync(CACHED_SCHEMA_SQL, "utf-8"));
  }

  return stripBom(
    execSync(
      "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
      { encoding: "utf-8" },
    ),
  );
}

export async function applySchemaToPglite(pglite: PGlite): Promise<void> {
  await pglite.exec(getPrismaSchemaSql());
}

function isPgliteCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes("aborted") ||
    msg.includes("unreachable") ||
    msg.includes("runtimeerror")
  );
}

async function pgliteHasSchema(pglite: PGlite): Promise<boolean> {
  try {
    await pglite.query(`SELECT 1 FROM "User" LIMIT 1`);
    return true;
  } catch (error) {
    if (isPgliteCorruptionError(error)) {
      throw error;
    }
    return false;
  }
}

async function openAndEnsureSchema(dataDir: string): Promise<void> {
  mkdirSync(dataDir, { recursive: true });

  const pglite = new PGlite(dataDir);
  try {
    if (!(await pgliteHasSchema(pglite))) {
      console.log(`[db] Applying schema to PGlite (${dataDir})...`);
      await applySchemaToPglite(pglite);
    }
  } finally {
    await pglite.close();
  }
}

/** Creates PGlite data dir and applies Prisma schema if tables are missing. */
export async function ensurePgliteSchema(dataDir: string): Promise<void> {
  try {
    await openAndEnsureSchema(dataDir);
  } catch (error) {
    if (!isPgliteCorruptionError(error)) {
      throw error;
    }

    console.warn("[db] PGlite data corrupted or locked — resetting and retrying...");
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true, force: true });
    }
    await openAndEnsureSchema(dataDir);
  }
}

/** Wipes and recreates a PGlite database (used by integration tests). */
export async function resetPgliteDatabase(dataDir: string): Promise<void> {
  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
  }
  await ensurePgliteSchema(dataDir);
}
