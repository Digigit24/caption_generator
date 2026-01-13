const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Call Python transcription script
 * @param {string} audioPath - Path to audio chunk file
 * @param {string} modelName - Whisper model name
 * @param {string} device - Device to use (cpu or cuda)
 * @param {string} computeType - Compute type (int8, float16, etc.)
 * @param {string} initialPrompt - Context from previous chunk
 * @returns {Promise<Object>} - Transcription result
 */
function transcribeChunk(
  audioPath,
  modelName = "large-v3",
  device = "cpu",
  computeType = "int8",
  initialPrompt = ""
) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../../transcribe.py");
    const args = [scriptPath, audioPath, modelName, device, computeType];

    if (initialPrompt) {
      args.push(initialPrompt);
    }

    let stdout = "";
    let stderr = "";

    const pythonProcess = spawn("python", args);

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      // Log progress but don't treat as error
      if (stderr.includes("ERROR") || stderr.includes("Error")) {
        console.error("Python stderr:", data.toString());
      }
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Python process error:", stderr);
        reject(new Error(`Transcription failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || "Transcription failed"));
        }
      } catch (error) {
        console.error("Failed to parse transcription output:", stdout);
        reject(
          new Error(`Failed to parse transcription output: ${error.message}`)
        );
      }
    });

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

/**
 * Extract last N characters of text for context
 * @param {string} text - Input text
 * @param {number} length - Number of characters to extract
 * @returns {string} - Last N characters
 */
function getContextFromText(text, length = 100) {
  if (!text) return "";
  return text.slice(-length).trim();
}

/**
 * Format segments as SRT entries
 * @param {Array} segments - Array of segment objects
 * @param {number} timeOffset - Time offset in seconds
 * @returns {Array} - Array of SRT entries
 */
function formatSegmentsAsSRT(segments, timeOffset = 0) {
  return segments.map((segment) => ({
    start: segment.start + timeOffset,
    end: segment.end + timeOffset,
    text: segment.text,
  }));
}

/**
 * Convert seconds to SRT timestamp format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - SRT timestamp
 */
function secondsToSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Convert seconds to VTT timestamp format (HH:MM:SS.mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - VTT timestamp
 */
function secondsToVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Convert seconds to SBV timestamp format (H:MM:SS.mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - SBV timestamp
 */
function secondsToSBVTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds % 1) * 1000);

  // SBV uses single digit hour if less than 10
  return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

/**
 * Generate SRT file content from captions
 * @param {Array} captions - Array of caption objects with start, end, text
 * @returns {string} - SRT file content
 */
function generateSRTContent(captions) {
  let srtContent = "";

  captions.forEach((caption, index) => {
    srtContent += `${index + 1}\n`;
    srtContent += `${secondsToSRTTime(caption.start)} --> ${secondsToSRTTime(
      caption.end
    )}\n`;
    srtContent += `${caption.text}\n\n`;
  });

  return srtContent;
}

/**
 * Generate VTT file content from captions (WebVTT format)
 * @param {Array} captions - Array of caption objects with start, end, text
 * @returns {string} - VTT file content
 */
function generateVTTContent(captions) {
  let vttContent = "WEBVTT\n\n";

  captions.forEach((caption, index) => {
    vttContent += `${index + 1}\n`;
    vttContent += `${secondsToVTTTime(caption.start)} --> ${secondsToVTTTime(
      caption.end
    )}\n`;
    vttContent += `${caption.text}\n\n`;
  });

  return vttContent;
}

/**
 * Generate SBV file content from captions (YouTube/Premiere Pro format)
 * @param {Array} captions - Array of caption objects with start, end, text
 * @returns {string} - SBV file content
 */
function generateSBVContent(captions) {
  let sbvContent = "";

  captions.forEach((caption) => {
    sbvContent += `${secondsToSBVTime(caption.start)},${secondsToSBVTime(
      caption.end
    )}\n`;
    sbvContent += `${caption.text}\n\n`;
  });

  return sbvContent;
}

/**
 * Save SRT file to disk
 * @param {string} filePath - Output file path
 * @param {Array} captions - Array of caption objects
 * @returns {Promise<string>} - Path to saved file
 */
function saveSRTFile(filePath, captions) {
  return new Promise((resolve, reject) => {
    const srtContent = generateSRTContent(captions);

    fs.writeFile(filePath, srtContent, "utf8", (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`SRT file saved: ${filePath}`);
        resolve(filePath);
      }
    });
  });
}

/**
 * Save all caption formats (SRT, VTT, SBV) to disk
 * @param {string} baseFilePath - Base output file path (without extension)
 * @param {Array} captions - Array of caption objects
 * @returns {Promise<Object>} - Object with paths to all saved files
 */
async function saveAllCaptionFormats(baseFilePath, captions) {
  const srtPath = `${baseFilePath}.srt`;
  const vttPath = `${baseFilePath}.vtt`;
  const sbvPath = `${baseFilePath}.sbv`;

  const srtContent = generateSRTContent(captions);
  const vttContent = generateVTTContent(captions);
  const sbvContent = generateSBVContent(captions);

  try {
    await fs.promises.writeFile(srtPath, srtContent, "utf8");
    console.log(`SRT file saved: ${srtPath}`);

    await fs.promises.writeFile(vttPath, vttContent, "utf8");
    console.log(`VTT file saved: ${vttPath}`);

    await fs.promises.writeFile(sbvPath, sbvContent, "utf8");
    console.log(`SBV file saved: ${sbvPath}`);

    return {
      srt: srtPath,
      vtt: vttPath,
      sbv: sbvPath,
    };
  } catch (error) {
    throw new Error(`Failed to save caption files: ${error.message}`);
  }
}

module.exports = {
  transcribeChunk,
  getContextFromText,
  formatSegmentsAsSRT,
  generateSRTContent,
  generateVTTContent,
  generateSBVContent,
  saveSRTFile,
  saveAllCaptionFormats,
  secondsToSRTTime,
  secondsToVTTTime,
  secondsToSBVTime,
};
