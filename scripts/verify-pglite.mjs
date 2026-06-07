import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PrismaClient } from "@prisma/client";
import { PrismaPGlite } from "pglite-prisma-adapter";

const dataDir = ".test-pglite-verify";

rmSync(dataDir, { recursive: true, force: true });

const pglite = new PGlite(dataDir);
const sql = execSync(
  "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
  { encoding: "utf-8" },
);
await pglite.exec(sql);

const prisma = new PrismaClient({
  adapter: new PrismaPGlite(pglite),
});

await prisma.user.create({ data: { farcasterFid: 99 } });
const count = await prisma.user.count();
console.log("PGlite + Prisma OK, user count:", count);

await prisma.$disconnect();
await pglite.close();
