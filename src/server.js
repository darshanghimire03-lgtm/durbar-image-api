const express = require("express");
const cors = require("cors");
const { Readable } = require("node:stream");
const uploadRoute = require("./upload");

const app = express();

app.disable("x-powered-by");

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"]
}));

app.get("/", (req, res) => {
  res.json({
    name: "Durbar Image API",
    status: "online",
    storage: "ImgBB",
    endpoints: {
      upload: "POST /upload",
      image: "GET /picture/:filename",
      health: "GET /health"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy"
  });
});

// Image URL: /picture/image-id--filename.jpg
app.get("/picture/:file", async (req, res) => {
  try {
    const file = req.params.file;
    const separator = file.indexOf("--");

    if (separator <= 0) {
      return res.status(400).send("Invalid image URL");
    }

    const imageId = file.slice(0, separator);
    const filename = file.slice(separator + 2);

    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(imageId) ||
      !/^[A-Za-z0-9._-]{1,160}$/.test(filename)
    ) {
      return res.status(400).send("Invalid image path");
    }

    const imageUrl = `https://i.ibb.co/${imageId}/${filename}`;

    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok || !response.body) {
      return res.status(404).send("Image not found");
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream"
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );

    res.setHeader("Access-Control-Allow-Origin", "*");

    const contentLength = response.headers.get("content-length");

    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    Readable.fromWeb(response.body).pipe(res);

  } catch (error) {
    console.error("Image serving error:", error);

    if (error.name === "TimeoutError") {
      return res.status(504).send("Image request timed out");
    }

    if (!res.headersSent) {
      return res.status(502).send("Unable to load image");
    }

    res.destroy();
  }
});

app.use("/upload", uploadRoute);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "ENDPOINT_NOT_FOUND"
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).send("IMAGE_TOO_LARGE");
  }

  if (error.message === "INVALID_IMAGE_TYPE") {
    return res.status(400).send("INVALID_IMAGE_TYPE");
  }

  res.status(500).send("SERVER_ERROR");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Durbar Image API running on port ${PORT}`);
});