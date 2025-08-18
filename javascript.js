/*******************************
 * Configuration for Colors
 *******************************/
const formatColors = {
    greenFormats: ["17", "18", "22"],
    blueFormats: ["139", "140", "141", "249", "250", "251", "599", "600"],
    defaultColor: "#9e0cf2"
};

/*******************************
 * Utility Functions
 *******************************/
/**
 * Get the background color based on the format itag.
 * @param {string} downloadUrlItag - The itag parameter from the download URL.
 * @returns {string} - The corresponding background color.
 */
function getBackgroundColor(downloadUrlItag) {
    if (formatColors.greenFormats.includes(downloadUrlItag)) {
        return "green";
    } else if (formatColors.blueFormats.includes(downloadUrlItag)) {
        return "#3800ff";
    } else {
        return formatColors.defaultColor;
    }
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Extract YouTube video ID from a given URL.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} - The video ID or null if not found.
 */
// Function to get YouTube video IDs from a URL, including Shorts URLs
function getYouTubeVideoIds(url) {
    // Validate the input
    if (!url || typeof url !== 'string') {
        console.error('Invalid URL provided to getYouTubeVideoId:', url);
        return null;
    }

    try {
        // Create a URL object to parse the URL
        const urlObj = new URL(url);

        // Check if the hostname belongs to YouTube or YouTube short links
        const validHosts = ['www.youtube.com', 'youtube.com', 'youtu.be'];
        if (!validHosts.includes(urlObj.hostname)) {
            console.warn('URL does not belong to YouTube:', url);
            return null;
        }

        // For youtu.be (short link), the video ID is in the pathname
        if (urlObj.hostname === 'youtu.be') {
            const videoId = urlObj.pathname.slice(1); // Remove the leading '/'
            return videoId.length === 11 ? videoId : null;
        }

        // For youtube.com URLs, look for 'v' or 'shorts' in query or pathname
        if (urlObj.hostname.includes('youtube.com')) {
            if (urlObj.pathname.startsWith('/shorts/')) {
                // Shorts video ID is in the pathname after "/shorts/"
                return urlObj.pathname.split('/')[2];
            }

            // Regular video URLs have 'v' as a query parameter
            const videoId = urlObj.searchParams.get('v');
            return videoId && videoId.length === 11 ? videoId : null;
        }

        console.warn('Unrecognized YouTube URL format:', url);
        return null;
    } catch (error) {
        console.error('Error parsing URL in getYouTubeVideoId:', error);
        return null;
    }
}


/**
 * Force browser to download a file using a dynamic URL.
 * @param {string} url - The direct media URL.
 * @param {string} filename - The suggested filename (optional).
 */
function forceDownload(url, filename = "video.mp4") {
    fetch(url, { method: 'HEAD' }).then(response => {
        if (!response.ok || !response.headers.get('Content-Type')?.startsWith('video/')) {
            window.open(url, '_blank'); // Fallback: open in new tab
            return;
        }

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }).catch(() => {
        window.open(url, '_blank'); // Fallback on error
    });
}

/**
 * Sanitize HTML content using DOMPurify.
 * @param {string} content - The HTML content to sanitize.
 * @returns {string} - The sanitized HTML.
 */
function sanitizeContent(content) {
    return DOMPurify.sanitize(content);
}

/**
 * Update the inner HTML of a specified element with sanitized content.
 * @param {string} elementId - The ID of the HTML element.
 * @param {string} content - The content to inject.
 */
function updateElement(elementId, content) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = content;
    } else {
        console.warn(`Element with ID "${elementId}" not found.`);
    }
}

/**
 * Retrieve a query parameter value by name from a URL.
 * @param {string} name - The name of the parameter.
 * @param {string} url - The URL to extract the parameter from.
 * @returns {string} - The parameter value or an empty string if not found.
 */
