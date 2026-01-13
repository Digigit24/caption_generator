const path = require("path");
const fs = require("fs").promises;
const { extractAudio, splitAudioIntoChunks } = require("../utils/ffmpeg");
const {
  transcribeChunk,
  getContextFromText,
  formatSegmentsAsSRT,
  saveAllCaptionFormats,
} = require("./transcription");
const {
  getVideo,
  updateVideoStatus,
  updateVideoAudioPath,
  createChunk,
  getChunks,
  getPendingChunk,
  updateChunkStatus,
  updateChunkTranscript,
  insertCaption,
  getCaptions,
} = require("../utils/database");

// Processing queue
const processingQueue = new Map();
const activeProcesses = new Set();

/**
 * Add video to processing queue
 * @param {string} videoId - Video ID
 * @param {Object} videoData - Video metadata
 */
function addToQueue(videoId, videoData) {
  processingQueue.set(videoId, videoData);
  console.log(
    `Added video ${videoId} to queue. Queue size: ${processingQueue.size}`
  );
  processNextInQueue();
}

/**
 * Process next video in queue if capacity available
 */
async function processNextInQueue() {
  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_VIDEOS || "3");

  if (activeProcesses.size >= maxConcurrent) {
    console.log(
      `Max concurrent processes (${maxConcurrent}) reached. Waiting...`
    );
    return;
  }

  // Get first item from queue
  const videoId = processingQueue.keys().next().value;
  if (!videoId) {
    return;
  }

  const videoData = processingQueue.get(videoId);
  processingQueue.delete(videoId);
  activeProcesses.add(videoId);

  console.log(
    `Starting processing for video ${videoId}. Active: ${activeProcesses.size}`
  );

  try {
    await processVideo(videoId, videoData);
  } catch (error) {
    console.error(`Error processing video ${videoId}:`, error);
    await updateVideoStatus(videoId, "failed");
  } finally {
    activeProcesses.delete(videoId);
    console.log(
      `Finished processing video ${videoId}. Active: ${activeProcesses.size}`
    );
    // Process next in queue
    processNextInQueue();
  }
}

/**
 * Main video processing workflow
 * @param {string} videoId - Video ID
 * @param {Object} videoData - Video metadata
 */
