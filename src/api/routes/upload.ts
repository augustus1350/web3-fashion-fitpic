import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { submitFitPic } from "../../services/epochService";
import { getOrCreateFrameUser } from "../../services/frameUserService";
import { asyncHandler } from "../middleware/asyncHandler";
import { resolveBaseUrl } from "./frames";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  "/api/submissions/upload",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const fid = Number(req.body?.fid);
    if (!Number.isInteger(fid) || fid <= 0) {
      res.status(400).json({ error: { message: "Valid fid is required" } });
      return;
    }
    if (!req.file) {
      res
        .status(400)
        .json({ error: { message: "An image file is required (field 'image')" } });
      return;
    }

    await getOrCreateFrameUser(fid);

    const baseUrl = resolveBaseUrl(req);
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    const castHash = `0xupload_${fid}_${Date.now()}`;

    const submission = await submitFitPic({
      farcasterFid: fid,
      farcasterCastHash: castHash,
      imageUrl,
      hasPhysicalProof: false,
    });

    res.status(201).json({
      data: { id: submission.id, imageUrl, castHash },
    });
  }),
);
