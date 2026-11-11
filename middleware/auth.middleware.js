
import jwt from "jsonwebtoken";
import User from "../models/user.schema.js";

const getTokenFromRequest = (req) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.split(" ")[1];
};

// Protected routes
export const authMiddleware = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        message: "Authentication token is required"
      });
    }

    if (!process.env.JWT_KEY) {
      return res.status(500).json({
        message: "JWT_KEY is not configured"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_KEY);

    const user = await User.findById(decoded._id);

    if (!user) {
      return res.status(401).json({
        message: "User account was not found"
      });
    }

    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired authentication token"
    });
  }
};

// Public routes with optional authentication
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      req.user = null;
      return next();
    }

    if (!process.env.JWT_KEY) {
      return res.status(500).json({
        message: "JWT_KEY is not configured"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_KEY);

    const user = await User.findById(decoded._id);

    if (!user) {
      return res.status(401).json({
        message: "Invalid authentication token"
      });
    }

    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired authentication token"
    });
  }
};