async function processVideo(videoId, videoData) {
  console.log(`\n=== Processing Video ${videoId} ===`);

  try {
    // Step 1: Extract audio
    console.log("Step 1: Extracting audio...");
    await updateVideoStatus(videoId, "extracting_audio");

    const audioPath = path.join(
      __dirname,
      "../../chunks",
      `${videoId}_audio.wav`
    );
    await extractAudio(videoData.uploadPath, audioPath);
    await updateVideoAudioPath(videoId, audioPath);

    // Step 2: Split audio into chunks
    console.log("Step 2: Splitting audio into chunks...");
    await updateVideoStatus(videoId, "splitting");

    const chunksDir = path.join(__dirname, "../../chunks");
    const chunkDuration = parseInt(process.env.CHUNK_DURATION || "60");
    const chunks = await splitAudioIntoChunks(
      audioPath,
      chunksDir,
      chunkDuration
    );

    // Store chunks in database
    for (const chunk of chunks) {
      await createChunk(videoId, chunk.index, chunk.path);
    }

    console.log(`Created ${chunks.length} chunks`);

    // Step 3: Transcribe chunks sequentially
    console.log("Step 3: Transcribing chunks sequentially...");
    await updateVideoStatus(videoId, "transcribing");

    // --- GROQ API TRANSCRIPTION ---
    const Groq = require("groq-sdk");
    const fs = require("fs");
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Define System Instructions based on Language
    let promptInstruction = "Transcribe the audio exactly as spoken.";

    if (videoData.language === "hindi") {
      promptInstruction +=
        " The language is Hindi. Transcribe it using English alphabets (Roman script). Example: 'Main theek hoon' instead of 'मैं ठीक हूँ'.";
    } else if (videoData.language === "marathi") {
      promptInstruction +=
        " The language is Marathi. Transcribe it in Marathi (Devanagari script) and provide a translation if possible. Example: 'Mala mahit aahe'.";
    } else if (videoData.language === "hinglish") {
      promptInstruction +=
        " The language is Hinglish (Hindi + English mix). Transcribe exactly as spoken using Roman script.";
    } else {
      promptInstruction +=
        " The language is English. Ensure proper punctuation and capitalization.";
    }

    console.log(`Using Groq API with prompt: ${promptInstruction}`);

    // Process chunks SEQUENTIALLY to ensure correct order
    for (const chunk of chunks) {
      console.log(
        `\nTranscribing chunk ${chunk.index}/${chunks.length - 1} via Groq...`
      );

      try {
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(chunk.path),
          model: "whisper-large-v3",
          prompt: promptInstruction, // Context/Prompt for style
          response_format: "verbose_json", // Need segments with timestamps
        });

        // Map Groq response to our internal structure
        const segments = transcription.segments.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text.trim(),
        }));

        console.log(`Chunk ${chunk.index}: ${segments.length} segments`);

        // Store captions with time offset
        const timeOffset = chunk.startTime;
        const formattedSegments = formatSegmentsAsSRT(segments, timeOffset);

        for (const segment of formattedSegments) {
          await insertCaption(
            videoId,
            chunk.index,
            segment.start,
            segment.end,
            segment.text
          );
        }
      } catch (groqError) {
        console.error(
          `Groq API error on chunk ${chunk.index}:`,
          groqError.message
        );
        throw new Error(`Groq Transcription failed for chunk ${chunk.index}`);
      }
    }

    // Step 4: Generate final caption files (SRT, VTT, SBV)
    console.log("Step 4: Generating caption files in multiple formats...");
    await updateVideoStatus(videoId, "merging");

    const allCaptions = await getCaptions(videoId);
    const basePath = path.join(__dirname, "../../captions", `${videoId}_final`);
    const captionPaths = await saveAllCaptionFormats(basePath, allCaptions);

    console.log("Generated caption formats:");
    console.log(`  - SRT: ${captionPaths.srt}`);
    console.log(`  - VTT: ${captionPaths.vtt}`);
    console.log(`  - SBV: ${captionPaths.sbv}`);

    // Step 5: Cleanup temporary files
    console.log("Step 5: Cleaning up temporary files...");
    await cleanupVideoFiles(videoId, videoData, chunks);

    // Mark as completed
    await updateVideoStatus(videoId, "completed");
    console.log(`\n=== Video ${videoId} completed successfully ===\n`);

    return {
      videoId,
      captionPaths,
      captionCount: allCaptions.length,
      chunkCount: chunks.length,
    };
  } catch (error) {
    console.error(`Error in processVideo for ${videoId}:`, error);
    await updateVideoStatus(videoId, "failed");
    throw error;
  }
}

/**
 * Cleanup temporary files after processing
 * @param {string} videoId - Video ID
 * @param {Object} videoData - Video metadata
 * @param {Array} chunks - Array of chunk objects
 */
async function cleanupVideoFiles(videoId, videoData, chunks) {
  try {
    // Delete original upload
    await fs.unlink(videoData.uploadPath);
    console.log(`Deleted upload: ${videoData.uploadPath}`);

    // Delete audio file
    const video = await getVideo(videoId);
    if (video && video.audioPath) {
      await fs.unlink(video.audioPath);
      console.log(`Deleted audio: ${video.audioPath}`);
    }

    // Delete chunk files
    for (const chunk of chunks) {
      try {
        await fs.unlink(chunk.path);
      } catch (err) {
        console.warn(`Could not delete chunk ${chunk.path}:`, err.message);
      }
    }

    console.log("Cleanup completed");
  } catch (error) {
    console.error("Error during cleanup:", error);
    // Don't throw - cleanup errors shouldn't fail the whole process
  }
}

/**
 * Get queue status
 * @returns {Object} - Queue statistics
 */
function getQueueStatus() {
  return {
    queueSize: processingQueue.size,
    activeProcesses: activeProcesses.size,
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_VIDEOS || "3"),
    queuedVideos: Array.from(processingQueue.keys()),
  };
}

module.exports = {
  addToQueue,
  processNextInQueue,
  getQueueStatus,
  cleanupVideoFiles,
};
