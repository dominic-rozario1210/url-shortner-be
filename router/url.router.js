import express from "express";
import {
  createShortUrl,
  deleteShortUrl,
  getLinkStats,
  getMyLinks
} from "../controllers/url.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public endpoint; when a valid JWT is supplied, the link is associated with that user.
router.post("/shorten", optionalAuthMiddleware, createShortUrl);

// Authenticated dashboard endpoints.
router.get("/my-links", authMiddleware, getMyLinks);
router.get("/stats", authMiddleware, getLinkStats);
router.delete("/:id", authMiddleware, deleteShortUrl);

export default router;
