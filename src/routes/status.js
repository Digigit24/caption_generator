const express = require('express');
const path = require('path');
const fs = require('fs');
const { getVideo, getChunks, getCaptions } = require('../utils/database');
const { getQueueStatus } = require('../services/processor');

const router = express.Router();

/**
 * GET /status/:videoId - Get processing status for a video
 */
router.get('/status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await getVideo(videoId);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    const chunks = await getChunks(videoId);
    const captions = await getCaptions(videoId);

    const completedChunks = chunks.filter(c => c.status === 'completed').length;
    const totalChunks = chunks.length;

    res.json({
      success: true,
      video: {
        id: video.videoId,
        filename: video.filename,
        status: video.status,
        createdAt: video.createdAt,
        completedAt: video.completedAt
      },
      progress: {
        totalChunks,
        completedChunks,
        percentage: totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0
      },
      captions: {
        count: captions.length
      }
    });

  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /queue - Get queue status
 */
router.get('/queue', (req, res) => {
  try {
    const status = getQueueStatus();

    res.json({
      success: true,
      queue: status
    });

  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /download/:videoId?format=srt|vtt|sbv - Download caption file
 */
router.get('/download/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const format = (req.query.format || 'srt').toLowerCase();

    // Validate format
    const validFormats = ['srt', 'vtt', 'sbv'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: `Invalid format. Allowed formats: ${validFormats.join(', ')}`
      });
    }

    const video = await getVideo(videoId);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    if (video.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Video processing not completed yet',
        status: video.status
      });
    }

    const captionPath = path.join(__dirname, '../../captions', `${videoId}_final.${format}`);

    if (!fs.existsSync(captionPath)) {
      return res.status(404).json({
        success: false,
        error: `Caption file not found (${format} format)`
      });
    }

    // Extract original filename without extension
    const originalName = video.filename.replace(/\.[^/.]+$/, '');
    res.download(captionPath, `${originalName}.${format}`);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
