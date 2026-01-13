# Video Caption Generator

High-precision video caption generation system using **Faster-Whisper** with the **large-v3** model for 90%+ accuracy.

## 🏗️ Architecture

- **Backend**: Node.js (Express) for video uploads and processing
- **Storage**: Local filesystem with organized folders
- **Database**: MongoDB (Cloud or Local) for tracking chunk processing
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
- ✅ Cloud MongoDB Atlas integration

## 🛠️ Prerequisites

### Required Software

#### 1. **Node.js** (v16 or later)
   ```bash
   node --version
   ```
   Download from: https://nodejs.org/

#### 2. **MongoDB** (Choose one option)

**Option A: MongoDB Atlas (Cloud - Recommended)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (Free tier available)
4. Click "Connect" → "Connect your application"
5. Copy your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)
6. Save this connection string - you'll need it later

**Option B: Local MongoDB**
```bash
# Windows: Download from https://www.mongodb.com/try/download/community
# macOS:
brew tap mongodb/brew
brew install mongodb-community

# Linux (Ubuntu):
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB:
sudo systemctl start mongod
```

#### 3. **FFmpeg** (with full build)
   - **Windows**:
     1. Download from https://ffmpeg.org/download.html (Get the "full" build)
     2. Extract to `C:\ffmpeg`
     3. Add `C:\ffmpeg\bin` to your System PATH:
        - Right-click "This PC" → Properties → Advanced System Settings
        - Click "Environment Variables"
        - Under "System variables", find "Path", click "Edit"
        - Click "New" and add `C:\ffmpeg\bin`
        - Click OK on all windows
     4. Restart your terminal and verify: `ffmpeg -version`

   - **Linux**:
     ```bash
     sudo apt-get update
     sudo apt-get install ffmpeg
     ```

   - **macOS**:
     ```bash
     brew install ffmpeg
     ```

#### 4. **Python 3.10+** (REQUIRED for Whisper)
   **Windows:**
   ```bash
   # Download from https://www.python.org/downloads/
   # OR install from Microsoft Store (recommended)

   # Verify installation:
   python --version
   # or
   python3 --version
   ```

   **Linux/macOS:**
   ```bash
   python3 --version
   ```

#### 5. **Faster-Whisper Library** (REQUIRED - Must install on your PC)

   **What is Faster-Whisper?**
   Faster-Whisper is a Python library that runs the Whisper AI model on your computer. You MUST install it before running the caption generator.

   **Installation:**
   ```bash
   # Open your terminal/command prompt and run:
   pip install faster-whisper

   # OR if pip doesn't work:
   pip3 install faster-whisper

   # OR on Windows if above don't work:
   python -m pip install faster-whisper
   ```

   **Model Download (Automatic):**
   - The first time you run the caption generator, it will automatically download the `large-v3` model (~3GB)
   - This happens automatically when processing your first video
   - Models are cached in:
     - **Windows**: `C:\Users\YourName\.cache\huggingface\`
     - **Linux/Mac**: `~/.cache/huggingface/`
   - You only download once, then it's reused forever

   **Verify Installation:**
   ```bash
   python -c "from faster_whisper import WhisperModel; print('✅ Faster-Whisper installed successfully')"
   ```

#### 6. **CUDA Toolkit** (Optional but HIGHLY Recommended for Speed)

   **Only if you have NVIDIA GPU:**

   - **Why?** Makes transcription 10x faster (25min video = 2-5min instead of 25-50min)
   - **Download**: https://developer.nvidia.com/cuda-downloads
   - **Windows**: Download and run the installer
   - **After install**, update your `.env` file:
     ```env
     WHISPER_DEVICE=cuda
     WHISPER_COMPUTE_TYPE=float16
     ```

   **Don't have NVIDIA GPU?**
   - No problem! Use CPU mode (default)
   - Just slower: 25min video = 25-50min processing

## 📦 Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd caption_generator
```

### 2. Install Node.js dependencies
```bash
npm install
```

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```bash
# Copy the example file:
cp .env.example .env
```

Then edit `.env` with your settings:

```env
# Server Configuration
PORT=3000

# MongoDB Configuration
# Replace with YOUR MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/caption_generator?retryWrites=true&w=majority

# Video Processing Configuration
CHUNK_DURATION=60
MAX_CONCURRENT_VIDEOS=3

# Whisper Model Configuration
WHISPER_MODEL=large-v3
WHISPER_DEVICE=cpu          # Change to 'cuda' if you have NVIDIA GPU with CUDA
WHISPER_COMPUTE_TYPE=int8   # Change to 'float16' if using CUDA
```

### 5. Set up your MongoDB Connection String

**If using MongoDB Atlas:**
1. Log into MongoDB Atlas
2. Click "Database" → "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your actual password
6. Paste into `.env` as `MONGODB_URI`

