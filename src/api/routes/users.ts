import { Router } from "express";
import { findUserByFid } from "../../services/userService";
import { asyncHandler } from "../middleware/asyncHandler";
import { fidSchema } from "../validators/schemas";

export const usersRouter = Router();

usersRouter.get(
  "/api/users/:fid",
  asyncHandler(async (req, res) => {
    const fid = fidSchema.parse(req.params.fid);
    const user = await findUserByFid(fid);
    res.json({ data: user });
  }),
);
