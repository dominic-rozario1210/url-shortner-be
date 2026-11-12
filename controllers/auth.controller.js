import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/user.schema.js";
import {
  sendActivationEmail,
  sendResetPasswordMail
} from "../services/email.services.js";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createAuthToken = (userId) => {
  if (!process.env.JWT_KEY) {
    throw new Error("JWT_KEY is missing from the environment");
  }

  return jwt.sign({ _id: userId }, process.env.JWT_KEY, { expiresIn: "1d" });
};

const publicUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified !== false
});

const createEmailVerificationToken = () => crypto.randomBytes(32).toString("hex");

const sendActivationForUser = async (user) => {
  const rawToken = createEmailVerificationToken();
  user.emailVerificationTokenHash = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  return sendActivationEmail(user.email, user.firstName, rawToken);
};

// REGISTER: create an inactive account and send an activation email.
export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must contain at least 8 characters" });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.isEmailVerified === false) {
        const emailSent = await sendActivationForUser(existingUser);
        return res.status(200).json({
          message: emailSent
            ? "This account is awaiting activation. A new activation email has been sent."
            : "This account is awaiting activation, but the email could not be sent. Please try again later.",
          activationEmailSent: emailSent,
          requiresEmailVerification: true
        });
      }

      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      isEmailVerified: false
    });

    const emailSent = await sendActivationForUser(user);

    return res.status(201).json({
      message: emailSent
        ? "Registration successful. Please check your email to activate your account."
        : "Your account was created, but the activation email could not be sent. Please try again later.",
      activationEmailSent: emailSent,
      requiresEmailVerification: true,
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    console.error("Register error:", error);
    return res.status(500).json({ message: "Unable to register user" });
  }
};

// VERIFY EMAIL: token is stored only as a SHA-256 hash.
export const verifyEmail = async (req, res) => {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

  try {
    const { token } = req.params;
    const user = await User.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.redirect(`${clientUrl}/login?verification=failed`);
    }

    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    return res.redirect(`${clientUrl}/login?verified=true`);
  } catch (error) {
    console.error("Verify email error:", error);
    return res.redirect(`${clientUrl}/login?verification=failed`);
  }
};

// RESEND ACTIVATION EMAIL
export const resendActivationEmail = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user || user.isEmailVerified !== false) {
      return res.status(200).json({
        message: "If the account requires activation, an email will be sent."
      });
    }

    const emailSent = await sendActivationForUser(user);

    return res.status(emailSent ? 200 : 503).json({
      message: emailSent
        ? "A new activation email has been sent."
        : "Unable to send the activation email. Please try again later."
    });
  } catch (error) {
    console.error("Resend activation error:", error);
    return res.status(500).json({ message: "Unable to resend activation email" });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isEmailVerified === false) {
      return res.status(403).json({
        message: "Please activate your email address before logging in.",
        requiresEmailVerification: true
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
    return res.status(500).json({ message: "Unable to log in" });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user || user.isEmailVerified === false) {
      return res.status(200).json({
        message: "If an active account exists for this email, password reset instructions will be sent."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = hashToken(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const emailSent = await sendResetPasswordMail(user.email, user.firstName, resetToken);

    return res.status(200).json({
      message: "If an active account exists for this email, password reset instructions will be sent.",
      emailSent
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Unable to process password reset request" });
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
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    return res.status(200).json({ message: "Reset token is valid" });
  } catch (error) {
    return res.status(400).json({ message: "Reset link is invalid or has expired" });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Password must contain at least 8 characters" });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await User.findOne({
      resetPasswordTokenHash: hashToken(token),
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successfully. Please log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Unable to reset password" });
  }
};

// GET PROFILE
export const getProfile = async (req, res) =>
  res.status(200).json({
    message: "Profile fetched successfully",
    user: publicUser(req.user)
  });

// VERIFY JWT
export const verifyToken = async (req, res) =>
  res.status(200).json({
    message: "Token verified successfully",
    user: publicUser(req.user)
  });