**Example:**
```env
MONGODB_URI=mongodb+srv://myuser:MyPassword123@cluster0.abc123.mongodb.net/caption_generator?retryWrites=true&w=majority
```

**If using local MongoDB:**
```env
MONGODB_URI=mongodb://localhost:27017/caption_generator
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

**First Run Notes:**
- When you process your first video, Faster-Whisper will download the large-v3 model (~3GB)
- This is a ONE-TIME download and takes 5-10 minutes depending on your internet
- Progress is shown in the console
- After download, all future videos process immediately

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
    "createdAt": "2024-01-13T10:30:00.000Z"
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
- `transcribing` - Transcribing chunks (this is the longest step)
- `merging` - Merging captions into final SRT
- `completed` - Processing complete, SRT ready for download
- `failed` - Processing failed (check server logs)

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
- **Speed (GPU with CUDA)**: ~10x realtime (25min video = 2-5min processing)
- **Concurrent Videos**: 2-3 recommended for home PC
- **First Run**: Add 5-10 minutes for one-time model download

## 📁 Project Structure

```
caption_generator/
├── src/
│   ├── server.js              # Express server with MongoDB connection
│   ├── routes/
│   │   ├── upload.js          # Upload endpoint
│   │   └── status.js          # Status & download endpoints
│   ├── services/
│   │   ├── processor.js       # Main processing queue
│   │   └── transcription.js   # Python bridge
│   └── utils/
│       ├── database.js        # MongoDB/Mongoose models
│       └── ffmpeg.js          # Audio processing
├── transcribe.py              # Faster-Whisper script
├── uploads/                   # Uploaded videos (temp)
├── chunks/                    # Audio chunks (temp)
├── captions/                  # Final SRT files
├── package.json
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
├── .env                      # Your settings (create this)
└── README.md
```

## 🐛 Troubleshooting

### Common Issues

**1. "FFmpeg not found"**
- Ensure FFmpeg is installed and in your PATH
- Test: `ffmpeg -version`
- Windows: Make sure you added FFmpeg to System PATH and restarted terminal

**2. "ModuleNotFoundError: No module named 'faster_whisper'"**
- Faster-Whisper is NOT installed on your PC
- Fix: `pip install faster-whisper`
- Verify: `python -c "from faster_whisper import WhisperModel"`

**3. "MongoDB connection error"**
- Check your MONGODB_URI in `.env` file
- Ensure you replaced `<password>` with your actual password
- If using MongoDB Atlas, check your IP is whitelisted:
  - Go to MongoDB Atlas → Security → Network Access
  - Click "Add IP Address" → "Allow Access from Anywhere" (for testing)

**4. "Python script failed" or "Command 'python3' not found"**
- Ensure Python 3.10+ is installed: `python --version`
- Update transcription.js line 13 to use `python` instead of `python3`:
  ```javascript
  const pythonProcess = spawn('python', args);  // Change from 'python3'
  ```

**5. "Model download failed" or "Connection timeout"**
- The large-v3 model (~3GB) downloads on first use
- Ensure stable internet connection
- If download fails, delete cache and retry:
  - Windows: Delete `C:\Users\YourName\.cache\huggingface\`
  - Linux/Mac: Delete `~/.cache/huggingface/`
- Try again, it will re-download

**6. "Out of memory" error**
- Reduce `MAX_CONCURRENT_VIDEOS` in `.env` to `1` or `2`
- Use smaller model: `WHISPER_MODEL=medium` or `WHISPER_MODEL=base`
- Use int8 quantization: `WHISPER_COMPUTE_TYPE=int8`

**7. "Slow transcription (very slow processing)"**
- This is normal on CPU without GPU
- To speed up:
  - Install CUDA if you have NVIDIA GPU
  - Set `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16`
  - Or use smaller model: `WHISPER_MODEL=medium` (faster but less accurate)

**8. "Connection string error" or "Authentication failed"**
- Double-check your MongoDB connection string
- Ensure no spaces in the connection string
- Password should be URL-encoded (replace special chars):
  - `@` → `%40`
  - `#` → `%23`
  - `$` → `%24`

## 🔐 Security Notes

- This is designed for local/internal use
- Add authentication for production deployment
- Don't commit `.env` file to git (already in .gitignore)
- Use strong passwords for MongoDB
- Consider file size limits for production use

## 💡 Tips

1. **First video takes longer**: The large-v3 model downloads on first run (~3GB)
2. **GPU is much faster**: If you have NVIDIA GPU, install CUDA
3. **Monitor progress**: Check `/api/status/:videoId` to see processing progress
4. **Supported formats**: MP4, AVI, MOV, MKV, WebM, FLV
5. **Max file size**: 500MB (configurable in upload.js)

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📚 References

- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Mongoose](https://mongoosejs.com/)
