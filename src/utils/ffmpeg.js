const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

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
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => {
        console.log(`Audio extracted successfully: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error extracting audio:', err.message);
        reject(err);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Extraction progress: ${Math.round(progress.percent)}%`);
        }
      })
      .run();
  });
}

/**
 * Detect silence points in audio file
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Array>} - Array of silence timestamps
 */
function detectSilence(audioPath) {
  return new Promise((resolve, reject) => {
    const silences = [];

    ffmpeg(audioPath)
      .audioFilters('silencedetect=noise=-30dB:d=0.5')
      .format('null')
      .output('-')
      .on('error', (err) => {
        console.error('Error detecting silence:', err.message);
        reject(err);
      })
      .on('stderr', (stderrLine) => {
        // Parse silence detection output
        const silenceStartMatch = stderrLine.match(/silence_start: ([\d.]+)/);
        const silenceEndMatch = stderrLine.match(/silence_end: ([\d.]+)/);

        if (silenceStartMatch) {
          silences.push({ type: 'start', time: parseFloat(silenceStartMatch[1]) });
        }
        if (silenceEndMatch) {
          silences.push({ type: 'end', time: parseFloat(silenceEndMatch[1]) });
        }
      })
      .on('end', () => {
        console.log(`Detected ${silences.length} silence points`);
        resolve(silences);
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
 * Find optimal split points near target intervals using silence detection
 * @param {Array} silences - Array of silence points
 * @param {number} targetInterval - Target chunk duration (default 60s)
 * @param {number} totalDuration - Total audio duration
 * @returns {Array} - Array of split timestamps
 */
function findOptimalSplitPoints(silences, targetInterval, totalDuration) {
  const splitPoints = [0];
  let currentTarget = targetInterval;

  while (currentTarget < totalDuration) {
    // Find silence end point closest to current target
    let closestSilence = null;
    let minDistance = Infinity;

    for (const silence of silences) {
      if (silence.type === 'end') {
        const distance = Math.abs(silence.time - currentTarget);
        // Only consider silences within 10 seconds of target
        if (distance < minDistance && distance < 10) {
          minDistance = distance;
          closestSilence = silence.time;
        }
      }
    }

    // If we found a good silence point, use it; otherwise use exact target
    const splitPoint = closestSilence !== null ? closestSilence : currentTarget;
    splitPoints.push(splitPoint);
    currentTarget = splitPoint + targetInterval;
  }

  return splitPoints;
}

/**
 * Split audio file into chunks at specified timestamps
 * @param {string} audioPath - Path to input audio file
 * @param {string} outputDir - Directory for output chunks
 * @param {number} chunkDuration - Target chunk duration in seconds (default 60)
 * @returns {Promise<Array>} - Array of chunk file paths with metadata
 */
async function splitAudioIntoChunks(audioPath, outputDir, chunkDuration = 60) {
  try {
    // Get total duration
    const totalDuration = await getDuration(audioPath);
    console.log(`Total audio duration: ${totalDuration.toFixed(2)} seconds`);

    // Detect silence points
    const silences = await detectSilence(audioPath);

    // Find optimal split points
    const splitPoints = findOptimalSplitPoints(silences, chunkDuration, totalDuration);
    console.log(`Split points: ${splitPoints.map(p => p.toFixed(2)).join(', ')}`);

    // Create chunks
    const chunks = [];

    for (let i = 0; i < splitPoints.length; i++) {
      const startTime = splitPoints[i];
      const endTime = i < splitPoints.length - 1 ? splitPoints[i + 1] : totalDuration;
      const duration = endTime - startTime;

      const chunkPath = path.join(outputDir, `chunk_${i.toString().padStart(3, '0')}.wav`);

      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .setStartTime(startTime)
          .setDuration(duration)
          .audioCodec('copy')
          .output(chunkPath)
          .on('end', () => {
            console.log(`Created chunk ${i}: ${chunkPath} (${duration.toFixed(2)}s)`);
            resolve();
          })
          .on('error', (err) => {
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
        duration
      });
    }

    return chunks;
  } catch (error) {
    console.error('Error splitting audio:', error.message);
    throw error;
  }
}

module.exports = {
  extractAudio,
  detectSilence,
  getDuration,
  splitAudioIntoChunks
};
