#!/usr/bin/env python3
"""
Faster-Whisper transcription script for high-precision caption generation.
This script uses the large-v3 model for 90%+ accuracy.
"""

import sys
import json
import os
from faster_whisper import WhisperModel

def transcribe_chunk(file_path, model_name="large-v3", device="cpu", compute_type="int8", initial_prompt=""):
    """
    Transcribe an audio chunk using Faster-Whisper.

    Args:
        file_path: Path to the audio chunk file
        model_name: Whisper model to use (default: large-v3)
        device: Device to run on (cpu or cuda)
        compute_type: Computation type (int8, int16, float16, float32)
        initial_prompt: Text from previous chunk for context continuity

    Returns:
        List of segment dictionaries with timestamps and text
    """
    try:
        # Initialize model (it will be cached after first load)
        model = WhisperModel(model_name, device=device, compute_type=compute_type)

        # Transcribe with optional context from previous chunk
        segments, info = model.transcribe(
            file_path,
            initial_prompt=initial_prompt if initial_prompt else None,
            beam_size=5,
            best_of=5,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500
            )
        )

        # Collect all segments
        results = []
        for segment in segments:
            results.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            })

        # Return as JSON
        return {
            "success": True,
            "language": info.language,
            "duration": info.duration,
            "segments": results
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    """
    Main entry point for the transcription script.
    Expects command-line arguments:
        1. file_path - Path to audio file
        2. model_name - Whisper model (optional, default: large-v3)
        3. device - Device to use (optional, default: cpu)
        4. compute_type - Compute type (optional, default: int8)
        5. initial_prompt - Context from previous chunk (optional)
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: transcribe.py <file_path> [model_name] [device] [compute_type] [initial_prompt]"
        }))
        sys.exit(1)

    file_path = sys.argv[1]

    # Check if file exists
    if not os.path.exists(file_path):
        print(json.dumps({
            "success": False,
            "error": f"File not found: {file_path}"
        }))
        sys.exit(1)

    # Parse optional arguments
    model_name = sys.argv[2] if len(sys.argv) > 2 else "large-v3"
    device = sys.argv[3] if len(sys.argv) > 3 else "cpu"
    compute_type = sys.argv[4] if len(sys.argv) > 4 else "int8"
    initial_prompt = sys.argv[5] if len(sys.argv) > 5 else ""

    # Perform transcription
    result = transcribe_chunk(file_path, model_name, device, compute_type, initial_prompt)

    # Output result as JSON
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
