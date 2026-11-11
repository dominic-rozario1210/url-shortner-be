
import express from "express";

import {
  register,
  login,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  getProfile,
  verifyToken
} from "../controllers/auth.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Registration and login
router.post("/register", register);
router.post("/login", login);

// Password recovery
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token/verify", verifyResetToken);
router.patch("/reset-password/:token", resetPassword);

// Protected user routes
router.get("/verify-token", authMiddleware, verifyToken);
router.get("/profile", authMiddleware, getProfile);

export default router;
