
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, callback) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("INVALID_IMAGE_TYPE"));
    }

    callback(null, true);
  }
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const apiKey = process.env.IMGBB_API_KEY;
    const publicBase = process.env.PUBLIC_IMAGE_BASE_URL;

    if (!apiKey || !publicBase) {
      return res.status(503).send("Upload service unavailable");
    }

    if (!req.file) {
      return res.status(400).send("Image required");
    }

    const originalName = path.parse(
      path.basename(req.file.originalname)
    ).name;

    const safeName = originalName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "image";

    const extension = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif"
    }[req.file.mimetype];

    const uniqueId = crypto.randomBytes(5).toString("hex");
    const filename = `${safeName}-${uniqueId}${extension}`;

    const form = new URLSearchParams();

    form.append("key", apiKey);
    form.append("image", req.file.buffer.toString("base64"));
    form.append("name", filename);

    const response = await fetch(
      "https://api.imgbb.com/1/upload",
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success || !result.data?.url) {
      console.error("ImgBB error:", result);
      return res.status(502).send("Image upload failed");
    }

    // Extract the actual ImgBB image ID and filename.
    const imagePath = new URL(result.data.url).pathname
      .split("/")
      .filter(Boolean);

    if (imagePath.length < 2) {
      return res.status(502).send("Invalid ImgBB response");
    }

    const imageId = imagePath[0];
    const imageFilename = imagePath.slice(1).join("/");

    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(imageId) ||
      !/^[A-Za-z0-9._-]{1,160}$/.test(imageFilename)
    ) {
      return res.status(502).send("Invalid ImgBB image path");
    }

    const base = publicBase.replace(/\/+$/, "");

    const ownImageUrl =
      `${base}/picture/${encodeURIComponent(imageId)}/${encodeURIComponent(imageFilename)}`;

    // Return ONLY your own public image URL.
    return res
      .status(200)
      .type("text/plain")
      .send(ownImageUrl);

  } catch (error) {
    console.error("Upload error:", error);

    if (error.name === "TimeoutError") {
      return res.status(504).send("Upload timed out");
    }

    return res.status(500).send("Upload failed");
  }
});

module.exports = router;
