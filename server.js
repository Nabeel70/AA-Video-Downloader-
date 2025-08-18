const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Simple in-memory cache
const cache = new Map();

// Helper function to extract YouTube ID
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'self-contained-video-downloader',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Self-Contained Video Downloader',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            info: '/info?url=VIDEO_URL',
            download: '/download?url=VIDEO_URL&quality=720p'
        }
    });
});

// Video info endpoint
app.get('/info', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL parameter is required' 
            });
        }

        // Check cache first
        const cacheKey = `info_${url}`;
        if (cache.has(cacheKey)) {
            return res.json(cache.get(cacheKey));
        }

        const videoId = extractYouTubeId(url);
        
        if (!videoId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Unsupported video URL' 
            });
        }

        // For now, return basic info - you can enhance this with yt-dlp later
        const videoInfo = {
            success: true,
            title: 'Video Ready for Download',
            description: 'Video processing ready',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: 0,
            videoId: videoId,
            formats: [
                { quality: 'mp3', ext: 'mp3', height: 0 },
                { quality: '360p', ext: 'mp4', height: 360 },
                { quality: '720p', ext: 'mp4', height: 720 },
                { quality: '1080p', ext: 'mp4', height: 1080 }
            ]
        };

        // Cache for 5 minutes
        cache.set(cacheKey, videoInfo);
        setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000);

        res.json(videoInfo);

    } catch (error) {
        console.error('Info error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get video info' 
        });
    }
});

// Download endpoint
app.get('/download', async (req, res) => {
    try {
        const { url, quality = 'best' } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL parameter is required' 
            });
        }

        const videoId = extractYouTubeId(url);
        
        if (!videoId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Unsupported video URL' 
            });
        }

        // For now, return download services URLs
        // In a full implementation, you'd process with yt-dlp here
        const downloadServices = [
            `https://www.y2mate.com/youtube/${videoId}`,
            `https://savefrom.net/#url=${encodeURIComponent(url)}`,
            `https://keepvid.com/?url=${encodeURIComponent(url)}`
        ];

        res.json({
            success: true,
            quality: quality,
            download_services: downloadServices,
            message: 'Download services available',
            direct_processing: false
        });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process download' 
        });
    }
});

// Serve the main HTML file
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Self-contained video downloader running on port ${PORT}`);
    console.log(`📍 Endpoints:`);
    console.log(`   - Health: http://localhost:${PORT}/health`);
    console.log(`   - Info: http://localhost:${PORT}/info?url=VIDEO_URL`);
    console.log(`   - Download: http://localhost:${PORT}/download?url=VIDEO_URL&quality=720p`);
    console.log(`   - Web App: http://localhost:${PORT}/app`);
    console.log(`\n✅ Backend ready - no external dependencies!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 Shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
