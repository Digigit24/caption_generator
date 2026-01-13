# Quick Setup Guide

Simple setup instructions for the Caption Generator backend.

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Requirements

```bash
# 1. Install Node.js (v16+)
# Download from: https://nodejs.org/

# 2. Install Python (3.10+)
# Download from: https://www.python.org/downloads/

# 3. Install FFmpeg
# Windows: https://ffmpeg.org/download.html (add to PATH)
# Mac: brew install ffmpeg
# Linux: sudo apt-get install ffmpeg

# 4. Install Faster-Whisper
pip install faster-whisper
```

### Step 2: Set Up MongoDB

**Option A: MongoDB Atlas (Cloud - Recommended)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create cluster
4. Click "Connect" → "Connect your application"
5. Copy connection string

**Option B: Local MongoDB**
```bash
# Download from: https://www.mongodb.com/try/download/community
# Starts automatically after install
```

### Step 3: Install & Configure

```bash
# Clone repository
git clone <repository-url>
cd caption_generator

# Install dependencies
npm install

# Create configuration
cp .env.example .env

# Edit .env file:
# - Add your MongoDB connection string
# - Keep other defaults
```

**Your `.env` file:**
```env
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/caption_generator
CHUNK_DURATION=60
MAX_CONCURRENT_VIDEOS=3
WHISPER_MODEL=large-v3
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

### Step 4: Start Server

```bash
npm start
```

Server runs on: `http://localhost:3000`

---

## 📝 Frontend Integration

See **API.md** for complete API documentation.

### Quick Test

```bash
# Upload video
curl -X POST http://localhost:3000/api/upload -F "video=@test.mp4"

# Get video ID from response, then check status
curl http://localhost:3000/api/status/YOUR_VIDEO_ID

# Download when complete
curl -O http://localhost:3000/api/download/YOUR_VIDEO_ID?format=srt
```

---

## 🎯 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload video file |
| `/api/status/:videoId` | GET | Check processing status |
| `/api/queue` | GET | View queue status |
| `/api/download/:videoId?format=srt` | GET | Download captions |

**Supported Caption Formats:**
- **SRT** - Universal (most video players)
- **VTT** - Web browsers (HTML5 video)
- **SBV** - Premiere Pro, Final Cut Pro, YouTube

**Max File Size:** 2GB

**Supported Video Formats:** MP4, AVI, MOV, MKV, WebM, FLV, WMV, M4V

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `MONGODB_URI` | - | MongoDB connection string |
| `CHUNK_DURATION` | 60 | Audio chunk size (seconds) |
| `MAX_CONCURRENT_VIDEOS` | 3 | Concurrent processing limit |
| `WHISPER_MODEL` | large-v3 | AI model (90%+ accuracy) |
| `WHISPER_DEVICE` | cpu | cpu or cuda (GPU) |
| `WHISPER_COMPUTE_TYPE` | int8 | int8 (CPU) or float16 (GPU) |

### GPU Acceleration (Optional)

**10x faster processing with NVIDIA GPU:**

1. Install CUDA Toolkit: https://developer.nvidia.com/cuda-downloads
2. Update `.env`:
   ```env
   WHISPER_DEVICE=cuda
   WHISPER_COMPUTE_TYPE=float16
   ```

**Performance:**
- **CPU:** 25min video = 25-50min processing
- **GPU:** 25min video = 2-5min processing

---

## 🔧 Troubleshooting

### Common Issues

**1. "FFmpeg not found"**
```bash
# Verify installation
ffmpeg -version

# Windows: Add FFmpeg to System PATH
# Mac/Linux: Reinstall via package manager
```

**2. "MongoDB connection failed"**
- Check MONGODB_URI in `.env`
- Ensure password doesn't have special characters (or URL-encode them)
- MongoDB Atlas: Whitelist your IP in Network Access

**3. "ModuleNotFoundError: faster_whisper"**
```bash
pip install faster-whisper

# Verify
python -c "from faster_whisper import WhisperModel; print('OK')"
```

**4. "Python not found"**
- Update `src/services/transcription.js` line 26:
  - Change `python3` to `python` (Windows)

**5. "First video taking too long"**
- Normal! Downloading 3GB AI model on first run
- Takes 5-10 minutes
- All future videos process immediately

---

## 📊 Processing Workflow

```
Upload → Extract Audio → Split into Chunks → Transcribe → Merge → Download
         (10s)          (30s)              (90% of time)  (5s)
```

**Processing Time:**
- Depends on video length
- ~1-2x realtime on CPU
- ~0.1x realtime on GPU
- Example: 25min video = 25-50min (CPU) or 2-5min (GPU)

---

## 🎬 How It Works

1. **Upload:** Video sent to `/api/upload`
2. **Extract:** FFmpeg extracts audio (16kHz mono WAV)
3. **Split:** Audio split at silence points (~60s chunks)
4. **Transcribe:** Faster-Whisper processes each chunk sequentially
5. **Merge:** Captions merged with timestamp offsetting
6. **Generate:** Creates SRT, VTT, and SBV files
7. **Download:** Files ready at `/api/download/:videoId`

**Audio Extraction:**
- We extract AUDIO directly from video (not 144p video)
- This saves bandwidth and processing time
- FFmpeg handles extraction automatically

---

## 📚 File Structure

```
caption_generator/
├── src/
│   ├── server.js          # Express server
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   └── utils/             # Database, FFmpeg
├── transcribe.py          # Faster-Whisper script
├── uploads/               # Temporary uploads
├── chunks/                # Temporary audio chunks
├── captions/              # Final caption files
├── .env                   # Your configuration
├── API.md                 # API documentation
└── SETUP.md              # This file
```

---

## 🚦 Production Deployment

### Environment

```env
PORT=3000
MONGODB_URI=mongodb+srv://prod_user:prod_pass@cluster.mongodb.net/captions_prod
MAX_CONCURRENT_VIDEOS=10
WHISPER_DEVICE=cuda
```

### Security

- Add authentication middleware
- Use HTTPS
- Whitelist MongoDB IPs
- Rate limit uploads
- Validate file sizes

---

## 💡 Tips

1. **First Run:** Model downloads automatically (~3GB, 5-10min)
2. **GPU:** 10x faster with NVIDIA GPU + CUDA
3. **Formats:** SRT = universal, VTT = web, SBV = Premiere Pro
4. **Polling:** Check status every 5 seconds
5. **Cleanup:** Temporary files auto-deleted after processing

---

## 📞 Support

- **Full Documentation:** See README.md
- **API Reference:** See API.md
- **Issues:** Open issue on GitHub

---

## ✅ Checklist

Before deploying, ensure:

- [ ] Node.js installed
- [ ] Python installed
- [ ] FFmpeg installed (in PATH)
- [ ] `pip install faster-whisper` completed
- [ ] MongoDB connection string in `.env`
- [ ] `npm install` completed
- [ ] Server starts without errors
- [ ] Test upload works

**Ready to integrate!** See API.md for frontend examples.
