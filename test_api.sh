#!/bin/bash

# Test script for Caption Generator API
# Usage: ./test_api.sh /path/to/video.mp4

API_URL="http://localhost:3000/api"
VIDEO_FILE="$1"

if [ -z "$VIDEO_FILE" ]; then
    echo "Usage: $0 /path/to/video.mp4"
    exit 1
fi

if [ ! -f "$VIDEO_FILE" ]; then
    echo "Error: File not found: $VIDEO_FILE"
    exit 1
fi

echo "==================================="
echo "Caption Generator API Test"
echo "==================================="
echo ""

# 1. Upload video
echo "1. Uploading video..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/upload" -F "video=@$VIDEO_FILE")
echo "$UPLOAD_RESPONSE" | jq .

VIDEO_ID=$(echo "$UPLOAD_RESPONSE" | jq -r .videoId)

if [ "$VIDEO_ID" == "null" ] || [ -z "$VIDEO_ID" ]; then
    echo "Error: Upload failed"
    exit 1
fi

echo ""
echo "Video ID: $VIDEO_ID"
echo ""

# 2. Check queue status
echo "2. Checking queue status..."
curl -s "$API_URL/queue" | jq .
echo ""

# 3. Monitor processing status
echo "3. Monitoring processing status..."
echo "(Press Ctrl+C to stop monitoring)"
echo ""

while true; do
    STATUS_RESPONSE=$(curl -s "$API_URL/status/$VIDEO_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r .video.status)
    PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r .progress.percentage)

    echo "Status: $STATUS | Progress: $PROGRESS%"

    if [ "$STATUS" == "completed" ]; then
        echo ""
        echo "✅ Processing completed!"
        echo ""
        echo "Full status:"
        echo "$STATUS_RESPONSE" | jq .
        echo ""
        break
    elif [ "$STATUS" == "failed" ]; then
        echo ""
        echo "❌ Processing failed!"
        echo "$STATUS_RESPONSE" | jq .
        exit 1
    fi

    sleep 5
done

# 4. Download SRT file
echo "4. Downloading SRT file..."
OUTPUT_FILE="output_${VIDEO_ID}.srt"
curl -s "$API_URL/download/$VIDEO_ID" -o "$OUTPUT_FILE"

if [ -f "$OUTPUT_FILE" ]; then
    echo "✅ SRT file downloaded: $OUTPUT_FILE"
    echo ""
    echo "First 20 lines:"
    head -n 20 "$OUTPUT_FILE"
else
    echo "❌ Download failed"
fi

echo ""
echo "==================================="
echo "Test completed!"
echo "==================================="
