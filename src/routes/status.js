const express = require('express');
const path = require('path');
const fs = require('fs');
const { getVideo, getChunks, getCaptions } = require('../utils/database');
const { getQueueStatus } = require('../services/processor');

const router = express.Router();

/**
 * GET /status/:videoId - Get processing status for a video
 */
router.get('/status/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;

    const video = getVideo.get(videoId);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    const chunks = getChunks.all(videoId);
    const captions = getCaptions.all(videoId);

    const completedChunks = chunks.filter(c => c.status === 'completed').length;
    const totalChunks = chunks.length;

    res.json({
      success: true,
      video: {
        id: video.id,
        filename: video.filename,
        status: video.status,
        createdAt: video.created_at,
        completedAt: video.completed_at
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
 * GET /download/:videoId - Download SRT file
 */
router.get('/download/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;

    const video = getVideo.get(videoId);

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

    const srtPath = path.join(__dirname, '../../captions', `${videoId}_final.srt`);

    if (!fs.existsSync(srtPath)) {
      return res.status(404).json({
        success: false,
        error: 'SRT file not found'
      });
    }

    res.download(srtPath, `${video.filename}.srt`);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
