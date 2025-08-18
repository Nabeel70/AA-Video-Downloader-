#!/usr/bin/env python3
"""
Simple Video Download Backend
No external dependencies - works with basic Python only
"""

import http.server
import socketserver
import urllib.parse
import urllib.request
import json
import re
import ssl
from urllib.error import URLError, HTTPError

PORT = 8002

class VideoDownloadHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_path = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_path.query)
        
        # Add CORS headers
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        if parsed_path.path == '/video-info':
            self.handle_video_info(query_params)
        elif parsed_path.path == '/download':
            self.handle_download(query_params)
        else:
            self.send_error_response("Invalid endpoint")
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def handle_video_info(self, query_params):
        """Extract video information"""
        if 'url' not in query_params:
            self.send_error_response("URL parameter required")
            return
            
        video_url = query_params['url'][0]
        video_id = self.extract_youtube_id(video_url)
        
        if not video_id:
            self.send_error_response("Invalid YouTube URL")
            return
        
        try:
            # Get video info from YouTube
            info = self.get_youtube_info(video_id)
            response = {
                "success": True,
                "video_id": video_id,
                "title": info.get('title', 'Video'),
                "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "formats": [
                    {"quality": "mp3", "ext": "mp3", "height": 0},
                    {"quality": "360p", "ext": "mp4", "height": 360},
                    {"quality": "720p", "ext": "mp4", "height": 720},
                    {"quality": "1080p", "ext": "mp4", "height": 1080}
                ]
            }
            self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.send_error_response(f"Failed to get video info: {str(e)}")
    
    def handle_download(self, query_params):
        """Generate download URLs"""
        if 'url' not in query_params:
            self.send_error_response("URL parameter required")
            return
            
        video_url = query_params['url'][0]
        quality = query_params.get('quality', ['720'])[0]
        video_id = self.extract_youtube_id(video_url)
        
        if not video_id:
            self.send_error_response("Invalid YouTube URL")
            return
        
        # Generate direct download URLs using known working services
        download_urls = self.generate_download_urls(video_url, quality)
        
        response = {
            "success": True,
            "download_url": download_urls[0] if download_urls else None,
            "alternative_urls": download_urls,
            "quality": quality
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def extract_youtube_id(self, url):
        """Extract YouTube video ID from URL"""
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\n?#]+)',
            r'youtube\.com/watch\?.*v=([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def get_youtube_info(self, video_id):
        """Get basic video information"""
        # Simple method to get video title (this is a basic implementation)
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            
            # Create SSL context that doesn't verify certificates (for simplicity)
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            
            with urllib.request.urlopen(req, context=ctx) as response:
                html = response.read().decode('utf-8')
                
            # Extract title from HTML
            title_match = re.search(r'<title>([^<]+)</title>', html)
            title = title_match.group(1) if title_match else f"Video {video_id}"
            
            # Clean up title
            title = title.replace(' - YouTube', '').strip()
            
            return {"title": title}
        except:
            return {"title": f"Video {video_id}"}
    
    def generate_download_urls(self, video_url, quality):
        """Generate download URLs using various services"""
        encoded_url = urllib.parse.quote(video_url)
        video_id = self.extract_youtube_id(video_url)
        
        urls = []
        
        # Method 1: VKR direct download
        urls.append(f"https://vkrdownloader.xyz/server/dl.php?vkr={encoded_url}&q={quality}")
        
        # Method 2: Alternative services
        if video_id:
            urls.append(f"https://www.y2mate.com/youtube/{video_id}")
            urls.append(f"https://savefrom.net/#url={encoded_url}")
        
        # Method 3: VKR API with different parameters
        urls.append(f"https://vkrdownloader.xyz/server/force.php?vkr={encoded_url}&q={quality}")
        
        return urls
    
    def send_error_response(self, message):
        """Send error response"""
        response = {
            "success": False,
            "error": message
        }
        self.wfile.write(json.dumps(response).encode())

def start_server():
    """Start the backend server"""
    handler = VideoDownloadHandler
    
    try:
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            print(f"🚀 Simple Video Download Backend running on http://localhost:{PORT}")
            print("📍 Available endpoints:")
            print(f"   - http://localhost:{PORT}/video-info?url=VIDEO_URL")
            print(f"   - http://localhost:{PORT}/download?url=VIDEO_URL&quality=720")
            print("\n✅ No external dependencies required!")
            print("🔄 Press Ctrl+C to stop\n")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped.")
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Try stopping other servers or use a different port.")
        else:
            print(f"❌ Failed to start server: {e}")

if __name__ == "__main__":
    start_server()
