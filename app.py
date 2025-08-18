#!/usr/bin/env python3
"""
FastAPI + yt-dlp Backend for Video Downloading
Clean, reliable, no external dependencies except yt-dlp
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp
import os
import uuid
import tempfile
import asyncio
from pathlib import Path
import json
from typing import Optional

app = FastAPI(title="Video Download API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create downloads directory
DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

@app.get("/")
def root():
    return {
        "status": "yt-dlp Video Download API running",
        "version": "1.0.0",
        "endpoints": {
            "info": "/info?url=VIDEO_URL",
            "download": "/download?url=VIDEO_URL&quality=720p",
            "stream": "/stream?url=VIDEO_URL&quality=best"
        }
    }

@app.get("/info")
async def get_video_info(url: str = Query(..., description="Video URL to analyze")):
    """Get video information without downloading"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Extract useful information
            formats = []
            if 'formats' in info:
                seen_qualities = set()
                for fmt in info['formats']:
                    if fmt.get('vcodec') != 'none':  # Skip audio-only
                        height = fmt.get('height', 0)
                        if height and height not in seen_qualities:
                            formats.append({
                                'quality': f"{height}p",
                                'height': height,
                                'ext': fmt.get('ext', 'mp4'),
                                'filesize': fmt.get('filesize'),
                                'format_id': fmt.get('format_id')
                            })
                            seen_qualities.add(height)
                
                # Sort by quality (highest first)
                formats.sort(key=lambda x: x['height'], reverse=True)
            
            return {
                "success": True,
                "title": info.get('title', 'Unknown'),
                "description": info.get('description', ''),
                "duration": info.get('duration', 0),
                "thumbnail": info.get('thumbnail', ''),
                "uploader": info.get('uploader', ''),
                "view_count": info.get('view_count', 0),
                "formats": formats[:10],  # Top 10 qualities
                "url": url
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract info: {str(e)}")

@app.get("/download")
async def download_video(
    url: str = Query(..., description="Video URL to download"),
    quality: str = Query("best", description="Video quality (720p, 1080p, best, worst, audio)")
):
    """Download video and return file"""
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())[:8]
        temp_dir = tempfile.mkdtemp()
        
        # Configure quality
        if quality in ['audio', 'mp3']:
            format_selector = 'bestaudio/best'
            ext = 'mp3'
            output_template = os.path.join(temp_dir, f"{file_id}.%(ext)s")
        elif quality in ['best', 'worst']:
            format_selector = quality
            ext = 'mp4'
            output_template = os.path.join(temp_dir, f"{file_id}.%(ext)s")
        else:
            # Extract number from quality (e.g., "720p" -> "720")
            height = ''.join(filter(str.isdigit, quality))
            if height:
                format_selector = f'best[height<={height}]'
            else:
                format_selector = 'best'
            ext = 'mp4'
            output_template = os.path.join(temp_dir, f"{file_id}.%(ext)s")

        ydl_opts = {
            'outtmpl': output_template,
            'format': format_selector,
            'quiet': True,
            'no_warnings': True
        }
        
        # Add post-processor for audio
        if quality in ['audio', 'mp3']:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # Find the downloaded file
            downloaded_file = None
            for file in os.listdir(temp_dir):
                if file.startswith(file_id):
                    downloaded_file = os.path.join(temp_dir, file)
                    break
            
            if not downloaded_file or not os.path.exists(downloaded_file):
                raise Exception("Downloaded file not found")
            
            # Get file info
            file_size = os.path.getsize(downloaded_file)
            filename = f"{info.get('title', 'video')[:50]}.{ext}"
            
            # Clean filename
            filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
            
            return FileResponse(
                path=downloaded_file,
                media_type=f"{'audio' if ext == 'mp3' else 'video'}/{ext}",
                filename=filename,
                headers={
                    "Content-Length": str(file_size),
                    "Content-Disposition": f'attachment; filename="{filename}"'
                }
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@app.get("/stream")
async def stream_video_url(
    url: str = Query(..., description="Video URL"),
    quality: str = Query("best", description="Video quality")
):
    """Get direct stream URL without downloading file"""
    try:
        # Configure format selector
        if quality in ['audio', 'mp3']:
            format_selector = 'bestaudio/best'
        elif quality in ['best', 'worst']:
            format_selector = quality
        else:
            height = ''.join(filter(str.isdigit, quality))
            format_selector = f'best[height<={height}]' if height else 'best'

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'format': format_selector
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Get the direct URL
            if 'url' in info:
                stream_url = info['url']
            elif 'formats' in info and info['formats']:
                # Get the best format URL
                best_format = info['formats'][-1]
                stream_url = best_format.get('url', '')
            else:
                raise Exception("No stream URL found")
            
            return {
                "success": True,
                "stream_url": stream_url,
                "title": info.get('title', 'Video'),
                "duration": info.get('duration', 0),
                "quality": quality,
                "direct_download": True
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Stream URL extraction failed: {str(e)}")

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "video-download-api"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Video Download API with yt-dlp")
    print("📍 Endpoints:")
    print("   - http://localhost:8000/info?url=VIDEO_URL")
    print("   - http://localhost:8000/download?url=VIDEO_URL&quality=720p")
    print("   - http://localhost:8000/stream?url=VIDEO_URL&quality=best")
    print("\n✅ FastAPI + yt-dlp backend ready!")
    
    uvicorn.run(
        "app:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )
