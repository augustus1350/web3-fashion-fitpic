import express from "express";
import path from "node:path";
import { errorHandler } from "./middleware/errorHandler";
import { adminRouter } from "./routes/admin";
import { appRouter } from "./routes/app";
import { channelRouter } from "./routes/channel";
import { framesRouter } from "./routes/frames";
import { healthRouter } from "./routes/health";
import { manifestRouter } from "./routes/manifest";
import { submissionsRouter } from "./routes/submissions";
import { usersRouter } from "./routes/users";
import { votesRouter } from "./routes/votes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(manifestRouter);
  app.use(express.static(path.join(process.cwd(), "public")));
  app.use(healthRouter);
  app.use(appRouter);
  app.use(framesRouter);
  app.use(channelRouter);
  app.use(submissionsRouter);
  app.use(votesRouter);
  app.use(adminRouter);
  app.use(usersRouter);
  app.use(errorHandler);

  return app;
}
