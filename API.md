# Caption Generator API Documentation

Complete API reference for integrating the Caption Generator backend into your frontend application.

## Base URL

```
http://localhost:3000
```

Change `localhost:3000` to your deployed backend URL in production.

---

## 📋 Table of Contents

1. [Upload Video](#1-upload-video)
2. [Check Processing Status](#2-check-processing-status)
3. [Check Queue Status](#3-check-queue-status)
4. [Download Captions](#4-download-captions)
5. [Error Handling](#error-handling)
6. [Caption Formats](#caption-formats)
7. [Example Frontend Integration](#example-frontend-integration)

---

## 1. Upload Video

Upload a video file for caption generation.

### **Endpoint**
```
POST /api/upload
```

### **Request**

**Content-Type:** `multipart/form-data`

**Form Field:** `video` (File)

**Supported Formats:**
- MP4, AVI, MOV, MKV, WebM, FLV, WMV, M4V

**Maximum File Size:** 2GB

### **cURL Example**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "video=@/path/to/video.mp4"
```

### **JavaScript (Fetch)**
```javascript
const formData = new FormData();
formData.append('video', videoFile); // videoFile is a File object

const response = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data);
```

### **React Example**
```jsx
const handleUpload = async (file) => {
  const formData = new FormData();
  formData.append('video', file);

  try {
    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      console.log('Video uploaded! Video ID:', data.videoId);
      // Start polling for status using data.videoId
      pollStatus(data.videoId);
    }
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### **Success Response**
```json
{
  "success": true,
  "videoId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "filename": "my_video.mp4",
  "message": "Video uploaded successfully and queued for processing"
}
```

### **Error Responses**

**No File Provided (400)**
```json
{
  "success": false,
  "error": "No video file provided"
}
```

**File Too Large (400)**
```json
{
  "success": false,
  "error": "File too large. Maximum size is 2GB"
}
```

**Invalid File Type (400)**
```json
{
  "success": false,
  "error": "Invalid file type. Allowed: .mp4, .avi, .mov, .mkv, .webm, .flv, .wmv, .m4v"
}
```

---

## 2. Check Processing Status

Check the current processing status of an uploaded video.

### **Endpoint**
```
GET /api/status/:videoId
```

### **Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `videoId` | String | Yes | The video ID returned from upload |

### **cURL Example**
```bash
curl http://localhost:3000/api/status/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### **JavaScript (Fetch)**
```javascript
const videoId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const response = await fetch(`http://localhost:3000/api/status/${videoId}`);
const data = await response.json();

console.log('Status:', data.video.status);
console.log('Progress:', data.progress.percentage + '%');
```

### **React Polling Example**
```jsx
const [status, setStatus] = useState(null);

useEffect(() => {
  const pollInterval = setInterval(async () => {
    const response = await fetch(`http://localhost:3000/api/status/${videoId}`);
    const data = await response.json();

    setStatus(data);

    // Stop polling when completed or failed
    if (data.video.status === 'completed' || data.video.status === 'failed') {
      clearInterval(pollInterval);
    }
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(pollInterval);
}, [videoId]);
```

### **Success Response**
```json
{
  "success": true,
  "video": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "filename": "my_video.mp4",
    "status": "transcribing",
    "createdAt": "2024-01-13T10:30:00.000Z",
    "completedAt": null
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

### **Status Values**

| Status | Description | User Message |
|--------|-------------|--------------|
| `uploaded` | Video uploaded, waiting in queue | "Waiting in queue..." |
| `extracting_audio` | Extracting audio from video | "Extracting audio..." |
| `splitting` | Splitting audio into chunks | "Preparing audio..." |
| `transcribing` | AI transcription in progress | "Transcribing... (40%)" |
| `merging` | Generating final caption files | "Finalizing..." |
| `completed` | Processing complete | "Complete! Download ready" |
| `failed` | Processing failed | "Processing failed. Please retry." |

### **Error Responses**

**Video Not Found (404)**
```json
{
  "success": false,
  "error": "Video not found"
}
```

---

## 3. Check Queue Status

Get information about the processing queue (how many videos are being processed).

### **Endpoint**
```
GET /api/queue
```

### **cURL Example**
```bash
curl http://localhost:3000/api/queue
```

### **JavaScript (Fetch)**
```javascript
const response = await fetch('http://localhost:3000/api/queue');
const data = await response.json();

console.log(`Queue: ${data.queue.queueSize} waiting`);
console.log(`Processing: ${data.queue.activeProcesses} videos`);
```

### **Success Response**
```json
{
  "success": true,
  "queue": {
    "queueSize": 2,
    "activeProcesses": 3,
    "maxConcurrent": 3,
    "queuedVideos": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "b2c3d4e5-f6g7-8901-bcde-fg2345678901"
    ]
  }
}
```

**Use this to show users:**
- "Processing X videos..."
- "Y videos ahead of you in queue"
- Estimated wait time calculations

---

## 4. Download Captions

Download caption files in SRT, VTT, or SBV format.

### **Endpoint**
```
GET /api/download/:videoId?format=srt|vtt|sbv
```

### **Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoId` | String | Yes | - | The video ID |
| `format` | String | No | `srt` | Caption format (`srt`, `vtt`, or `sbv`) |

### **Supported Formats**

| Format | Extension | Use Case |
|--------|-----------|----------|
| **SRT** | `.srt` | Most video players, Universal |
| **VTT** | `.vtt` | Web browsers, HTML5 video |
| **SBV** | `.sbv` | YouTube, Premiere Pro, Final Cut Pro |

### **cURL Examples**

**Download SRT (default)**
```bash
curl -O http://localhost:3000/api/download/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Download VTT**
```bash
curl -O http://localhost:3000/api/download/a1b2c3d4-e5f6-7890-abcd-ef1234567890?format=vtt
```

**Download SBV (Premiere Pro compatible)**
```bash
curl -O http://localhost:3000/api/download/a1b2c3d4-e5f6-7890-abcd-ef1234567890?format=sbv
```

### **JavaScript (Fetch)**
```javascript
const videoId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const format = 'srt'; // or 'vtt', 'sbv'

// Trigger browser download
window.location.href = `http://localhost:3000/api/download/${videoId}?format=${format}`;
```

### **React Download Button**
```jsx
const DownloadButton = ({ videoId, format = 'srt' }) => {
  const handleDownload = () => {
    const url = `http://localhost:3000/api/download/${videoId}?format=${format}`;
    window.location.href = url;
  };

  return (
    <button onClick={handleDownload}>
      Download {format.toUpperCase()}
    </button>
  );
};
```

### **React - Download All Formats**
```jsx
const DownloadAllFormats = ({ videoId }) => {
  const formats = ['srt', 'vtt', 'sbv'];

  const downloadFormat = (format) => {
    const url = `http://localhost:3000/api/download/${videoId}?format=${format}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `captions.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <h3>Download Captions:</h3>
      {formats.map(format => (
        <button key={format} onClick={() => downloadFormat(format)}>
          {format.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
```

### **Error Responses**

**Video Not Completed (400)**
```json
{
  "success": false,
  "error": "Video processing not completed yet",
  "status": "transcribing"
}
```

**Caption File Not Found (404)**
```json
{
  "success": false,
  "error": "Caption file not found (vtt format)"
}
```

**Invalid Format (400)**
```json
{
  "success": false,
  "error": "Invalid format. Allowed formats: srt, vtt, sbv"
}
```

---

## Error Handling

### **Common Error Codes**

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Invalid input, file too large, wrong format |
| 404 | Not Found | Video ID doesn't exist, file not ready |
| 500 | Server Error | Backend processing error |

### **Error Response Format**
```json
{
  "success": false,
  "error": "Error message here"
}
```

### **JavaScript Error Handling**
```javascript
try {
  const response = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!data.success) {
    // Handle API error
    alert(`Error: ${data.error}`);
    return;
  }

  // Success
  console.log('Uploaded:', data.videoId);

} catch (error) {
  // Handle network/fetch error
  console.error('Network error:', error);
  alert('Failed to connect to server');
}
```

---

## Caption Formats

### **SRT (SubRip)**
Most common format, works everywhere.

**Example:**
```
1
00:00:01,000 --> 00:00:04,500
Welcome to our video tutorial

2
00:00:05,000 --> 00:00:08,200
Today we'll learn about captions
```

**Best for:** VLC, MPC-HC, most video players

---

### **VTT (WebVTT)**
Web-native format, best for HTML5 video.

**Example:**
```
WEBVTT

1
00:00:01.000 --> 00:00:04.500
Welcome to our video tutorial

2
00:00:05.000 --> 00:00:08.200
Today we'll learn about captions
```

**Best for:** Web browsers, HTML5 `<video>` tag

**HTML5 Integration:**
```html
<video controls>
  <source src="video.mp4" type="video/mp4">
  <track kind="captions" src="captions.vtt" srclang="en" label="English">
</video>
```

---

### **SBV (SubViewer)**
YouTube and video editing software format.

**Example:**
```
0:00:01.000,0:00:04.500
Welcome to our video tutorial

0:00:05.000,0:00:08.200
Today we'll learn about captions
```

**Best for:** Adobe Premiere Pro, Final Cut Pro, YouTube

---

## Example Frontend Integration

### **Complete React Component**

```jsx
import { useState } from 'react';

const CaptionGenerator = () => {
  const [file, setFile] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);

  const API_BASE = 'http://localhost:3000';

  // Handle file selection
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Upload video
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setVideoId(data.videoId);
        startPolling(data.videoId);
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      alert('Upload failed: Network error');
    } finally {
      setUploading(false);
    }
  };

  // Poll for status
  const startPolling = (id) => {
    const interval = setInterval(async () => {
      const response = await fetch(`${API_BASE}/api/status/${id}`);
      const data = await response.json();

      setStatus(data);

      if (data.video.status === 'completed' || data.video.status === 'failed') {
        clearInterval(interval);
      }
    }, 5000);
  };

  // Download caption
  const handleDownload = (format) => {
    window.location.href = `${API_BASE}/api/download/${videoId}?format=${format}`;
  };

  return (
    <div>
      <h1>Video Caption Generator</h1>

      {/* Upload Section */}
      <div>
        <input type="file" onChange={handleFileChange} accept="video/*" />
        <button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>
      </div>

      {/* Status Section */}
      {status && (
        <div>
          <h2>Status: {status.video.status}</h2>
          <p>Progress: {status.progress.percentage}%</p>
          <p>Captions generated: {status.captions.count}</p>
        </div>
      )}

      {/* Download Section */}
      {status?.video.status === 'completed' && (
        <div>
          <h2>Download Captions:</h2>
          <button onClick={() => handleDownload('srt')}>SRT</button>
          <button onClick={() => handleDownload('vtt')}>VTT</button>
          <button onClick={() => handleDownload('sbv')}>SBV</button>
        </div>
      )}
    </div>
  );
};

export default CaptionGenerator;
```

---

## Summary for Frontend Developers

**Quick Integration Steps:**

1. **Upload:** POST file to `/api/upload`, get `videoId`
2. **Poll:** GET `/api/status/:videoId` every 5 seconds
3. **Download:** When status = `completed`, GET `/api/download/:videoId?format=srt`

**Important Notes:**
- Max file size: 2GB
- Supported formats: MP4, AVI, MOV, MKV, WebM, FLV, WMV, M4V
- Caption formats: SRT (universal), VTT (web), SBV (Premiere Pro)
- Processing time: ~1-2x realtime on CPU, ~0.1x on GPU
- First video takes longer (~5-10min extra for model download)

**Need Help?**
Check the main README.md for backend setup or open an issue on GitHub.
