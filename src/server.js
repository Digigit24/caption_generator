require('dotenv').config();
const express = require('express');
const path = require('path');
const { connectDB } = require('./utils/database');

// Import routes
const uploadRoutes = require('./routes/upload');
const statusRoutes = require('./routes/status');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Caption Generator API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/upload',
      status: 'GET /api/status/:videoId',
      queue: 'GET /api/queue',
      download: 'GET /api/download/:videoId'
    }
  });
});

// API routes
app.use('/api', uploadRoutes);
app.use('/api', statusRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 500MB'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Then start the Express server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║       Caption Generator API Server                   ║
║                                                       ║
║       Server running on port ${PORT}                    ║
║                                                       ║
║       Configuration:                                  ║
║       - Max concurrent videos: ${process.env.MAX_CONCURRENT_VIDEOS || 3}                    ║
║       - Chunk duration: ${process.env.CHUNK_DURATION || 60}s                         ║
║       - Whisper model: ${process.env.WHISPER_MODEL || 'large-v3'}                  ║
║       - Device: ${process.env.WHISPER_DEVICE || 'cpu'}                              ║
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
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
