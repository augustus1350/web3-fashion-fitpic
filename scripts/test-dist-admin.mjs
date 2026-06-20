import { createApp } from "../dist/api/app.js";
import { ensureDatabaseReady } from "../dist/lib/ensureDatabase.js";
import { submitFitPic } from "../dist/services/epochService.js";
import { getOrCreateFrameUser } from "../dist/services/frameUserService.js";
import { env } from "../dist/config/env.js";

async function post(base, path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

await ensureDatabaseReady();
console.log("env.founderFids =", JSON.stringify(env.founderFids));

await getOrCreateFrameUser(42);
await submitFitPic(
  { farcasterFid: 42, farcasterCastHash: "0xdist_test", imageUrl: "https://x/y.jpg", hasPhysicalProof: false },
  { enforcePhase: false },
);

const app = createApp();
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

console.log("non-founder:", JSON.stringify(await post(base, "/api/admin/remove", { adminFid: 999, castHash: "0xdist_test", reason: "abc" })));
console.log("founder    :", JSON.stringify(await post(base, "/api/admin/remove", { adminFid: 1, castHash: "0xdist_test", reason: "abc" })));

server.close();
process.exit(0);
