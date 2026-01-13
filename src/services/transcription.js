const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Call Python transcription script
 * @param {string} audioPath - Path to audio chunk file
 * @param {string} modelName - Whisper model name
 * @param {string} device - Device to use (cpu or cuda)
 * @param {string} computeType - Compute type (int8, float16, etc.)
 * @param {string} initialPrompt - Context from previous chunk
 * @returns {Promise<Object>} - Transcription result
 */
function transcribeChunk(audioPath, modelName = 'large-v3', device = 'cpu', computeType = 'int8', initialPrompt = '') {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../transcribe.py');
    const args = [scriptPath, audioPath, modelName, device, computeType];

    if (initialPrompt) {
      args.push(initialPrompt);
    }

    let stdout = '';
    let stderr = '';

    const pythonProcess = spawn('python3', args);

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress but don't treat as error
      if (stderr.includes('ERROR') || stderr.includes('Error')) {
        console.error('Python stderr:', data.toString());
      }
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process error:', stderr);
        reject(new Error(`Transcription failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Transcription failed'));
        }
      } catch (error) {
        console.error('Failed to parse transcription output:', stdout);
        reject(new Error(`Failed to parse transcription output: ${error.message}`));
      }
    });

    pythonProcess.on('error', (error) => {
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
  if (!text) return '';
  return text.slice(-length).trim();
}

/**
 * Format segments as SRT entries
 * @param {Array} segments - Array of segment objects
 * @param {number} timeOffset - Time offset in seconds
 * @returns {Array} - Array of SRT entries
 */
function formatSegmentsAsSRT(segments, timeOffset = 0) {
  return segments.map(segment => ({
    start: segment.start + timeOffset,
    end: segment.end + timeOffset,
    text: segment.text
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

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

/**
 * Generate SRT file content from captions
 * @param {Array} captions - Array of caption objects with start, end, text
 * @returns {string} - SRT file content
 */
function generateSRTContent(captions) {
  let srtContent = '';

  captions.forEach((caption, index) => {
    srtContent += `${index + 1}\n`;
    srtContent += `${secondsToSRTTime(caption.start)} --> ${secondsToSRTTime(caption.end)}\n`;
    srtContent += `${caption.text}\n\n`;
  });

  return srtContent;
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

    fs.writeFile(filePath, srtContent, 'utf8', (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`SRT file saved: ${filePath}`);
        resolve(filePath);
      }
    });
  });
}

module.exports = {
  transcribeChunk,
  getContextFromText,
  formatSegmentsAsSRT,
  generateSRTContent,
  saveSRTFile,
  secondsToSRTTime
};
