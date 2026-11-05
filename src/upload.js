
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
      return callback(
        new Error("INVALID_IMAGE_TYPE")
      );
    }

    callback(null, true);
  }
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.IMGBB_API_KEY) {
      return res.status(503).send("Upload service unavailable");
    }

    if (!req.file) {
      return res.status(400).send("Image required");
    }

    // Generate safe image name.
    const originalName = path.parse(
      path.basename(req.file.originalname)
    ).name;

    const safeName = originalName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "image";

    const uniqueId = crypto.randomBytes(5).toString("hex");

    const filename = `${safeName}-${uniqueId}`;

    // Prepare ImgBB request.
    const form = new URLSearchParams();

    form.append("key", process.env.IMGBB_API_KEY);

    form.append(
      "image",
      req.file.buffer.toString("base64")
    );

    form.append("name", filename);

    // Upload to ImgBB.
    const response = await fetch(
      "https://api.imgbb.com/1/upload",
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("ImgBB error:", result);

      return res.status(502).send("Image upload failed");
    }

    // Return ONLY the direct image URL.
    return res
      .status(200)
      .type("text/plain")
      .send(result.data.url);

  } catch (error) {
    console.error("Upload error:", error);

    if (error.name === "TimeoutError") {
      return res.status(504).send("Upload timed out");
    }

    return res.status(500).send("Upload failed");
  }
});

module.exports = router;
