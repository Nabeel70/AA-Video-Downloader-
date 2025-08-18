/**
 * Simple Video Downloader - Works on any hosting platform
 * No localhost dependencies, pure client-side solution
 */

class SimpleDownloader {
    constructor() {
        this.isLoading = false;
        this.currentVideoUrl = null;
    }

    /**
     * Initialize the downloader
     */
    init() {
        console.log('🚀 Simple Downloader initialized');
        
        // Override the main download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleDownload();
            });
        }

        // Check if we're on localhost vs production
        this.isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        
        if (!this.isLocalhost) {
            console.log('🌐 Running on production - using direct download methods');
        }
    }

    /**
     * Handle download button click
     */
    async handleDownload() {
        const urlInput = document.getElementById('inputUrl');
        if (!urlInput) {
            this.showError('URL input not found');
            return;
        }

        const url = urlInput.value.trim();
        if (!url) {
            this.showError('Please enter a video URL');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showError('Please enter a valid video URL');
            return;
        }

        this.currentVideoUrl = url;
        await this.processVideo(url);
    }

    /**
     * Process video URL and show download options
     */
    async processVideo(url) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        try {
            // Get video ID for thumbnail
            const videoId = this.extractYouTubeId(url);
            
            // Show video preview immediately
            this.showVideoPreview(url, videoId);
            
            // Show download buttons
            this.showDownloadButtons(url, videoId);

        } catch (error) {
            console.error('Process video error:', error);
            this.showError(`Failed to process video: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * Show video preview
     */
    showVideoPreview(url, videoId) {
        const thumbElement = document.getElementById('thumb');
        if (!thumbElement) return;

        let thumbnailHtml = '';
        
        if (videoId) {
            const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            thumbnailHtml = `
                <div class="video-preview">
                    <img src="${thumbnailUrl}" alt="Video thumbnail" 
                         style="width: 100%; max-width: 500px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                    <div class="video-overlay">
                        <i class="fa fa-play-circle" style="font-size: 64px; color: white; opacity: 0.8;"></i>
                    </div>
                </div>
            `;
        } else {
            thumbnailHtml = `
                <div class="alert alert-info">
                    <h5>📹 Video Ready for Download</h5>
                    <p>Choose your preferred quality below:</p>
                </div>
            `;
        }

        thumbElement.innerHTML = thumbnailHtml;
        
        // Update title
        const titleElement = document.getElementById('title');
        if (titleElement) {
            titleElement.innerHTML = '<h3>🎬 Video Download Ready</h3>';
        }

        // Show container
        const containerElement = document.getElementById('container');
        if (containerElement) {
            containerElement.style.display = 'block';
        }
    }

    /**
     * Show download buttons
     */
    showDownloadButtons(url, videoId) {
        const downloadElement = document.getElementById('download');
        if (!downloadElement) return;

        const encodedUrl = encodeURIComponent(url);
        
        const buttonsHtml = `
            <div class="download-section">
                <h5>📥 Choose Download Quality:</h5>
                <div class="row g-2 mt-3">
                    <div class="col-md-3">
                        <button onclick="simpleDownloader.directDownload('${encodedUrl}', 'mp3', 'audio')" 
                                class="btn btn-success w-100" style="height: 50px;">
                            🎵<br>MP3 Audio
                        </button>
                    </div>
                    <div class="col-md-3">
                        <button onclick="simpleDownloader.directDownload('${encodedUrl}', '360', 'video')" 
                                class="btn btn-primary w-100" style="height: 50px;">
                            📱<br>360p Video
                        </button>
                    </div>
                    <div class="col-md-3">
                        <button onclick="simpleDownloader.directDownload('${encodedUrl}', '720', 'video')" 
                                class="btn btn-info w-100" style="height: 50px;">
                            📹<br>720p Video
                        </button>
                    </div>
                    <div class="col-md-3">
                        <button onclick="simpleDownloader.directDownload('${encodedUrl}', '1080', 'video')" 
                                class="btn btn-warning w-100" style="height: 50px;">
                            🎬<br>1080p Video
                        </button>
                    </div>
                </div>
                <div class="row g-2 mt-2">
                    <div class="col-md-6">
                        <button onclick="simpleDownloader.directDownload('${encodedUrl}', 'best', 'video')" 
                                class="btn btn-dark w-100" style="height: 50px;">
                            ⭐ Best Quality Available
                        </button>
                    </div>
                    <div class="col-md-6">
                        <button onclick="simpleDownloader.openInNewTab('${url}')" 
                                class="btn btn-secondary w-100" style="height: 50px;">
                            🔗 Open Video Page
                        </button>
                    </div>
                </div>
                <div class="alert alert-info mt-3">
                    <small>
                        <strong>💡 Tip:</strong> Downloads work directly without redirects. 
                        If a quality isn't available, we'll automatically provide the best alternative.
                    </small>
                </div>
            </div>
        `;

        downloadElement.innerHTML = buttonsHtml;
    }

    /**
     * Direct download method
     */
    async directDownload(encodedUrl, quality, format) {
        const url = decodeURIComponent(encodedUrl);
        
        // Show progress
        this.showProgress(`Preparing ${quality} ${format} download...`);
        
        try {
            // Method 1: Try VKR direct download
            const success = await this.tryVKRDownload(url, quality, format);
            
            if (success) {
                this.showSuccess(`${quality} ${format} download started!`);
            } else {
                // Method 2: Try alternative download services
                await this.tryAlternativeDownload(url, quality, format);
            }
            
        } catch (error) {
            console.error('Download error:', error);
            this.showError(`Download failed. Please try a different quality or check the video URL.`);
        }
    }

    /**
     * Try VKR download
     */
    async tryVKRDownload(url, quality, format) {
        try {
            // Use VKR's direct download endpoint
            const downloadUrl = `https://vkrdownloader.xyz/server/dl.php?vkr=${encodeURIComponent(url)}&q=${quality}`;
            
            // Create download link
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `video_${quality}.${format === 'audio' ? 'mp3' : 'mp4'}`;
            link.target = '_blank';
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return true;
        } catch (error) {
            console.error('VKR download failed:', error);
            return false;
        }
    }

    /**
     * Try alternative download methods
     */
    async tryAlternativeDownload(url, quality, format) {
        const videoId = this.extractYouTubeId(url);
        
        if (videoId) {
            // Generate alternative download URLs
            const alternatives = [
                `https://www.y2mate.com/youtube/${videoId}`,
                `https://savefrom.net/#url=${encodeURIComponent(url)}`,
                `https://keepvid.com/?url=${encodeURIComponent(url)}`
            ];
            
            // Open the first alternative in a new tab
            window.open(alternatives[0], '_blank');
            this.showInfo('Alternative download service opened in new tab');
        } else {
            this.showError('Unable to process this video URL');
        }
    }

    /**
     * Open video in new tab
     */
    openInNewTab(url) {
        window.open(url, '_blank');
        this.showInfo('Video opened in new tab');
    }

    /**
     * Extract YouTube video ID
     */
    extractYouTubeId(url) {
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

    /**
     * Validate URL
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'block';
            loadingElement.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Processing video...</p>
                </div>
            `;
        }

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.disabled = true;
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) loadingElement.style.display = 'none';

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.disabled = false;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingAlerts = document.querySelectorAll('.download-notification');
        existingAlerts.forEach(alert => alert.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} download-notification mt-3`;
        notification.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;

        // Insert notification
        const container = document.getElementById('container') || document.body;
        container.insertBefore(notification, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showProgress(message) { this.showNotification(message, 'info'); }
    showSuccess(message) { this.showNotification(message, 'success'); }
    showError(message) { this.showNotification(message, 'danger'); }
    showInfo(message) { this.showNotification(message, 'primary'); }
}

// Create global instance
const simpleDownloader = new SimpleDownloader();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    simpleDownloader.init();
});

// Export for manual usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleDownloader;
}
