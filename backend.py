#!/usr/bin/env python3
"""
Fallback video downloader backend using yt-dlp
This serves as a backup when external APIs fail
"""

import json
import os
import sys
import subprocess
import tempfile
import shutil
from urllib.parse import urlparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import threading
import time

class VideoDownloadHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests for video info and download"""
        parsed_path = urlparse(self.path)
        query_params = parse_qs(parsed_path.query)
        
        # Enable CORS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        if parsed_path.path == '/video-info':
            url = query_params.get('url', [''])[0]
            if url:
                try:
                    info = self.get_video_info(url)
                    self.wfile.write(json.dumps(info).encode())
                except Exception as e:
                    error_response = {
                        'error': f'Failed to get video info: {str(e)}',
                        'fallback_urls': self.generate_fallback_urls(url)
                    }
                    self.wfile.write(json.dumps(error_response).encode())
            else:
                self.wfile.write(json.dumps({'error': 'No URL provided'}).encode())
                
        elif parsed_path.path == '/download':
            url = query_params.get('url', [''])[0]
            quality = query_params.get('quality', ['best'])[0]
            if url:
                try:
                    download_url = self.get_download_url(url, quality)
                    response = {'download_url': download_url}
                    self.wfile.write(json.dumps(response).encode())
                except Exception as e:
                    error_response = {
                        'error': f'Failed to get download URL: {str(e)}',
                        'fallback_urls': self.generate_fallback_urls(url)
                    }
                    self.wfile.write(json.dumps(error_response).encode())
            else:
                self.wfile.write(json.dumps({'error': 'No URL provided'}).encode())
        else:
            self.wfile.write(json.dumps({'error': 'Invalid endpoint'}).encode())

    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def get_video_info(self, url):
        """Get video information using yt-dlp"""
        try:
            # Check if yt-dlp is installed, if not install it
            self.ensure_ytdlp_installed()
            
            cmd = ['yt-dlp', '--dump-json', '--no-download', url]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                info = json.loads(result.stdout.split('\n')[0])
                return {
                    'title': info.get('title', 'Unknown Title'),
                    'thumbnail': info.get('thumbnail', ''),
                    'duration': info.get('duration', 0),
                    'description': info.get('description', ''),
                    'formats': self.extract_formats(info.get('formats', [])),
                    'success': True
                }
            else:
                raise Exception(f"yt-dlp error: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            raise Exception("Request timeout - video processing took too long")
        except FileNotFoundError:
            raise Exception("yt-dlp not found - please install it")
        except Exception as e:
            raise Exception(f"Video info extraction failed: {str(e)}")

    def get_download_url(self, url, quality='best'):
        """Get direct download URL using yt-dlp"""
        try:
            self.ensure_ytdlp_installed()
            
            # Format quality selector
            format_selector = quality if quality in ['best', 'worst'] else f'best[height<={quality}]'
            
            cmd = ['yt-dlp', '--get-url', '-f', format_selector, url]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                download_url = result.stdout.strip().split('\n')[0]
                return download_url
            else:
                raise Exception(f"yt-dlp error: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            raise Exception("Request timeout - download URL generation took too long")
        except Exception as e:
            raise Exception(f"Download URL generation failed: {str(e)}")

    def extract_formats(self, formats):
        """Extract and format video format information"""
        extracted_formats = []
        seen_qualities = set()
        
        for fmt in formats:
            if fmt.get('vcodec') != 'none':  # Skip audio-only formats
                height = fmt.get('height', 0)
                if height and height not in seen_qualities:
                    extracted_formats.append({
                        'format_id': fmt.get('format_id', ''),
                        'quality': f"{height}p",
                        'height': height,
                        'ext': fmt.get('ext', 'mp4'),
                        'filesize': fmt.get('filesize', 0)
                    })
                    seen_qualities.add(height)
        
        # Sort by quality (highest first)
        extracted_formats.sort(key=lambda x: x['height'], reverse=True)
        return extracted_formats[:5]  # Return top 5 qualities

    def generate_fallback_urls(self, url):
        """Generate fallback download URLs for various services"""
        encoded_url = url.replace('&', '%26').replace('=', '%3D')
        
        return {
            'savefrom': f'https://savefrom.net/#url={encoded_url}',
            'y2mate': f'https://www.y2mate.com/youtube/{self.extract_video_id(url)}',
            'keepvid': f'https://keepvid.com/?url={encoded_url}',
            'clipconverter': f'https://www.clipconverter.cc/2/#url={encoded_url}',
            'onlinevideoconverter': f'https://www.onlinevideoconverter.com/success?url={encoded_url}'
        }

    def extract_video_id(self, url):
        """Extract video ID from YouTube URL"""
        if 'youtube.com' in url:
            if 'v=' in url:
                return url.split('v=')[1].split('&')[0]
            elif '/embed/' in url:
                return url.split('/embed/')[1].split('?')[0]
        elif 'youtu.be' in url:
            return url.split('youtu.be/')[1].split('?')[0]
        return ''

    def ensure_ytdlp_installed(self):
        """Ensure yt-dlp is installed"""
        try:
            subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Installing yt-dlp...")
            subprocess.run([sys.executable, '-m', 'pip', 'install', 'yt-dlp'], check=True)

def start_backend_server(port=8001):
    """Start the backend server"""
    server = HTTPServer(('localhost', port), VideoDownloadHandler)
    print(f"Starting fallback backend server on http://localhost:{port}")
    print("Available endpoints:")
    print(f"  - http://localhost:{port}/video-info?url=VIDEO_URL")
    print(f"  - http://localhost:{port}/download?url=VIDEO_URL&quality=720")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down backend server...")
        server.shutdown()

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Video Download Backend Server')
    parser.add_argument('--port', type=int, default=8001, help='Port to run the server on')
    args = parser.parse_args()
    
    start_backend_server(args.port)