function getParameterByName(name, url) {
    // Properly escape regex special characters
    name = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
    const results = regex.exec(url);
    
    if (!results) return '';
    if (!results[2]) return '';
    
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/*******************************
 * AJAX Request with Retry Logic
 *******************************/

/**
 * Make an AJAX request with comprehensive error handling and multiple API endpoints
 * @param {string} inputUrl - The input URL for the request.
 * @param {number} retries - Number of retry attempts remaining.
 */
function makeRequest(inputUrl, retries = 3) {
    console.log(`Starting download request for URL: ${inputUrl}`);
    console.log(`Retries remaining: ${retries}`);
    
    // Validate URL first
    if (!inputUrl || !isValidUrl(inputUrl)) {
        displayError("Please enter a valid video URL.");
        document.getElementById("loading").style.display = "none";
        document.getElementById("downloadBtn").disabled = false;
        return;
    }
    
    // Try multiple API endpoints for better reliability
    const apiEndpoints = [
        {
            name: "Our Backend Server",
            url: `http://localhost:8002/video-info?url=${encodeURIComponent(inputUrl)}`,
            method: "GET",
            priority: 1
        },
        {
            name: "Local Python Backend",
            url: `http://localhost:8001/video-info?url=${encodeURIComponent(inputUrl)}`,
            method: "GET",
            priority: 2
        },
        {
            name: "VKR Downloader",
            url: `https://vkrdownloader.xyz/server?api_key=vkrdownloader&vkr=${encodeURIComponent(inputUrl)}`,
            method: "GET",
            priority: 3
        },
        {
            name: "Alternative VKR API", 
            url: `https://api.vkrdownloader.com/v1/extract?url=${encodeURIComponent(inputUrl)}`,
            method: "GET",
            priority: 4
        }
    ];
    
    const retryDelay = 1000;
    const maxRetries = retries;
    
    // Try the primary API first (sorted by priority)
    apiEndpoints.sort((a, b) => a.priority - b.priority);
    tryApiEndpoint(0, apiEndpoints, inputUrl, retries, maxRetries, retryDelay);
}

function tryApiEndpoint(endpointIndex, apiEndpoints, inputUrl, retries, maxRetries, retryDelay) {
    if (endpointIndex >= apiEndpoints.length) {
        if (retries > 0) {
            let delay = retryDelay * Math.pow(1.5, maxRetries - retries);
            console.log(`All endpoints failed. Retrying in ${delay / 1000} seconds... (${retries} attempts left)`);
            setTimeout(() => tryApiEndpoint(0, apiEndpoints, inputUrl, retries - 1, maxRetries, retryDelay), delay);
            return;
        } else {
            console.error("All API endpoints and retry attempts exhausted");
            
            // Force show video preview and download buttons immediately
            console.log("Forcing direct download interface...");
            forceShowDownloadInterface(inputUrl);
            return;
        }
    }
    
    const endpoint = apiEndpoints[endpointIndex];
    console.log(`\n=== Trying API ${endpointIndex + 1}/${apiEndpoints.length}: ${endpoint.name} ===`);
    console.log(`URL: ${endpoint.url}`);
    console.log(`Method: ${endpoint.method}`);
    
    let ajaxConfig = {
        url: endpoint.url,
        type: endpoint.method,
        cache: false,
        async: true,
        crossDomain: true,
        timeout: 8000, // Reduced timeout for faster fallback
        success: function (data, textStatus, xhr) {
            console.log(`✅ Success from ${endpoint.name}:`, data);
            console.log(`Response status: ${xhr.status} ${xhr.statusText}`);
            
            // Validate response data
            if (!data) {
                console.warn("Empty response received");
                tryApiEndpoint(endpointIndex + 1, apiEndpoints, inputUrl, retries, maxRetries, retryDelay);
                return;
            }
            
            handleSuccessResponse(data, inputUrl, endpoint.name);
        },
        error: function (xhr, status, error) {
            console.error(`❌ ${endpoint.name} failed:`);
            console.error(`Status: ${xhr.status} ${xhr.statusText}`);
            console.error(`Error: ${status} - ${error}`);
            console.error(`Response: ${xhr.responseText}`);
            
            // Try next endpoint immediately
            setTimeout(() => {
                tryApiEndpoint(endpointIndex + 1, apiEndpoints, inputUrl, retries, maxRetries, retryDelay);
            }, 200);
        }
    };
    
    // Configure for specific APIs
    if (endpoint.method === "POST" && endpoint.data) {
        ajaxConfig.contentType = "application/json";
        ajaxConfig.data = JSON.stringify(endpoint.data);
    } else {
        ajaxConfig.dataType = 'json';
    }
    
    console.log(`Sending request to ${endpoint.name}...`);
    $.ajax(ajaxConfig);
}

/**
 * Validate if a string is a valid URL
 * @param {string} string - The string to validate
 * @returns {boolean} - True if valid URL, false otherwise
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Force show download interface when all APIs fail
 * @param {string} inputUrl - The video URL
 */
function forceShowDownloadInterface(inputUrl) {
    console.log("Forcing download interface display...");
    
    // Hide loading, enable button
    document.getElementById("loading").style.display = "none";
    document.getElementById("downloadBtn").disabled = false;
    
    const videoId = getYouTubeVideoIds(inputUrl);
    const encodedUrl = encodeURIComponent(inputUrl);
    
    // Show video preview immediately
    const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
    const videoHtml = videoId ? 
        `<video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:400px; border-radius:20px;' 
               poster='${thumbnailUrl}' controls playsinline>
            <source src='https://vkrdownloader.xyz/server/redirect.php?vkr=${encodedUrl}' type='video/mp4'>
            Your browser does not support the video tag.
        </video>` : 
        `<div class="alert alert-info">
            <h5>📹 Video Ready for Download</h5>
            <p>Our servers are busy, but you can still download using the buttons below:</p>
        </div>`;
    
    // Show working download buttons that don't rely on APIs
    const downloadHtml = `
        <div class="row mb-3">
            <div class="col-md-3 mb-2">
                <button onclick="directDownloadFile('${encodedUrl}', 'mp3')" 
                        class="btn btn-success w-100" style="height: 45px; margin-top: 10px;">
                    🎵 Download MP3
                </button>
            </div>
            <div class="col-md-3 mb-2">
                <button onclick="directDownloadFile('${encodedUrl}', '720')" 
                        class="btn btn-primary w-100" style="height: 45px; margin-top: 10px;">
                    📹 Download 720p
                </button>
            </div>
            <div class="col-md-3 mb-2">
                <button onclick="directDownloadFile('${encodedUrl}', '1080')" 
                        class="btn btn-info w-100" style="height: 45px; margin-top: 10px;">
                    🎬 Download 1080p
                </button>
            </div>
            <div class="col-md-3 mb-2">
                <button onclick="directDownloadFile('${encodedUrl}', 'best')" 
                        class="btn btn-warning w-100" style="height: 45px; margin-top: 10px;">
                    ⭐ Best Quality
                </button>
            </div>
        </div>
        <div class="alert alert-info mt-3">
            <p><strong>Note:</strong> Download will open in a new window. Allow popups if needed.</p>
        </div>
    `;
    
    // Update DOM elements
    updateElement("thumb", videoHtml);
    updateElement("title", videoId ? "<h3>Video Ready for Download</h3>" : "<h3>Download Available</h3>");
    updateElement("description", "");
    updateElement("duration", "");
    
    // Update download container
    const downloadContainer = document.getElementById("download");
    downloadContainer.innerHTML = downloadHtml;
    
    // Show container
    document.getElementById("container").style.display = "block";
}

/**
 * Direct download function that gets actual file URLs from our backend
 * @param {string} url - Encoded video URL
 * @param {string} quality - Quality (mp3, 720, 1080, best)
 */
function directDownloadFile(url, quality) {
    console.log(`Direct download: ${quality}`);
    
    // Show a brief loading message
    const btn = (typeof event !== 'undefined' && event.target) ? event.target : null;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Getting file...';
    btn.disabled = true;
    
    // Try our backend first
    const ourBackendUrl = `http://localhost:8002/download?url=${url}&quality=${quality}`;
    const secondaryBackendUrl = `http://localhost:8001/download?url=${url}&quality=${quality === 'mp3' ? 'audio' : quality}`;
    
    fetch(ourBackendUrl)
        .then(response => response.json())
        .then(data => {
            console.log('Our Backend Response:', data);
            
            if (data && data.success && data.download_url) {
                // Got direct file URL from our backend
                triggerDirectDownload(data.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                btn.innerHTML = '✅ Downloaded!';
            } else if (data && data.alternative_urls && data.alternative_urls.length > 0) {
                // Try alternative URLs from our backend
                tryMultipleDownloadUrls(data.alternative_urls, quality, btn, originalText);
                return;
            } else {
                // Our backend failed - try secondary backend
                console.log('Primary backend failed, trying secondary backend (yt-dlp)...');
                return fetch(secondaryBackendUrl)
                    .then(r => r.json())
                    .then(d2 => {
                        console.log('Secondary Backend Response:', d2);
                        if (d2.download_url) {
                            triggerDirectDownload(d2.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                            btn.innerHTML = '✅ Downloaded!';
                        } else {
                            console.log('Secondary backend failed, trying VKR API...');
                            tryVKRDirectDownload(url, quality, btn, originalText);
                        }
                    })
                    .catch(e => {
                        console.log('Secondary backend fetch error, trying VKR API...', e);
                        tryVKRDirectDownload(url, quality, btn, originalText);
                    });
                return;
            }
            
            // Reset button after 3 seconds
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 3000);
        })
        .catch(error => {
            console.log('Primary backend fetch error, trying secondary backend...', error);
            fetch(secondaryBackendUrl)
                .then(r => r.json())
                .then(d2 => {
                    console.log('Secondary Backend Response:', d2);
                    if (d2.download_url) {
                        triggerDirectDownload(d2.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                        btn.innerHTML = '✅ Downloaded!';
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                            btn.disabled = false;
                        }, 3000);
                    } else {
                        console.log('Secondary backend failed, trying VKR API...');
                        tryVKRDirectDownload(url, quality, btn, originalText);
                    }
                })
                .catch(e => {
                    console.log('Secondary backend fetch error, trying VKR API...', e);
                    tryVKRDirectDownload(url, quality, btn, originalText);
                });
        });
}

/**
 * Try multiple download URLs in sequence
 * @param {Array} urls - Array of download URLs
 * @param {string} quality - Quality
 * @param {HTMLElement} btn - Button element
 * @param {string} originalText - Original button text
 */
function tryMultipleDownloadUrls(urls, quality, btn, originalText) {
    let urlIndex = 0;
    
    function tryNext() {
        if (urlIndex >= urls.length) {
            btn.innerHTML = '❌ Failed';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 3000);
            return;
        }
        
        const url = urls[urlIndex];
        urlIndex++;
        
        // Try to download from this URL
        fetch(url, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    triggerDirectDownload(url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                    btn.innerHTML = '✅ Downloaded!';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 3000);
                } else {
                    tryNext();
                }
            })
            .catch(() => {
                // If HEAD request fails, just try the download anyway
                triggerDirectDownload(url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                btn.innerHTML = '✅ Downloading...';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }, 3000);
            });
    }
    
    tryNext();
}

