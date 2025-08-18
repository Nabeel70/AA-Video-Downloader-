#!/bin/bash
# Start Video Download Backend

echo "🚀 Starting Video Download API with yt-dlp..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if pip is available
if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    echo "❌ pip is required but not installed."
    exit 1
fi

# Install requirements
echo "📦 Installing requirements..."
pip3 install -r requirements.txt || pip install -r requirements.txt

# Check if yt-dlp is working
echo "🔧 Testing yt-dlp..."
python3 -c "import yt_dlp; print('✅ yt-dlp is working')" || {
    echo "❌ yt-dlp installation failed"
    exit 1
}

# Start the server
echo "🌟 Starting FastAPI server on http://localhost:8000"
echo ""
echo "📍 Available endpoints:"
echo "   - GET  /info?url=VIDEO_URL          - Get video information"
echo "   - GET  /download?url=VIDEO_URL      - Download video file"
echo "   - GET  /stream?url=VIDEO_URL        - Get direct stream URL"
echo "   - GET  /health                      - Health check"
echo ""
echo "💡 Test with: curl 'http://localhost:8000/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ'"
echo ""

python3 app.py
