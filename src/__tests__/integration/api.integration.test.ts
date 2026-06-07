import { EpochPhase, UserTier } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../api/app";
import {
  createEpoch,
  createSubmission,
  createTestUser,
  disconnectTestDb,
} from "./helpers/db";

const app = createApp();

async function seedApiFixtures() {
  await createTestUser({ farcasterFid: 1, tier: UserTier.ELITE_CURATOR });
  const author = await createTestUser({ farcasterFid: 20001, tier: UserTier.ROOKIE });
  await createTestUser({
    farcasterFid: 20002,
    tier: UserTier.VERIFIED_CREATOR,
  });
  const epoch = await createEpoch(EpochPhase.VOTING);

  await createSubmission({
    userId: author.id,
    epochId: epoch.id,
    castHash: "0xapi_vote_target",
    totalVotes: 1,
  });
}

afterAll(async () => {
  await disconnectTestDb();
});

describe("HTTP API integration", () => {
  beforeEach(async () => {
    await seedApiFixtures();
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/epoch/current returns active epoch", async () => {
    const res = await request(app).get("/api/epoch/current");
    expect(res.status).toBe(200);
    expect(res.body.data.phase).toBe(EpochPhase.VOTING);
  });

  it("GET /api/users/:fid returns user profile", async () => {
    const res = await request(app).get("/api/users/20001");
    expect(res.status).toBe(200);
    expect(res.body.data.farcasterFid).toBe(20001);
    expect(res.body.data.tier).toBe(UserTier.ROOKIE);
  });

  it("POST /api/votes casts a vote and returns rewards", async () => {
    const res = await request(app)
      .post("/api/votes")
      .send({ voterFid: 20002, castHash: "0xapi_vote_target" });

    expect(res.status).toBe(201);
    expect(res.body.data.voteCountAtTimeOfVoting).toBe(1);
    expect(res.body.data.reputationReward).toBeGreaterThan(0);
  });

  it("POST /api/votes returns structured error for duplicate vote", async () => {
    await request(app)
      .post("/api/votes")
      .send({ voterFid: 20002, castHash: "0xapi_vote_target" })
      .expect(201);

    const res = await request(app)
      .post("/api/votes")
      .send({ voterFid: 20002, castHash: "0xapi_vote_target" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_VOTE");
  });

  it("GET /api/feed returns submissions with meta", async () => {
    const res = await request(app).get("/api/feed").query({ limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta.rookieQuota).toBe(0.2);
  });

  it("POST /api/submissions validates request body", async () => {
    const res = await request(app).post("/api/submissions").send({
      farcasterFid: 20001,
      farcasterCastHash: "0xbad",
      imageUrl: "not-a-url",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_INPUT");
  });

  it("POST /api/admin/airdrop requires founder authorization", async () => {
    const res = await request(app).post("/api/admin/airdrop").send({
      adminFid: 20002,
      targetFid: 20001,
      amount: 10,
      reason: "Unauthorized attempt",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("UNAUTHORIZED_ADMIN");
  });
});
