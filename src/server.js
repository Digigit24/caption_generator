require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { connectDB } = require("./utils/database");

// Ensure required directories exist
const requiredDirs = ["uploads", "chunks", "captions"];
requiredDirs.forEach((dir) => {
  const dirPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
});

// Import routes
const uploadRoutes = require("./routes/upload");
const statusRoutes = require("./routes/status");
const historyRoutes = require("./routes/history");

const app = express();
const PORT = process.env.PORT || 3000;

const cors = require("cors");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Root endpoint serves frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// API routes
app.use("/api", uploadRoutes);
app.use("/api", statusRoutes);
app.use("/api", historyRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  const multer = require("multer");
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 2GB",
      });
    }
  }

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Then start the Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║       Caption Generator API Server                   ║
║                                                       ║
║       Server running on port ${PORT}                    ║
║                                                       ║
║       Configuration:                                  ║
║       - Max concurrent videos: ${
        process.env.MAX_CONCURRENT_VIDEOS || 3
      }                    ║
║       - Chunk duration: ${
        process.env.CHUNK_DURATION || 60
      }s                         ║
║       - Whisper model: ${
        process.env.WHISPER_MODEL || "large-v3"
      }                  ║
║       - Device: ${
        process.env.WHISPER_DEVICE || "cpu"
      }                              ║
║                                                       ║
║       API Endpoints:                                  ║
║       POST   /api/upload                              ║
║       GET    /api/status/:videoId                     ║
║       GET    /api/queue                               ║
║       GET    /api/download/:videoId                   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
