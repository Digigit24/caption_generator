const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

/**
 * Extract audio from video file as WAV
 * @param {string} videoPath - Path to input video file
 * @param {string} outputPath - Path for output audio file
 * @returns {Promise<string>} - Path to extracted audio file
 */
function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on("end", () => {
        console.log(`Audio extracted successfully: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("Error extracting audio:", err.message);
        reject(err);
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`Extraction progress: ${Math.round(progress.percent)}%`);
        }
      })
      .run();
  });
}

/**
 * Get duration of media file
 * @param {string} filePath - Path to media file
 * @returns {Promise<number>} - Duration in seconds
 */
function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

/**
 * Split audio file into chunks at specified timestamps (Direct splitting, no silence detection)
 * @param {string} audioPath - Path to input audio file
 * @param {string} outputDir - Directory for output chunks
 * @param {number} chunkDuration - Target chunk duration in seconds (default 60)
 * @returns {Promise<Array>} - Array of chunk file paths with metadata
 */
async function splitAudioIntoChunks(audioPath, outputDir, chunkDuration = 30) {
  try {
    // Get total duration
    const totalDuration = await getDuration(audioPath);
    console.log(
      `Total audio duration: ${totalDuration.toFixed(
        2
      )} seconds. Using ${chunkDuration}s chunks.`
    );

    const chunks = [];
    const numChunks = Math.ceil(totalDuration / chunkDuration);

    for (let i = 0; i < numChunks; i++) {
      const startTime = i * chunkDuration;
      const endTime = Math.min((i + 1) * chunkDuration, totalDuration);
      const duration = endTime - startTime;

      if (duration <= 0) break;

      const chunkPath = path.join(
        outputDir,
        `chunk_${i.toString().padStart(3, "0")}.wav`
      );

      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .seekInput(startTime)
          .duration(duration)
          // Re-encoding to ensure precise start/end points
          .audioCodec("pcm_s16le")
          .audioFrequency(16000)
          .audioChannels(1)
          .output(chunkPath)
          .on("end", () => {
            console.log(
              `Created chunk ${i}: ${chunkPath} [${startTime.toFixed(
                2
              )}s - ${endTime.toFixed(2)}s]`
            );
            resolve();
          })
          .on("error", (err) => {
            console.error(`Error creating chunk ${i}:`, err.message);
            reject(err);
          })
          .run();
      });

      chunks.push({
        index: i,
        path: chunkPath,
        startTime,
        endTime,
        duration,
      });
    }

    return chunks;
  } catch (error) {
    console.error("Error splitting audio:", error.message);
    throw error;
  }
}

module.exports = {
  extractAudio,
  getDuration,
  splitAudioIntoChunks,
};
