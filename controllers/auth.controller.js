
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/user.schema.js";
import { sendResetPasswordMail } from "../services/email.services.js";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Generate JWT
const createAuthToken = (userId) => {
  if (!process.env.JWT_KEY) {
    throw new Error("JWT_KEY is missing from the .env file");
  }

  return jwt.sign(
    { _id: userId },
    process.env.JWT_KEY,
    { expiresIn: "1d" }
  );
};

// User response
const publicUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role
});

// REGISTER
export const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword
    } = req.body;

    if (
      !firstName?.trim() ||
      !lastName?.trim() ||
      !email?.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters"
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user directly without email verification
    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    return res.status(201).json({
      message: "Account created successfully. You can now log in.",
      user: publicUser(user)
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    console.error("Register error:", error);

    return res.status(500).json({
      message: "Unable to register user"
    });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = createAuthToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: publicUser(user)
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in"
    });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });

    // Do not reveal whether an account exists
    if (!user) {
      return res.status(200).json({
        message: "If an account exists for this email, password reset instructions will be sent."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordTokenHash = hashToken(resetToken);
    user.resetPasswordExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await user.save();

    const emailSent = await sendResetPasswordMail(
      user.email,
      user.firstName,
      resetToken
    );

    return res.status(200).json({
      message: "If an account exists for this email, password reset instructions will be sent.",
      emailSent
    });

  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      message: "Unable to process password reset request"
    });
  }
};

// VERIFY RESET TOKEN
export const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordTokenHash: hashToken(token),
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        message: "Reset link is invalid or has expired"
      });
    }

    return res.status(200).json({
      message: "Reset token is valid"
    });

  } catch (error) {
    return res.status(400).json({
      message: "Reset link is invalid or has expired"
    });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters"
      });
    }

    if (
      confirmPassword !== undefined &&
      newPassword !== confirmPassword
    ) {
      return res.status(400).json({
        message: "Passwords do not match"
      });
    }

    const user = await User.findOne({
      resetPasswordTokenHash: hashToken(token),
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        message: "Reset link is invalid or has expired"
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    // Clear reset token after successful password change
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully. Please log in."
    });

  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      message: "Unable to reset password"
    });
  }
};

// GET PROFILE
export const getProfile = async (req, res) => {
  return res.status(200).json({
    message: "Profile fetched successfully",
    user: publicUser(req.user)
  });
};

// VERIFY JWT
export const verifyToken = async (req, res) => {
  return res.status(200).json({
    message: "Token verified successfully",
    user: publicUser(req.user)
  });
};
