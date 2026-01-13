const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createVideo } = require("../utils/database");
const { addToQueue } = require("../services/processor");

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".mkv",
      ".webm",
      ".flv",
      ".wmv",
      ".m4v",
    ];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type. Allowed: ${allowedExtensions.join(", ")}`)
      );
    }
  },
});

/**
 * POST /upload - Upload video for caption generation
 */
router.post("/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No video file provided",
      });
    }

    const videoId = uuidv4();
    const uploadPath = req.file.path;
    const filename = req.file.originalname;

    // Store video in database
    await createVideo(videoId, filename, uploadPath);

    // Add to processing queue
    addToQueue(videoId, {
      videoId,
      filename,
      uploadPath,
      language: req.body.language || "english",
    });

    res.json({
      success: true,
      videoId,
      filename,
      message: "Video uploaded successfully and queued for processing",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
