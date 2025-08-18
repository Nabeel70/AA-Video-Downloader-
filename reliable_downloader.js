/**
 * Reliable Video Downloader - Clean yt-dlp Integration
 * Works with FastAPI backend for robust video downloading
 */

const API_BASE_URL = 'http://localhost:8000';

class ReliableDownloader {
    constructor() {
        this.isLoading = false;
        this.currentRequest = null;
    }

    /**
     * Get video information
     * @param {string} url - Video URL
     * @returns {Promise<Object>} Video info
     */
    async getVideoInfo(url) {
        try {
            const response = await fetch(`${API_BASE_URL}/info?url=${encodeURIComponent(url)}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get video info');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Video info error:', error);
            throw error;
        }
    }

    /**
     * Download video file directly
     * @param {string} url - Video URL
     * @param {string} quality - Quality (720p, 1080p, best, audio, mp3)
     */
    async downloadVideo(url, quality = 'best') {
        try {
            this.showProgress(`Preparing ${quality} download...`);
            
            const downloadUrl = `${API_BASE_URL}/download?url=${encodeURIComponent(url)}&quality=${quality}`;
            
            // Create hidden link and trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `video_${quality}.${quality === 'mp3' || quality === 'audio' ? 'mp3' : 'mp4'}`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showSuccess(`${quality} download started!`);
            
        } catch (error) {
            console.error('Download error:', error);
            this.showError(`Download failed: ${error.message}`);
        }
    }

    /**
     * Get stream URL for immediate playback/download
     * @param {string} url - Video URL
     * @param {string} quality - Quality
     * @returns {Promise<string>} Direct stream URL
     */
    async getStreamUrl(url, quality = 'best') {
        try {
            const response = await fetch(`${API_BASE_URL}/stream?url=${encodeURIComponent(url)}&quality=${quality}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get stream URL');
            }
            
            const data = await response.json();
            return data.stream_url;
        } catch (error) {
            console.error('Stream URL error:', error);
            throw error;
        }
    }

    /**
     * Process video URL and show UI
     * @param {string} url - Video URL
     */
    async processVideo(url) {
        if (this.isLoading) {
            console.log('Already processing a video...');
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            // Get video information
            const info = await this.getVideoInfo(url);
            console.log('Video info:', info);

            // Display video information and download options
            this.displayVideoInfo(info);
            this.createDownloadButtons(info);

        } catch (error) {
            console.error('Process video error:', error);
            this.showError(`Failed to process video: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * Display video information in the UI
     * @param {Object} info - Video info object
     */
    displayVideoInfo(info) {
        // Update thumbnail
        const thumbElement = document.getElementById('thumb');
        if (thumbElement && info.thumbnail) {
            thumbElement.innerHTML = `
                <img src="${info.thumbnail}" alt="Video thumbnail" 
                     style="width: 100%; max-width: 500px; border-radius: 10px;">
            `;
        }

        // Update title
        const titleElement = document.getElementById('title');
        if (titleElement) {
            titleElement.innerHTML = `<h3>${this.sanitize(info.title)}</h3>`;
        }

        // Update description
        const descElement = document.getElementById('description');
        if (descElement && info.description) {
            const shortDesc = info.description.substring(0, 200) + (info.description.length > 200 ? '...' : '');
            descElement.innerHTML = `
                <details>
                    <summary>Description</summary>
                    <p>${this.sanitize(shortDesc)}</p>
                </details>
            `;
        }

        // Update duration
        const durationElement = document.getElementById('duration');
        if (durationElement && info.duration) {
            durationElement.innerHTML = `<p><strong>Duration:</strong> ${this.formatDuration(info.duration)}</p>`;
        }

        // Show container
        const containerElement = document.getElementById('container');
        if (containerElement) {
            containerElement.style.display = 'block';
        }
    }

    /**
     * Create download buttons based on available formats
     * @param {Object} info - Video info object
     */
    createDownloadButtons(info) {
        const downloadElement = document.getElementById('download');
        if (!downloadElement) return;

        let buttonsHtml = '';

        // Audio download button
        buttonsHtml += `
            <button class="btn btn-success me-2 mb-2" onclick="reliableDownloader.downloadVideo('${info.url}', 'mp3')">
                🎵 Download MP3
            </button>
        `;

        // Video quality buttons
        const commonQualities = ['360p', '720p', '1080p'];
        commonQualities.forEach(quality => {
            buttonsHtml += `
                <button class="btn btn-primary me-2 mb-2" onclick="reliableDownloader.downloadVideo('${info.url}', '${quality}')">
                    📹 Download ${quality}
                </button>
            `;
        });

        // Best quality button
        buttonsHtml += `
            <button class="btn btn-warning me-2 mb-2" onclick="reliableDownloader.downloadVideo('${info.url}', 'best')">
                ⭐ Best Quality
            </button>
        `;

        downloadElement.innerHTML = `
            <div class="download-buttons">
                <h5>📥 Choose Download Quality:</h5>
                <div class="d-flex flex-wrap gap-2">
                    ${buttonsHtml}
                </div>
            </div>
        `;
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
        if (downloadBtn) {
            downloadBtn.disabled = true;
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.disabled = false;
        }
    }

    /**
     * Show progress message
     * @param {string} message - Progress message
     */
    showProgress(message) {
        this.showNotification(message, 'info');
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showNotification(message, 'danger');
    }

    /**
     * Show notification
     * @param {string} message - Message to show
     * @param {string} type - Notification type (success, danger, info, warning)
     */
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingAlerts = document.querySelectorAll('.download-notification');
        existingAlerts.forEach(alert => alert.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} download-notification`;
        notification.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;

        // Insert notification
        const container = document.getElementById('container') || document.body;
        container.insertBefore(notification, container.firstChild);

        // Auto-remove after 5 seconds for success/info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    /**
     * Sanitize HTML content
     * @param {string} content - Content to sanitize
     * @returns {string} Sanitized content
     */
    sanitize(content) {
        const div = document.createElement('div');
        div.textContent = content;
        return div.innerHTML;
    }

    /**
     * Format duration from seconds to readable format
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Check if backend is available
     * @returns {Promise<boolean>} True if backend is available
     */
    async checkBackendHealth() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Create global instance
const reliableDownloader = new ReliableDownloader();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Reliable Downloader initialized');
    
    // Check backend health
    const isHealthy = await reliableDownloader.checkBackendHealth();
    if (!isHealthy) {
        console.warn('⚠️ Backend not available at ' + API_BASE_URL);
        reliableDownloader.showError('Backend server not running. Please start the FastAPI server on port 8000.');
    } else {
        console.log('✅ Backend is healthy');
    }

    // Override the main download button if it exists
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const urlInput = document.getElementById('inputUrl');
            if (!urlInput) {
                reliableDownloader.showError('URL input not found');
                return;
            }

            const url = urlInput.value.trim();
            if (!url) {
                reliableDownloader.showError('Please enter a video URL');
                return;
            }

            await reliableDownloader.processVideo(url);
        });
    }
});

// Export for manual usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReliableDownloader;
}