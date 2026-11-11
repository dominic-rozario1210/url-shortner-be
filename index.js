
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./database/db.configure.js";

import authRouter from "./router/auth.router.js";
import urlRouter from "./router/url.router.js";

import { redirectToOriginal } from "./controllers/url.controller.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");

// Normalize frontend origins
const normalizeOrigin = (origin) =>
  origin.trim().replace(/\/+$/, "");

// Allowed frontend domains
const allowedOrigins = new Set(
  [
    // Local development
    "http://localhost:5173",

    // Vercel production domains
    "https://url-shortner-fe-mocha.vercel.app",
    "https://url-shortner-lshpg153g-dominic-rozario1210.vercel.app",

    // Additional origins from Render environment variables
    process.env.CLIENT_URL || "",
    process.env.CORS_ORIGINS || ""
  ]
    .flatMap((value) => value.split(","))
    .map(normalizeOrigin)
    .filter(Boolean)
);

// CORS configuration
const corsOptions = {
  origin(origin, callback) {
    // Allow Postman and server-to-server requests
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    console.log("Blocked CORS origin:", origin);

    return callback(
      new Error("Origin not allowed by CORS")
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ],

  optionsSuccessStatus: 204
};

// Apply CORS before all routes
app.use(cors(corsOptions));

// Parse incoming JSON
app.use(express.json({ limit: "10kb" }));

app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "Snip API is running"
  });
});

// Authentication routes
app.use("/api/auth", authRouter);

// URL shortener routes
app.use("/api/urls", urlRouter);

// Short URL redirection
app.get("/:shortCode", redirectToOriginal);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      message: "CORS error: frontend origin is not allowed"
    });
  }

  return res.status(500).json({
    message: "Internal server error"
  });
});

// Start server after MongoDB connects
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Snip backend running on port ${PORT}`);
      console.log("Allowed frontend origins:", [
        ...allowedOrigins
      ]);
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();