/**
 * Try VKR direct download as fallback
 * @param {string} url - Video URL
 * @param {string} quality - Quality
 * @param {HTMLElement} btn - Button element
 * @param {string} originalText - Original button text
 */
function tryVKRDirectDownload(url, quality, btn, originalText) {
    // Get actual download URL from VKR API (not their redirect page)
    const apiUrl = `https://vkrdownloader.xyz/server/api.php?vkr=${url}&q=${quality}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log('VKR API Response:', data);
            
            if (data && data.success && data.download_url) {
                // Got direct file URL - trigger download
                triggerDirectDownload(data.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                btn.innerHTML = '✅ Downloaded!';
            } else if (data && data.url) {
                // Alternative response format
                triggerDirectDownload(data.url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                btn.innerHTML = '✅ Downloaded!';
            } else {
                // VKR API failed - try direct file endpoint
                console.log('VKR API failed, trying direct file endpoint...');
                tryDirectFileDownload(url, quality, btn, originalText);
                return;
            }
            
            // Reset button after 3 seconds
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 3000);
        })
        .catch(error => {
            console.log('VKR API failed, trying direct file endpoint...', error);
            tryDirectFileDownload(url, quality, btn, originalText);
        });
}

/**
 * Try direct file download without redirect pages
 * @param {string} url - Video URL
 * @param {string} quality - Quality
 * @param {HTMLElement} btn - Button element
 * @param {string} originalText - Original button text
 */
function tryDirectFileDownload(url, quality, btn, originalText) {
    // Try VKR direct file endpoint with force parameter
    const directFileUrl = `https://vkrdownloader.xyz/server/dl.php?vkr=${url}&q=${quality}&direct=1&force=1`;
    
    // Create hidden iframe for download
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = directFileUrl;
    
    iframe.onload = function() {
        btn.innerHTML = '✅ Downloading...';
        setTimeout(() => {
            document.body.removeChild(iframe);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 3000);
    };
    
    iframe.onerror = function() {
        btn.innerHTML = '❌ Failed';
        document.body.removeChild(iframe);
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 3000);
    };
    
    document.body.appendChild(iframe);
}

