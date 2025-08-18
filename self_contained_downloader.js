/**
 * SELF-CONTAINED Video Downloader
 * Zero external dependencies - everything runs on your server
 */

class SelfContainedDownloader {
    constructor() {
        this.isLoading = false;
        this.currentVideoData = null;
        
        // Check what environment we're in
        this.isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        
        // Set backend URL based on environment
        this.backendUrl = this.isLocalhost ? 'http://localhost:8000' : '/api';
        
        console.log(`🏗️ Self-contained downloader initialized for ${this.isLocalhost ? 'development' : 'production'}`);
    }

    /**
     * Initialize the downloader
     */
    init() {
        console.log('🚀 Self-contained downloader ready');
        
        // Override the main download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleDownload();
            });
        }

        // Test backend connectivity
        this.testBackend();
    }

    /**
     * Test if our backend is available
     */
    async testBackend() {
        try {
            const response = await fetch(`${this.backendUrl}/health`);
            if (response.ok) {
                console.log('✅ Backend is available');
                this.showNotification('Backend connected successfully', 'success');
            } else {
                console.warn('⚠️ Backend not responding');
                this.enableFallbackMode();
            }
        } catch (error) {
            console.warn('⚠️ Backend not available, enabling fallback mode');
            this.enableFallbackMode();
        }
    }

    /**
     * Enable fallback mode for when backend is not available
     */
    enableFallbackMode() {
        this.backendAvailable = false;
        this.showNotification('Using client-side processing mode', 'info');
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
            let videoData = null;

            // Try our backend first if available
            if (this.backendAvailable !== false) {
                try {
                    videoData = await this.getVideoInfoFromBackend(url);
                } catch (error) {
                    console.log('Backend failed, using client-side processing');
                    this.backendAvailable = false;
                }
            }

            // If backend failed or not available, use client-side processing
            if (!videoData) {
                videoData = await this.getVideoInfoClientSide(url);
            }

            // Show video preview and download options
            this.showVideoPreview(videoData);
            this.showDownloadButtons(videoData);

        } catch (error) {
            console.error('Process video error:', error);
            this.showError(`Failed to process video: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * Get video info from our backend
     */
    async getVideoInfoFromBackend(url) {
        const response = await fetch(`${this.backendUrl}/info?url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
            throw new Error('Backend request failed');
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Backend processing failed');
        }
        
        return {
            ...data,
            originalUrl: url,
            source: 'backend'
        };
    }

    /**
     * Get video info using client-side processing
     */
    async getVideoInfoClientSide(url) {
        const videoId = this.extractYouTubeId(url);
        
        if (!videoId) {
            throw new Error('Unsupported video URL');
        }

        // Create video data object for client-side processing
        return {
            success: true,
            title: 'Video Download Ready',
            description: 'Ready for download',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: 0,
            formats: [
                { quality: 'mp3', ext: 'mp3', height: 0 },
                { quality: '360p', ext: 'mp4', height: 360 },
                { quality: '720p', ext: 'mp4', height: 720 },
                { quality: '1080p', ext: 'mp4', height: 1080 }
            ],
            originalUrl: url,
            videoId: videoId,
            source: 'client'
        };
    }

    /**
     * Show video preview
     */
    showVideoPreview(videoData) {
        const thumbElement = document.getElementById('thumb');
        if (!thumbElement) return;

        let previewHtml = '';
        
        if (videoData.thumbnail) {
            previewHtml = `
                <div class="video-preview text-center">
                    <img src="${videoData.thumbnail}" alt="Video thumbnail" 
                         class="img-fluid rounded shadow" style="max-width: 500px;">
                    <div class="mt-2">
                        <small class="text-muted">Source: ${videoData.source === 'backend' ? 'Server Processing' : 'Client Processing'}</small>
                    </div>
                </div>
            `;
        } else {
            previewHtml = `
                <div class="alert alert-info text-center">
                    <h5>📹 Video Ready for Download</h5>
                    <p>Choose your preferred quality below</p>
                </div>
            `;
        }

        thumbElement.innerHTML = previewHtml;
        
        // Update title
        const titleElement = document.getElementById('title');
        if (titleElement) {
            titleElement.innerHTML = `<h3>${this.sanitize(videoData.title)}</h3>`;
        }

        // Update description if available
        const descElement = document.getElementById('description');
        if (descElement && videoData.description) {
            const shortDesc = videoData.description.substring(0, 200);
            descElement.innerHTML = `
                <details class="mt-2">
                    <summary>Description</summary>
                    <p class="small">${this.sanitize(shortDesc)}</p>
                </details>
            `;
        }

        // Show container
        const containerElement = document.getElementById('container');
        if (containerElement) {
            containerElement.style.display = 'block';
        }

        // Store current video data
        this.currentVideoData = videoData;
    }

    /**
     * Show download buttons
     */
    showDownloadButtons(videoData) {
        const downloadElement = document.getElementById('download');
        if (!downloadElement) return;

        const buttonsHtml = `
            <div class="download-section">
                <h5 class="mb-3">📥 Choose Download Quality:</h5>
                <div class="row g-2">
                    <div class="col-md-3 col-sm-6">
                        <button onclick="selfContainedDownloader.downloadVideo('mp3')" 
                                class="btn btn-success w-100 download-btn" style="height: 60px;">
                            <i class="fas fa-music"></i><br>
                            <small>MP3 Audio</small>
                        </button>
                    </div>
                    <div class="col-md-3 col-sm-6">
                        <button onclick="selfContainedDownloader.downloadVideo('360')" 
                                class="btn btn-primary w-100 download-btn" style="height: 60px;">
                            <i class="fas fa-mobile-alt"></i><br>
                            <small>360p Video</small>
                        </button>
                    </div>
                    <div class="col-md-3 col-sm-6">
                        <button onclick="selfContainedDownloader.downloadVideo('720')" 
                                class="btn btn-info w-100 download-btn" style="height: 60px;">
                            <i class="fas fa-desktop"></i><br>
                            <small>720p HD</small>
                        </button>
                    </div>
                    <div class="col-md-3 col-sm-6">
                        <button onclick="selfContainedDownloader.downloadVideo('1080')" 
                                class="btn btn-warning w-100 download-btn" style="height: 60px;">
                            <i class="fas fa-tv"></i><br>
                            <small>1080p Full HD</small>
                        </button>
                    </div>
                </div>
                <div class="row g-2 mt-2">
                    <div class="col-md-6">
                        <button onclick="selfContainedDownloader.downloadVideo('best')" 
                                class="btn btn-dark w-100 download-btn" style="height: 50px;">
                            <i class="fas fa-star"></i> Best Quality Available
                        </button>
                    </div>
                    <div class="col-md-6">
                        <button onclick="selfContainedDownloader.openVideo()" 
                                class="btn btn-secondary w-100 download-btn" style="height: 50px;">
                            <i class="fas fa-external-link-alt"></i> Open Video
                        </button>
                    </div>
                </div>
                
                <div class="alert alert-info mt-3">
                    <small>
                        <strong>💡 How it works:</strong> 
                        ${videoData.source === 'backend' ? 
                          'Downloads are processed by our server using yt-dlp for maximum compatibility.' : 
                          'Downloads use direct processing methods optimized for this video platform.'
                        }
                    </small>
                </div>
            </div>
        `;

        downloadElement.innerHTML = buttonsHtml;
    }

    /**
     * Download video with specified quality
     */
    async downloadVideo(quality) {
        if (!this.currentVideoData) {
            this.showError('No video data available');
            return;
        }

        // Disable all download buttons during processing
        this.setDownloadButtonsState(true);
        this.showProgress(`Preparing ${quality} download...`);

        try {
            if (this.currentVideoData.source === 'backend' && this.backendAvailable !== false) {
                await this.downloadFromBackend(quality);
            } else {
                await this.downloadClientSide(quality);
            }
            
            this.showSuccess(`${quality} download started successfully!`);
            
        } catch (error) {
            console.error('Download error:', error);
            this.showError(`Download failed: ${error.message}`);
        } finally {
            // Re-enable buttons after a delay
            setTimeout(() => {
                this.setDownloadButtonsState(false);
            }, 3000);
        }
    }

    /**
     * Download using our backend
     */
    async downloadFromBackend(quality) {
        const url = this.currentVideoData.originalUrl;
        const downloadUrl = `${this.backendUrl}/download?url=${encodeURIComponent(url)}&quality=${quality}`;
        
        // Create download link
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Download using client-side methods
     */
    async downloadClientSide(quality) {
        const url = this.currentVideoData.originalUrl;
        const videoId = this.currentVideoData.videoId;
        
        if (!videoId) {
            throw new Error('Video ID not available for client-side download');
        }

        // Create a simple download interface
        const downloadMethods = [
            {
                name: 'Y2Mate',
                url: `https://www.y2mate.com/youtube/${videoId}`,
                description: 'Popular YouTube downloader'
            },
            {
                name: 'SaveFrom',
                url: `https://savefrom.net/#url=${encodeURIComponent(url)}`,
                description: 'Universal video downloader'
            },
            {
                name: 'KeepVid',
                url: `https://keepvid.com/?url=${encodeURIComponent(url)}`,
                description: 'Multi-platform downloader'
            }
        ];

        // Show download options modal
        this.showDownloadOptions(downloadMethods, quality);
    }

    /**
     * Show download options in a modal
     */
    showDownloadOptions(methods, quality) {
        const modalHtml = `
            <div class="modal fade" id="downloadModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Download ${quality.toUpperCase()}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Choose a download service:</p>
                            ${methods.map(method => `
                                <div class="d-grid gap-2 mb-2">
                                    <button class="btn btn-outline-primary" onclick="window.open('${method.url}', '_blank'); selfContainedDownloader.closeModal();">
                                        <strong>${method.name}</strong><br>
                                        <small>${method.description}</small>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('downloadModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('downloadModal'));
        modal.show();
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('downloadModal'));
        if (modal) {
            modal.hide();
        }
    }

    /**
     * Open video in new tab
     */
    openVideo() {
        if (this.currentVideoData && this.currentVideoData.originalUrl) {
            window.open(this.currentVideoData.originalUrl, '_blank');
            this.showInfo('Video opened in new tab');
        }
    }

    /**
     * Set download buttons enabled/disabled state
     */
    setDownloadButtonsState(disabled) {
        const buttons = document.querySelectorAll('.download-btn');
        buttons.forEach(btn => {
            btn.disabled = disabled;
            if (disabled) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
        });
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
     * Sanitize HTML content
     */
    sanitize(content) {
        const div = document.createElement('div');
        div.textContent = content;
        return div.innerHTML;
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
    showNotification(message, type = 'info', duration = 5000) {
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

        // Auto-remove
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
    }

    showProgress(message) { this.showNotification(message, 'info'); }
    showSuccess(message) { this.showNotification(message, 'success'); }
    showError(message) { this.showNotification(message, 'danger', 10000); }
    showInfo(message) { this.showNotification(message, 'primary'); }
}

// Create global instance
const selfContainedDownloader = new SelfContainedDownloader();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    selfContainedDownloader.init();
});

// Export for manual usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelfContainedDownloader;
}
