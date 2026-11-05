
const express = require("express");
const cors = require("cors");

const uploadRoute = require("./upload");

const app = express();

app.disable("x-powered-by");

app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(x => x.trim())
    : "*",
  methods: ["GET", "POST", "OPTIONS"]
}));

// API information
app.get("/", (req, res) => {
  res.json({
    name: "Durbar Image API",
    version: "1.0.0",
    status: "online",
    storage: "ImgBB",
    endpoints: {
      upload: "POST /upload",
      health: "GET /health"
    }
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy"
  });
});

// Upload endpoint
app.use("/upload", uploadRoute);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "ENDPOINT_NOT_FOUND"
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: "IMAGE_TOO_LARGE",
      message: "Maximum image size is 8 MB"
    });
  }

  if (error.message === "INVALID_IMAGE_TYPE") {
    return res.status(400).json({
      success: false,
      error: "INVALID_IMAGE_TYPE"
    });
  }

  res.status(500).json({
    success: false,
    error: "SERVER_ERROR"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Durbar Image API running on port ${PORT}`);
});
