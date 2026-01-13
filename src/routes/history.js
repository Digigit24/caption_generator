const express = require("express");
const { getHistory, deleteVideo, getCaptions } = require("../utils/database");
const fs = require("fs").promises;
const path = require("path");

const router = express.Router();

// GET /api/history - Get processed video history
router.get("/history", async (req, res) => {
  try {
    const history = await getHistory();
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/history/:videoId - Delete a specific video record
router.delete("/history/:videoId", async (req, res) => {
  try {
    const deleted = await deleteVideo(req.params.videoId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Video not found" });
    }

    // Also try to cleanup file system just in case
    try {
      const captionsPath = path.join(
        __dirname,
        "../../captions",
        `${req.params.videoId}_final`
      );
      // We delete the whole folder or specific files?
      // Actually saveAllCaptionFormats saved specific files.
      // Let's iterate extensions.
      for (const ext of [".srt", ".vtt", ".sbv"]) {
        try {
          await fs.unlink(`${captionsPath}${ext}`);
        } catch (e) {}
      }
    } catch (e) {}

    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/transcript/:videoId - Get full transcript text for preview
router.get("/transcript/:videoId", async (req, res) => {
  try {
    const captions = await getCaptions(req.params.videoId);

    // Return structured data for rich UI
    const structuredTranscript = captions.map((c) => ({
      start: new Date(c.startTime * 1000).toISOString().substr(11, 8),
      startTime: c.startTime,
      end: new Date(c.endTime * 1000).toISOString().substr(11, 8),
      text: c.text,
    }));

    res.json({ success: true, transcript: structuredTranscript });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
