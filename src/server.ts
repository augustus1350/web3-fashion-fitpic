import { createApp } from "./api/app";
import { env } from "./config/env";
import { ensureDatabaseReady } from "./lib/ensureDatabase";
import { disconnectPrisma } from "./lib/prisma";

async function main() {
  await ensureDatabaseReady();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`FitPic API listening on http://localhost:${env.port}`);
    console.log(`Founder FIDs: ${env.founderFids.join(", ")}`);
    if (env.appUrl) {
      console.log(`Public URL: ${env.appUrl}`);
      console.log(`Frame URL: ${env.appUrl}/frames`);
      console.log(`Embed test: ${env.appUrl}`);
    }
  });

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} — closing database...`);
    server.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (error) => {
  console.error(error);
  await disconnectPrisma();
  process.exit(1);
});
