import { PGlite } from "@electric-sql/pglite";
import { PrismaClient } from "@prisma/client";
import { PrismaPGlite } from "pglite-prisma-adapter";

type PrismaGlobal = {
  prisma?: PrismaClient;
  pglite?: PGlite;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

function createPrismaClient(): PrismaClient {
  if (process.env.USE_PGLITE === "1") {
    const dataDir = process.env.PGLITE_DATA_DIR ?? ".dev-pglite-data";

    if (!globalForPrisma.pglite) {
      globalForPrisma.pglite = new PGlite(dataDir);
    }

    return new PrismaClient({
      // pglite-prisma-adapter ships its own driver-adapter-utils types
      adapter: new PrismaPGlite(globalForPrisma.pglite) as never,
      log: ["error"],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazy proxy so integration tests can set USE_PGLITE before the first query.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }

  if (globalForPrisma.pglite) {
    await globalForPrisma.pglite.close();
    globalForPrisma.pglite = undefined;
  }
}
