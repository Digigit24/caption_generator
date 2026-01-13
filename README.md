# Video Caption Generator

High-precision video caption generation system using **Faster-Whisper** with the **large-v3** model for 90%+ accuracy.

## 🏗️ Architecture

- **Backend**: Node.js (Express) for video uploads and processing
- **Storage**: Local filesystem with organized folders
- **Database**: SQLite for tracking chunk processing
- **Audio Processing**: FFmpeg for extraction and intelligent splitting
- **AI Engine**: Faster-Whisper (Python) with large-v3 model
- **Context Preservation**: Sequential processing with initial_prompt for anti-hallucination

## ✨ Features

- ✅ Intelligent audio splitting at silence points (no cut words)
- ✅ Sequential chunk transcription with context preservation
- ✅ 90%+ accuracy using Faster-Whisper large-v3
- ✅ Concurrent processing of multiple videos (configurable)
- ✅ Automatic SRT generation with precise timestamps
- ✅ REST API for easy integration
- ✅ Progress tracking and status monitoring
- ✅ Automatic cleanup of temporary files

## 🛠️ Prerequisites

### Required Software

1. **Node.js** (v16 or later)
   ```bash
   node --version
   ```

2. **FFmpeg** (with full build)
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
   - **Linux**: `sudo apt-get install ffmpeg`
   - **macOS**: `brew install ffmpeg`

3. **Python 3.10+**
   ```bash
   python3 --version
   ```

4. **Faster-Whisper Library**
   ```bash
   pip install faster-whisper
   ```

5. **CUDA Toolkit** (Optional, for GPU acceleration)
   - Only if you have NVIDIA GPU
   - Download from [NVIDIA](https://developer.nvidia.com/cuda-downloads)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd caption_generator
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   Edit `.env` file:
   ```env
   PORT=3000
   CHUNK_DURATION=60
   MAX_CONCURRENT_VIDEOS=3
   WHISPER_MODEL=large-v3
   WHISPER_DEVICE=cpu          # Change to 'cuda' for GPU
   WHISPER_COMPUTE_TYPE=int8   # Use 'float16' for GPU
   ```

4. **Make Python script executable** (Linux/macOS)
   ```bash
   chmod +x transcribe.py
   ```

## 🚀 Usage

### Start the Server

```bash
npm start
```

Or with auto-reload during development:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### API Endpoints

#### 1. Upload Video

```bash
POST /api/upload
Content-Type: multipart/form-data

# Using curl:
curl -X POST http://localhost:3000/api/upload \
  -F "video=@/path/to/your/video.mp4"

# Response:
{
  "success": true,
  "videoId": "uuid-here",
  "filename": "video.mp4",
  "message": "Video uploaded successfully and queued for processing"
}
```

#### 2. Check Processing Status

```bash
GET /api/status/:videoId

# Using curl:
curl http://localhost:3000/api/status/uuid-here

# Response:
{
  "success": true,
  "video": {
    "id": "uuid-here",
    "filename": "video.mp4",
    "status": "transcribing",
    "createdAt": "2024-01-13 10:30:00"
  },
  "progress": {
    "totalChunks": 25,
    "completedChunks": 10,
    "percentage": 40
  },
  "captions": {
    "count": 145
  }
}
```

**Status Values:**
- `uploaded` - Video uploaded, waiting in queue
- `extracting_audio` - Extracting audio from video
- `splitting` - Splitting audio into chunks
- `transcribing` - Transcribing chunks
- `merging` - Merging captions into final SRT
- `completed` - Processing complete
- `failed` - Processing failed

#### 3. Check Queue Status

```bash
GET /api/queue

# Using curl:
curl http://localhost:3000/api/queue

# Response:
{
  "success": true,
  "queue": {
    "queueSize": 2,
    "activeProcesses": 3,
    "maxConcurrent": 3,
    "queuedVideos": ["uuid-1", "uuid-2"]
  }
}
```

#### 4. Download SRT File

```bash
GET /api/download/:videoId

# Using curl:
curl -O http://localhost:3000/api/download/uuid-here

# Downloads: video.mp4.srt
```

## 🔧 How It Works

### Processing Workflow

```
1. Upload Video
   ↓
2. Extract Audio (WAV format, 16kHz mono)
   ↓
3. Detect Silence Points
   ↓
4. Split Audio at Silence (intelligent chunks ~60s)
   ↓
5. Transcribe Chunks Sequentially
   │
   ├─ Chunk 1: Transcribe with no context
   ├─ Chunk 2: Transcribe with Chunk 1's last 100 chars
   ├─ Chunk 3: Transcribe with Chunk 2's last 100 chars
   └─ ...
   ↓
6. Merge Captions with Timestamp Offsetting
   │
   ├─ Chunk 0: timestamps as-is
   ├─ Chunk 1: add 60s to all timestamps
   ├─ Chunk 2: add 120s to all timestamps
   └─ ...
   ↓
7. Generate Final SRT File
   ↓
8. Cleanup Temporary Files
```

### Key Precision Features

1. **Context Preservation**: Each chunk receives the last 100 characters from the previous chunk as `initial_prompt`, preventing hallucination at chunk boundaries.

2. **Intelligent Splitting**: Audio is split at silence points (not hard 60s cuts), preventing words from being cut in half.

3. **Large-v3 Model**: Uses the most accurate Whisper model for 90%+ precision.

4. **Sequential Processing**: Chunks are processed one-by-one to maintain perfect context flow.

## 📊 Performance

- **Accuracy**: 90%+ (using large-v3 model)
- **Speed (CPU)**: ~1-2x realtime (25min video = 25-50min processing)
- **Speed (GPU)**: ~10x realtime (25min video = 2-5min processing)
- **Concurrent Videos**: 2-3 recommended for home PC

## 📁 Project Structure

```
caption_generator/
├── src/
│   ├── server.js              # Express server
│   ├── routes/
│   │   ├── upload.js          # Upload endpoint
│   │   └── status.js          # Status & download endpoints
│   ├── services/
│   │   ├── processor.js       # Main processing queue
│   │   └── transcription.js   # Python bridge
│   └── utils/
│       ├── database.js        # SQLite operations
│       └── ffmpeg.js          # Audio processing
├── transcribe.py              # Faster-Whisper script
├── uploads/                   # Uploaded videos (temp)
├── chunks/                    # Audio chunks (temp)
├── captions/                  # Final SRT files
├── captions.db               # SQLite database
├── package.json
├── .env
└── README.md
```

## 🐛 Troubleshooting

### Common Issues

**1. "FFmpeg not found"**
- Ensure FFmpeg is installed and in your PATH
- Test: `ffmpeg -version`

**2. "Python script failed"**
- Ensure faster-whisper is installed: `pip install faster-whisper`
- Check Python path: `which python3`
- First run will download the large-v3 model (~3GB)

**3. "Out of memory"**
- Reduce `MAX_CONCURRENT_VIDEOS` in `.env`
- Use smaller model: `WHISPER_MODEL=medium`
- Use int8 quantization: `WHISPER_COMPUTE_TYPE=int8`

**4. "Model download failed"**
- The large-v3 model (~3GB) downloads on first use
- Ensure stable internet connection
- Models are cached in `~/.cache/huggingface/`

**5. "Slow transcription"**
- Install CUDA if you have NVIDIA GPU
- Set `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16`
- Or use a smaller model: `WHISPER_MODEL=medium`

## 🔐 Security Notes

- This is designed for local/internal use
- Add authentication for production deployment
- Consider file size limits for your use case
- Sanitize uploaded filenames in production

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📚 References

- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