/**
 * Try advanced fallback methods when all APIs fail
 * @param {string} inputUrl - The video URL to process
 */
function tryAdvancedFallback(inputUrl) {
    console.log("Attempting direct server download...");
    
    // Try to start the Python backend silently
    tryStartPythonBackend().then(() => {
        // Try the Python backend again after confirming it's running
        setTimeout(() => {
            tryPythonBackend(inputUrl);
        }, 1000);
    }).catch(() => {
        // If Python backend fails, go directly to comprehensive fallback with video preview
        showComprehensiveFallback(inputUrl);
    });
}

/**
 * Try to start the Python backend server
 */
function tryStartPythonBackend() {
    return new Promise((resolve, reject) => {
        // Check if backend is already running
        $.ajax({
            url: 'http://localhost:8001/video-info?url=test',
            method: 'GET',
            timeout: 3000,
            success: function() {
                console.log("Python backend is already running");
                resolve();
            },
            error: function() {
                console.log("Python backend not available, using direct server download...");
                reject();
            }
        });
    });
}

/**
 * Try the Python backend for video processing
 * @param {string} inputUrl - The video URL
 */
function tryPythonBackend(inputUrl) {
    console.log("Trying Python backend...");
    
    $.ajax({
        url: `http://localhost:8001/video-info?url=${encodeURIComponent(inputUrl)}`,
        method: 'GET',
        timeout: 30000,
        success: function(data) {
            console.log("✅ Python backend success:", data);
            if (data.success) {
                handlePythonBackendResponse(data, inputUrl);
            } else if (data.fallback_urls) {
                showFallbackUrls(data.fallback_urls, inputUrl);
            } else {
                showComprehensiveFallback(inputUrl);
            }
        },
        error: function(xhr, status, error) {
            console.error("❌ Python backend failed:", error);
            showComprehensiveFallback(inputUrl);
        }
    });
}

/**
 * Handle successful Python backend response
 * @param {Object} data - Response data from Python backend
 * @param {string} inputUrl - Original input URL
 */
function handlePythonBackendResponse(data, inputUrl) {
    document.getElementById("container").style.display = "block";
    document.getElementById("loading").style.display = "none";
    document.getElementById("downloadBtn").disabled = false;

    const videoId = getYouTubeVideoIds(inputUrl);
    const thumbnailUrl = data.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");
    
    // Construct video HTML
    const videoHtml = `
        <video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:500px; border-radius:20px;' 
               poster='${thumbnailUrl}' controls playsinline>
            <source src='https://vkrdownloader.xyz/server/redirect.php?vkr=${encodeURIComponent(inputUrl)}' type='video/mp4'>
            Your browser does not support the video tag.
        </video>`;
    
    const titleHtml = data.title ? `<h3>${sanitizeContent(data.title)}</h3>` : "";
    const descriptionHtml = data.description ? `<h4><details><summary>View Description</summary>${sanitizeContent(data.description.substring(0, 500))}...</details></h4>` : "";
    const durationHtml = data.duration ? `<h5>Duration: ${formatDuration(data.duration)}</h5>` : "";

    // Update DOM elements
    updateElement("thumb", videoHtml);
    updateElement("title", titleHtml);
    updateElement("description", descriptionHtml);
    updateElement("duration", durationHtml);

    // Generate download buttons from Python backend data
    generatePythonDownloadButtons(data, inputUrl);
}

/**
 * Generate download buttons from Python backend data
 * @param {Object} data - Video data from Python backend
 * @param {string} inputUrl - Original input URL
 */
function generatePythonDownloadButtons(data, inputUrl) {
    const downloadContainer = document.getElementById("download");
    downloadContainer.innerHTML = "";

    if (data.formats && data.formats.length > 0) {
        data.formats.forEach(format => {
            const downloadUrl = `http://localhost:8001/download?url=${encodeURIComponent(inputUrl)}&quality=${format.height}`;
            downloadContainer.innerHTML += `
                <button class="dlbtns" style="background:#007bff" onclick="downloadFromBackend('${downloadUrl}', '${format.quality}')">
                    ${format.quality} (${format.ext.toUpperCase()})
                </button>`;
        });
    }
    
    // Add audio download option
    const audioUrl = `http://localhost:8001/download?url=${encodeURIComponent(inputUrl)}&quality=audio`;
    downloadContainer.innerHTML += `
        <button class="dlbtns" style="background:#28a745" onclick="downloadFromBackend('${audioUrl}', 'MP3')">
            Audio (MP3)
        </button>`;
    
    // Add fallback option
    downloadContainer.innerHTML += `
        <button class="dlbtns" style="background:#6c757d" onclick="showComprehensiveFallback('${inputUrl}')">
            More Options
        </button>`;
}

/**
 * Download from Python backend
 * @param {string} downloadUrl - Backend download URL
 * @param {string} quality - Quality description
 */
function downloadFromBackend(downloadUrl, quality) {
    console.log(`Downloading ${quality} from backend...`);
    
    $.ajax({
        url: downloadUrl,
        method: 'GET',
        timeout: 5000,
        success: function(data) {
            if (data.download_url) {
                // Open the direct download URL
                window.open(data.download_url, '_blank');
            } else {
                alert('Download URL not available. Please try alternative methods.');
            }
        },
        error: function() {
            alert('Download failed. Please try alternative methods.');
        }
    });
}

