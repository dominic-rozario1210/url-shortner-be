import mongoose from "mongoose";
import { nanoid } from "nanoid";
import ShortUrl from "../models/url.schema.js";

const getApiBaseUrl = () =>
  (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "");

const normalizeUrl = (value) => {
  try {
    const parsedUrl = new URL(value);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
};

export const createShortUrl = async (req, res) => {
  try {
    const { customCode } = req.body;
    const originalUrl = normalizeUrl(req.body.originalUrl || req.body.url);

    if (!originalUrl) {
      return res.status(400).json({
        message: "Please provide a valid URL beginning with http:// or https://"
      });
    }

    let shortCode;

    if (customCode) {
      const cleanedCode = customCode.trim();

      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(cleanedCode)) {
        return res.status(400).json({
          message: "Custom code must be 3–30 characters and use only letters, numbers, hyphens or underscores"
        });
      }

      const existingCode = await ShortUrl.findOne({ shortCode: cleanedCode });
      if (existingCode) {
        return res.status(409).json({ message: "This custom short code is already in use" });
      }

      shortCode = cleanedCode;
    } else {
      // Retry in the extremely unlikely event of a randomly generated collision.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = nanoid(8);
        const existingCode = await ShortUrl.exists({ shortCode: candidate });

        if (!existingCode) {
          shortCode = candidate;
          break;
        }
      }

      if (!shortCode) {
        return res.status(503).json({ message: "Unable to generate a short link. Please try again." });
      }
    }

    const shortUrlRecord = await ShortUrl.create({
      originalUrl,
      shortCode,
      user: req.user?._id || null
    });

    const shortUrl = `${getApiBaseUrl()}/${shortUrlRecord.shortCode}`;

    return res.status(201).json({
      message: "URL shortened successfully",
      shortCode: shortUrlRecord.shortCode,
      shortUrl,
      originalUrl: shortUrlRecord.originalUrl,
      clickCount: shortUrlRecord.clickCount,
      createdAt: shortUrlRecord.createdAt
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Short code already exists. Please try again." });
    }

    console.error("Create short URL error:", error);
    return res.status(500).json({ message: "Unable to shorten URL" });
  }
};

export const getMyLinks = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const [links, totalLinks, clickSummary] = await Promise.all([
      ShortUrl.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ShortUrl.countDocuments({ user: req.user._id }),
      ShortUrl.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.user._id) } },
        { $group: { _id: null, totalClicks: { $sum: "$clickCount" } } }
      ])
    ]);

    return res.status(200).json({
      message: "Links fetched successfully",
      links: links.map((link) => ({
        ...link,
        shortUrl: `${getApiBaseUrl()}/${link.shortCode}`
      })),
      stats: {
        totalLinks,
        totalClicks: clickSummary[0]?.totalClicks || 0
      },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalLinks / limit),
        totalLinks
      }
    });
  } catch (error) {
    console.error("Get my links error:", error);
    return res.status(500).json({ message: "Unable to fetch your links" });
  }
};

export const getLinkStats = async (req, res) => {
  try {
    const [summary, topLinks] = await Promise.all([
      ShortUrl.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.user._id) } },
        {
          $group: {
            _id: null,
            totalLinks: { $sum: 1 },
            totalClicks: { $sum: "$clickCount" }
          }
        }
      ]),
      ShortUrl.find({ user: req.user._id })
        .sort({ clickCount: -1 })
        .limit(5)
        .select("originalUrl shortCode clickCount createdAt")
        .lean()
    ]);

    return res.status(200).json({
      stats: summary[0] || { totalLinks: 0, totalClicks: 0 },
      topLinks: topLinks.map((link) => ({
        ...link,
        shortUrl: `${getApiBaseUrl()}/${link.shortCode}`
      }))
    });
  } catch (error) {
    console.error("Get link stats error:", error);
    return res.status(500).json({ message: "Unable to fetch link statistics" });
  }
};

export const deleteShortUrl = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid link ID" });
    }

    const deletedLink = await ShortUrl.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!deletedLink) {
      return res.status(404).json({ message: "Link not found" });
    }

    return res.status(200).json({ message: "Short link deleted successfully" });
  } catch (error) {
    console.error("Delete short URL error:", error);
    return res.status(500).json({ message: "Unable to delete short link" });
  }
};

export const redirectToOriginal = async (req, res) => {
  try {
    const now = new Date();

    const link = await ShortUrl.findOneAndUpdate(
      {
        shortCode: req.params.shortCode,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } }
        ]
      },
      {
        $inc: { clickCount: 1 },
        $set: { lastClickedAt: now }
      },
      { returnDocument: "after" }
    );

    if (!link) {
      return res.status(404).send("This short link does not exist or has expired.");
    }

    return res.redirect(302, link.originalUrl);
  } catch (error) {
    console.error("Redirect error:", error);
    return res.status(500).send("Unable to redirect this short link.");
  }
};
