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

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    // Allow tools such as Postman that do not send an Origin header.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  }
}));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "Snip API is running" });
});

app.use("/api/auth", authRouter);
app.use("/api/urls", urlRouter);

// Short links use the backend root: https://your-api-domain.com/:shortCode
app.get("/:shortCode", redirectToOriginal);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({ message: error.message });
  }

  return res.status(500).json({ message: "Internal server error" });
});

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Snip backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