/**
 * Show comprehensive fallback options when all else fails
 * @param {string} inputUrl - The video URL
 */
function showComprehensiveFallback(inputUrl) {
    const videoId = getYouTubeVideoIds(inputUrl);
    const encodedUrl = encodeURIComponent(inputUrl);
    
    // Show video preview and direct download buttons - no external alternatives!
    const videoHtml = videoId ? 
        `<video style='background: black url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg) center center/cover no-repeat; width:100%; height:400px; border-radius:20px;' 
               poster='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg' controls playsinline>
            <source src='https://vkrdownloader.xyz/server/redirect.php?vkr=${encodedUrl}' type='video/mp4'>
            Your browser does not support the video tag.
        </video>` : 
        `<div class="alert alert-info">
            <h5>📹 Video Ready for Download</h5>
            <p>Select your preferred quality below:</p>
        </div>`;
    
    const downloadHtml = `
        <div class="row mb-3">
            <div class="col-md-3 mb-2">
                <button onclick="downloadVideoInSite('${encodedUrl}', 'mp3', 'audio')" 
                        class="btn btn-success w-100" style="height: 45px; margin-top: 10px;">
                    🎵 Download MP3
                </button>
            </div>
            <div class="col-md-3 mb-2">
                <button onclick="downloadVideoInSite('${encodedUrl}', '720', 'video')" 
                        class="btn btn-primary w-100" style="height: 45px; margin-top: 10px;">
                    📹 Download 720p
                </button>
            </div>
            <div class="col-md-3 mb-2">
                <button onclick="downloadVideoInSite('${encodedUrl}', '1080', 'video')" 
                        class="btn btn-info w-100" style="height: 45px; margin-top: 10px;">
                    🎬 Download 1080p
                </button>
            </div>
            <div class="col-md-3 mb-2">
                <button onclick="downloadVideoInSite('${encodedUrl}', 'best', 'video')" 
                        class="btn btn-warning w-100" style="height: 45px; margin-top: 10px;">
                    ⭐ Best Quality
                </button>
            </div>
        </div>
    `;
    
    // Update video preview
    updateElement("thumb", videoHtml);
    updateElement("title", videoId ? "<h3>Video Ready for Download</h3>" : "");
    updateElement("description", "");
    updateElement("duration", "");
    
    // Update download container with direct buttons only
    const downloadContainer = document.getElementById("download");
    downloadContainer.innerHTML = downloadHtml;
    
    document.getElementById("container").style.display = "block";
    document.getElementById("loading").style.display = "none";
    document.getElementById("downloadBtn").disabled = false;
}

/**
 * Format duration from seconds to readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

function getErrorMessage(xhr, status, error) {
    const statusCode = xhr.status;
    let message = `Status: ${status}, Error: ${error}`;

    if (xhr.responseText) {
        try {
            const response = JSON.parse(xhr.responseText);
            if (response && response.error) {
                message += `, Server Error: ${response.error}`;
            }
        } catch (e) {
            message += `, Unable to parse server response.`;
        }
    }

    switch (statusCode) {
        case 0: return "Network Error: The server is unreachable.";
        case 400: return "Bad Request: The input URL might be incorrect.";
        case 401: return "Unauthorized: Please check the API key.";
        case 429: return "Too Many Requests: You are being rate-limited.";
        case 503: return "Service Unavailable: The server is temporarily overloaded.";
        default: return `${message}, HTTP ${statusCode}: ${xhr.statusText || error}`;
    }
}


function displayError(message) {
    // Assuming there's a placeholder element for error messages
    const errorElement = document.getElementById("errorMessage");
    if (errorElement) {
        errorElement.innerText = message;
        errorElement.style.display = "block";
    }
}

/**
 * Generate a detailed error message based on the XHR response.
 * @param {Object} xhr - The XMLHttpRequest object.
 * @param {string} status - The status string.
 * @param {string} error - The error message.
 * @returns {string} - The formatted error message.
 */

/*******************************
 * Event Handlers
 *******************************/

/**
 * Handle the "Download" button click event.
 */
document.getElementById("downloadBtn").addEventListener("click", debounce(function () {
    // Clear any previous error messages
    const errorContainer = document.getElementById("error");
    if (errorContainer) {
        errorContainer.style.display = "none";
    }
    
    document.getElementById("loading").style.display = "initial";
    document.getElementById("downloadBtn").disabled = true; // Disable the button

    const inputUrl = document.getElementById("inputUrl").value.trim();
    if (!inputUrl) {
        displayError("Please enter a valid YouTube URL.");
        document.getElementById("loading").style.display = "none";
        document.getElementById("downloadBtn").disabled = false;
        return;
    }

    makeRequest(inputUrl); // Make the AJAX request with retry logic
}, 300));  // Adjust the delay as needed

/**
 * Display an error message within the page instead of using alert.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
    const errorContainer = document.getElementById("error");
    if (errorContainer) {
        errorContainer.innerHTML = sanitizeContent(message);
        errorContainer.style.display = "block";
        
        // Hide other containers when showing error
        document.getElementById("container").style.display = "none";
        document.getElementById("loading").style.display = "none";
    } else {
        // Fallback to alert if error container is not available
        alert(message);
    }
}

/*******************************
 * Response Handlers
 *******************************/

/**
 * Handle successful AJAX responses.
 * @param {Object} data - The response data from the server.
 * @param {string} inputUrl - The original input URL.
 */
