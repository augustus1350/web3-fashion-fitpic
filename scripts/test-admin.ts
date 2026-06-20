import type { AddressInfo } from "node:net";
import { createApp } from "../src/api/app";
import { ensureDatabaseReady } from "../src/lib/ensureDatabase";
import { submitFitPic, getVotingFeed } from "../src/services/epochService";
import { getOrCreateFrameUser } from "../src/services/frameUserService";

async function post(base: string, path: string, body: unknown) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  await ensureDatabaseReady();

  await getOrCreateFrameUser(42);
  await submitFitPic(
    { farcasterFid: 42, farcasterCastHash: "0xmod_test", imageUrl: "https://images.unsplash.com/photo-x?w=600", hasPhysicalProof: false },
    { enforcePhase: false },
  );

  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  console.log("feed before:", (await getVotingFeed({ limit: 50 })).length);

  const notFounder = await post(base, "/api/admin/remove", { adminFid: 999, castHash: "0xmod_test", reason: "Not a FitPic" });
  console.log("non-founder remove:", notFounder.status, JSON.stringify(notFounder.json.error ?? notFounder.json.data));

  const founder = await post(base, "/api/admin/remove", { adminFid: 1, castHash: "0xmod_test", reason: "Not a FitPic" });
  console.log("founder remove:    ", founder.status, JSON.stringify(founder.json.data ?? founder.json.error));

  console.log("feed after:", (await getVotingFeed({ limit: 50 })).length);

  const adminHtml = await (await fetch(base + "/admin")).text();
  console.log("/admin has Remove UI:", adminHtml.includes("/api/admin/remove") && adminHtml.includes("Moderation"));

  server.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