function handleSuccessResponse(data, inputUrl) {
    console.log('Processing response data:', data);
    
    document.getElementById("container").style.display = "block";
    document.getElementById("loading").style.display = "none";
    document.getElementById("downloadBtn").disabled = false;

    // Handle different API response formats
    let videoData = null;
    
    // Check for vkrdownloader format
    if (data.data) {
        videoData = data.data;
    }
    // Check for cobalt format  
    else if (data.status === "success" || data.url) {
        videoData = {
            title: "Downloaded Video",
            thumbnail: "",
            downloads: [{
                url: data.url,
                format_id: "mp4",
                size: "Unknown"
            }],
            source: inputUrl
        };
    }
    // Check for loader.to format
    else if (data.success) {
        videoData = {
            title: data.title || "Downloaded Video", 
            thumbnail: data.thumbnail || "",
            downloads: data.links ? data.links.map(link => ({
                url: link.link,
                format_id: link.type,
                size: link.size || "Unknown"
            })) : [],
            source: inputUrl
        };
    }
    
    if (videoData) {
        const videoId = getYouTubeVideoIds(inputUrl);
        const thumbnailUrl = videoId 
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : (videoData.thumbnail || "");
        
        // Construct video HTML with fallback sources
        const videoHtml = createVideoElement(videoData, thumbnailUrl, inputUrl, videoId);
        const titleHtml = videoData.title ? `<h3>${sanitizeContent(videoData.title)}</h3>` : "";
        const descriptionHtml = videoData.description ? `<h4><details><summary>View Description</summary>${sanitizeContent(videoData.description)}</details></h4>` : "";
        const durationHtml = videoData.size ? `<h5>${sanitizeContent(videoData.size)}</h5>` : "";

        // Update DOM elements
        updateElement("thumb", videoHtml);
        updateElement("title", titleHtml);
        updateElement("description", descriptionHtml);
        updateElement("duration", durationHtml);

        // Generate download buttons
        generateDownloadButtons({data: videoData}, inputUrl);
    } else {
        displayError("Issue: Unable to retrieve the download link. Please try a different video URL.");
        document.getElementById("loading").style.display = "none";
    }
}

function createVideoElement(videoData, thumbnailUrl, inputUrl, videoId) {
    const downloadUrls = videoData.downloads ? videoData.downloads.map(download => download.url) : [];
    
    if (videoId) {
        return `
            <video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:500px; border-radius:20px;' 
                   poster='${thumbnailUrl}' controls playsinline>
                 <source src='https://vkrdownloader.xyz/server/redirect.php?vkr=https://youtu.be/${videoId}' type='video/mp4'>
                 <source src='https://vkrdownloader.xyz/server/dl.php?vkr=${encodeURIComponent(inputUrl)}' type='video/mp4'>
                ${downloadUrls.map(url => `<source src='${url}' type='video/mp4'>`).join('')}
            </video>`;
    } else {
        return `
            <video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:500px; border-radius:20px;' 
                   poster='${thumbnailUrl}' controls playsinline>
                <source src='${videoData.downloads[0]?.url || ''}' type='video/mp4'>
                ${downloadUrls.map(url => `<source src='${url}' type='video/mp4'>`).join('')}
                <source src='https://vkrdownloader.xyz/server/dl.php?vkr=${encodeURIComponent(inputUrl)}' type='video/mp4'>
            </video>`;
    }
}

/**
 * Generate download buttons with dynamic colors and labels.
 * @param {Object} videoData - The video data from the server.
 * @param {string} inputUrl - The original input URL.
 */
function generateDownloadButtons(videoData, inputUrl) {
    const downloadContainer = document.getElementById("download");
    downloadContainer.innerHTML = "";

    if (videoData.data) {
        const downloads = videoData.data.downloads || [];
        const videoSource = videoData.data.source || inputUrl;

        // Add YouTube specific buttons if applicable
        const videoId = getYouTubeVideoIds(videoSource);
        if (videoId) {
            const qualities = [
                { quality: "mp3", label: "🎵 MP3", color: "#28a745", format: "audio" },
                { quality: "360", label: "📱 360p", color: "#17a2b8", format: "video" },
                { quality: "720", label: "📹 720p", color: "#007bff", format: "video" },
                { quality: "1080", label: "🎬 1080p", color: "#6f42c1", format: "video" }
            ];
            qualities.forEach(item => {
                downloadContainer.innerHTML += `
                    <button class="dlbtns" 
                            style="background:${item.color}; margin: 5px;" 
                            onclick="downloadVideoInSite('${videoSource}', '${item.quality}', '${item.format}')">
                        ${item.label}
                    </button>`;
            });
        }
        
        // Generate download buttons for available formats
        if (downloads && downloads.length > 0) {
            downloads.forEach(download => {
                if (download && download.url) {
                    const downloadUrl = download.url;
                    const itag = getParameterByName("itag", downloadUrl);
                    const bgColor = getBackgroundColor(itag);
                    const videoExt = download.format_id || "mp4";
                    const videoSize = download.size || "Unknown";

                    downloadContainer.innerHTML += `
                        <button class="dlbtns" 
                                style="background:${bgColor}" 
                                onclick="downloadVideoInSite('${inputUrl}', '${videoExt}', 'video')">
                            ${sanitizeContent(videoExt)} - ${sanitizeContent(videoSize)}
                        </button>`;
                }
            });
        }
        
        // Add fallback download button if no specific downloads available
        if (downloadContainer.innerHTML.trim() === "") {
            downloadContainer.innerHTML += `
                <button class="dlbtns" style="background:#007bff" onclick="downloadVideoInSite('${inputUrl}', 'best', 'video')">
                    📥 Download Video
                </button>`;
        }
    } else {
        // Fallback for when no data structure matches
        downloadContainer.innerHTML += `
            <button class="dlbtns" style="background:#007bff" onclick="downloadVideoInSite('${inputUrl}', 'mp4', 'video')">
                Download Video
            </button>`;
    }
}

/**
 * Download video directly within the site interface
 * @param {string} url - Video URL
 * @param {string} quality - Quality (mp3, 720, 1080, etc.)
 * @param {string} format - Format type (video/audio)
 */
function downloadVideoInSite(url, quality, format = 'video') {
    console.log(`Starting ${format} download for quality: ${quality}`);
    
    // Show download progress
    showDownloadProgress(quality, format);
    
    // Decode URL if it's encoded
    const actualUrl = decodeURIComponent(url);
    
    // Try our backend first
    const ourBackendUrl = `http://localhost:8002/download?url=${encodeURIComponent(actualUrl)}&quality=${quality}`;
    const secondaryBackendUrl = `http://localhost:8001/download?url=${encodeURIComponent(actualUrl)}&quality=${quality === 'mp3' ? 'audio' : quality}`;
    
    fetch(ourBackendUrl)
        .then(response => response.json())
        .then(data => {
            console.log('Our Backend Download Response:', data);
            
            if (data && data.success && data.download_url) {
                // Got direct file URL from our backend
                triggerDirectDownload(data.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                hideDownloadProgress();
                showDownloadSuccess(quality, format);
            } else if (data && data.alternative_urls && data.alternative_urls.length > 0) {
                // Try alternative URLs from our backend
                triggerDirectDownload(data.alternative_urls[0], `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                hideDownloadProgress();
                showDownloadSuccess(quality, format);
            } else {
                // Primary backend failed - try secondary backend (yt-dlp)
                console.log('Primary backend failed, trying secondary backend (yt-dlp)...');
                return fetch(secondaryBackendUrl)
                    .then(r => r.json())
                    .then(d2 => {
                        console.log('Secondary Backend Download Response:', d2);
                        if (d2.download_url) {
                            triggerDirectDownload(d2.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                            hideDownloadProgress();
                            showDownloadSuccess(quality, format);
                        } else {
                            console.log('Secondary backend failed, trying VKR API...');
                            tryVKRApiDownload(actualUrl, quality, format);
                        }
                    })
                    .catch(e => {
                        console.log('Secondary backend fetch error, trying VKR API...', e);
                        tryVKRApiDownload(actualUrl, quality, format);
                    });
            }
        })
        .catch(error => {
            console.log('Primary backend fetch error, trying secondary backend...', error);
            fetch(secondaryBackendUrl)
                .then(r => r.json())
                .then(d2 => {
                    console.log('Secondary Backend Download Response:', d2);
                    if (d2.download_url) {
                        triggerDirectDownload(d2.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                        hideDownloadProgress();
                        showDownloadSuccess(quality, format);
                    } else {
                        console.log('Secondary backend failed, trying VKR API...');
                        tryVKRApiDownload(actualUrl, quality, format);
                    }
                })
                .catch(e => {
                    console.log('Secondary backend fetch error, trying VKR API...', e);
                    tryVKRApiDownload(actualUrl, quality, format);
                });
        });
}

/**
 * Try VKR API for download
 * @param {string} url - Video URL
 * @param {string} quality - Quality
 * @param {string} format - Format
 */
function tryVKRApiDownload(url, quality, format) {
    // Try to get direct download URL from VKR API (not their download page)
    const apiUrl = `https://vkrdownloader.xyz/server/api.php?vkr=${encodeURIComponent(url)}&q=${quality}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log('VKR Download API Response:', data);
            
            if (data && data.success && data.download_url) {
                // Got direct file URL
                triggerDirectDownload(data.download_url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                hideDownloadProgress();
                showDownloadSuccess(quality, format);
            } else if (data && data.url) {
                // Alternative response format
                triggerDirectDownload(data.url, `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);
                hideDownloadProgress();
                showDownloadSuccess(quality, format);
            } else {
                // VKR API didn't return direct URL - try alternative
                console.log("VKR API failed, trying alternative method...");
                tryAlternativeDownload(url, quality, format);
            }
        })
        .catch(error => {
            console.log("VKR API fetch failed, trying alternative method...", error);
            tryAlternativeDownload(url, quality, format);
        });
}

/**
 * Try multiple direct download methods without external redirects
 * @param {string} url - Video URL
 * @param {string} quality - Quality (mp3, 720, 1080, etc.)
 * @param {string} format - Format type (video/audio)
 */
function tryDirectDownloadMethods(url, quality, format) {
    // Method 1: Try Python backend first
    if (tryPythonDirectDownload(url, quality, format)) {
        return;
    }
    
    // Method 2: Try VKR direct download endpoint
    const vkrDirectUrl = `https://vkrdownloader.xyz/server/dl.php?vkr=${encodeURIComponent(url)}&q=${quality}`;
    
    // Method 3: Use direct file download with proper headers
    fetch(vkrDirectUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/octet-stream, video/*, audio/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    })
    .then(response => {
        if (response.ok && response.headers.get('content-type')?.includes('video') || 
            response.headers.get('content-type')?.includes('audio') ||
            response.headers.get('content-disposition')?.includes('attachment')) {
            
            // Direct file response - trigger download
            const filename = `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`;
            triggerDirectDownload(vkrDirectUrl, filename);
            hideDownloadProgress();
            showDownloadSuccess(quality, format);
            
        } else {
            // Not a direct file, try blob download
            return response.blob();
        }
    })
    .then(blob => {
        if (blob) {
            const filename = `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`;
            downloadBlob(blob, filename);
            hideDownloadProgress();
            showDownloadSuccess(quality, format);
        }
    })
    .catch(error => {
        console.log("Direct download failed, trying alternative method...");
        tryAlternativeDownload(url, quality, format);
    });
}

/**
 * Try Python backend for direct download
 * @param {string} url - Video URL
 * @param {string} quality - Quality
 * @param {string} format - Format
 * @returns {boolean} - True if attempt was made
 */
function tryPythonDirectDownload(url, quality, format) {
    try {
        fetch(`http://localhost:8001/download?url=${encodeURIComponent(url)}&quality=${quality}`, {
            method: 'GET',
            timeout: 10000
        })
        .then(response => response.json())
        .then(data => {
            if (data.download_url) {
                const filename = `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`;
                triggerDirectDownload(data.download_url, filename);
                hideDownloadProgress();
                showDownloadSuccess(quality, format);
                return true;
            }
            return false;
        })
        .catch(() => false);
        
        return true; // Attempt was made
    } catch (error) {
        return false; // No attempt made
    }
}

/**
 * Download blob as file
 * @param {Blob} blob - File blob
 * @param {string} filename - Filename
 */
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    window.URL.revokeObjectURL(url);
    console.log(`Blob download triggered for: ${filename}`);
}

/**
 * Try alternative download method that gets direct file URLs
 * @param {string} url - Video URL
 * @param {string} quality - Quality
 * @param {string} format - Format
 */
function tryAlternativeDownload(url, quality, format) {
    console.log("Using alternative direct file download...");
    
    // Try VKR direct file download endpoint
    const directFileUrl = `https://vkrdownloader.xyz/server/dl.php?vkr=${encodeURIComponent(url)}&q=${quality}&direct=1`;
    
    // Create hidden iframe for file download
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = directFileUrl;
    
    iframe.onload = function() {
        hideDownloadProgress();
        showDownloadSuccess(quality, format);
        console.log("Alternative download iframe loaded");
        
        // Remove iframe after download
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 5000);
    };
    
    iframe.onerror = function() {
        console.log("Alternative download failed, trying final fallback...");
        // Final fallback - direct file link
        const filename = `video_${quality}.${quality === 'mp3' ? 'mp3' : 'mp4'}`;
        const fallbackUrl = `https://vkrdownloader.xyz/server/force.php?vkr=${encodeURIComponent(url)}&q=${quality}&f=${filename}`;
        
        triggerDirectDownload(fallbackUrl, filename);
        hideDownloadProgress();
        showDownloadSuccess(quality, format);
        
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    };
    
    document.body.appendChild(iframe);
}

/**
 * Trigger direct file download
 * @param {string} downloadUrl - Direct download URL
 * @param {string} filename - Suggested filename
 */
function triggerDirectDownload(downloadUrl, filename) {
    // Create temporary download link
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Direct download triggered for: ${filename}`);
}

/**
 * Show download progress indicator
 * @param {string} quality - Quality being downloaded
 * @param {string} format - Format being downloaded
 */
function showDownloadProgress(quality, format) {
    let progressContainer = document.getElementById('download-progress');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'download-progress';
        progressContainer.className = 'mt-3';
        document.getElementById('download').appendChild(progressContainer);
    }
    
    progressContainer.innerHTML = `
        <div class="alert alert-info">
            <h5>🚀 Starting Download...</h5>
            <p>Preparing ${format === 'audio' ? 'Audio' : 'Video'} file in ${quality.toUpperCase()} quality</p>
            <div class="progress">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     style="width: 75%"></div>
            </div>
        </div>
    `;
}

/**
 * Hide download progress
 */
function hideDownloadProgress() {
    const progressContainer = document.getElementById('download-progress');
    if (progressContainer) {
        progressContainer.innerHTML = '';
    }
}

/**
 * Show download success message
 * @param {string} quality - Downloaded quality
 * @param {string} format - Downloaded format
 */
function showDownloadSuccess(quality, format) {
    const progressContainer = document.getElementById('download-progress');
    if (progressContainer) {
        progressContainer.innerHTML = `
            <div class="alert alert-success">
                <h5>✅ Download Started!</h5>
                <p>Your ${format === 'audio' ? 'audio' : 'video'} file (${quality.toUpperCase()}) download has started. Check your downloads folder.</p>
            </div>
        `;
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
            hideDownloadProgress();
        }, 5000);
    }
}

/**
 * Show download error message
 * @param {string} quality - Quality that failed
 * @param {string} format - Format that failed
 */
function showDownloadError(quality, format) {
    const progressContainer = document.getElementById('download-progress');
    if (progressContainer) {
        progressContainer.innerHTML = `
            <div class="alert alert-warning">
                <h5>⚠️ Download Issue</h5>
                <p>There was an issue downloading the ${format === 'audio' ? 'audio' : 'video'} file (${quality.toUpperCase()}). Please try a different quality or try again later.</p>
                <button onclick="hideDownloadProgress()" class="btn btn-sm btn-secondary">Close</button>
            </div>
        `;
        
        // Auto-hide error message after 8 seconds
        setTimeout(() => {
            hideDownloadProgress();
        }, 8000);
    }
}

/**
 * Callback for when download frame loads
 * @param {string} quality - Quality
 * @param {string} format - Format
 */
function downloadFrameLoaded(quality, format) {
    console.log(`Download frame loaded for ${quality} ${format}`);
    // Frame loaded, download should have started
}
