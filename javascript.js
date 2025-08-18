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
            name: "Local Python Backend",
            url: `http://localhost:8001/video-info?url=${encodeURIComponent(inputUrl)}`,
            method: "GET",
            priority: 1
        },
        {
            name: "VKR Downloader",
            url: `https://vkrdownloader.xyz/server?api_key=vkrdownloader&vkr=${encodeURIComponent(inputUrl)}`,
            method: "GET",
            priority: 2
        },
        {
            name: "Alternative VKR API", 
            url: `https://api.vkrdownloader.com/v1/extract?url=${encodeURIComponent(inputUrl)}`,
            method: "GET",
            priority: 3
        },
        {
            name: "YouTube DL Web API",
            url: `https://api.vevioz.com/api/button/mp3/320/${encodeURIComponent(inputUrl)}`,
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
            
            // Try advanced fallback methods
            console.log("Attempting advanced fallback methods...");
            tryAdvancedFallback(inputUrl);
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
        timeout: 15000, // Reduced timeout for faster fallback
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
            }, 500);
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
 * Try advanced fallback methods when all APIs fail
 * @param {string} inputUrl - The video URL to process
 */
function tryAdvancedFallback(inputUrl) {
    console.log("Attempting advanced fallback methods...");
    
    // First try to start the Python backend if it's not running
    tryStartPythonBackend().then(() => {
        // Try the Python backend again after starting it
        setTimeout(() => {
            tryPythonBackend(inputUrl);
        }, 2000);
    }).catch(() => {
        // If Python backend fails, show comprehensive fallback options
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
                console.log("Python backend not running, attempting to start...");
                
                // Show instruction to start backend
                const instruction = `
                    <div class="alert alert-info">
                        <h5>🚀 Starting Advanced Downloader</h5>
                        <p>To enable our advanced download system, please run this command in a terminal:</p>
                        <div class="bg-dark text-light p-2 rounded mb-2">
                            <code>python3 backend.py</code>
                        </div>
                        <p>Or click the button below to try alternative methods:</p>
                        <button onclick="showComprehensiveFallback('${inputUrl}')" class="btn btn-warning">
                            Show Alternative Downloads
                        </button>
                    </div>
                `;
                
                displayError(instruction);
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
    
    const fallbackHtml = `
        <div class="alert alert-warning">
            <h5>🔄 Alternative Download Methods</h5>
            <p>Our primary servers are currently busy. Try these reliable alternatives:</p>
        </div>
        
        ${videoId ? `
        <div class="row mb-3">
            <div class="col-md-3 mb-2">
                <iframe style="border: 0; outline: none; width: 100%; height: 45px; margin-top: 10px; overflow: hidden;"   
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-downloads-without-user-activation"  
                        scrolling="no"
                        src="https://vkrdownloader.xyz/server/dlbtn.php?q=mp3&vkr=${encodedUrl}">
                </iframe>
            </div>
            <div class="col-md-3 mb-2">
                <iframe style="border: 0; outline: none; width: 100%; height: 45px; margin-top: 10px; overflow: hidden;"   
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-downloads-without-user-activation"  
                        scrolling="no"
                        src="https://vkrdownloader.xyz/server/dlbtn.php?q=720&vkr=${encodedUrl}">
                </iframe>
            </div>
            <div class="col-md-3 mb-2">
                <iframe style="border: 0; outline: none; width: 100%; height: 45px; margin-top: 10px; overflow: hidden;"   
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-downloads-without-user-activation"  
                        scrolling="no"
                        src="https://vkrdownloader.xyz/server/dlbtn.php?q=1080&vkr=${encodedUrl}">
                </iframe>
            </div>
            <div class="col-md-3 mb-2">
                <a href="https://vkrdownloader.xyz/download.php?vkr=${encodedUrl}" target="_blank" class="btn btn-primary w-100">
                    VKR Download Page
                </a>
            </div>
        </div>` : ''}
        
        <div class="row">
            <div class="col-md-4 mb-2">
                <a href="https://savefrom.net/#url=${encodedUrl}" target="_blank" class="btn btn-success w-100">
                    SaveFrom.net
                </a>
            </div>
            <div class="col-md-4 mb-2">
                <a href="https://www.y2mate.com/youtube/${videoId}" target="_blank" class="btn btn-info w-100">
                    Y2Mate
                </a>
            </div>
            <div class="col-md-4 mb-2">
                <a href="https://keepvid.com/?url=${encodedUrl}" target="_blank" class="btn btn-warning w-100">
                    KeepVid
                </a>
            </div>
        </div>
        
        <div class="mt-3">
            <h6>📱 Mobile Apps:</h6>
            <ul class="list-unstyled">
                <li>• <strong>Android:</strong> TubeMate, VidMate, Snaptube</li>
                <li>• <strong>iOS:</strong> Documents by Readdle + online downloaders</li>
            </ul>
        </div>
        
        <div class="mt-3 text-muted">
            <small>
                <strong>Pro Tip:</strong> For the best experience, run our Python backend by executing: 
                <code>python3 backend.py</code> in your terminal.
            </small>
        </div>
    `;
    
    const downloadContainer = document.getElementById("download");
    downloadContainer.innerHTML = fallbackHtml;
    
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
            const qualities = ["mp3", "360", "720", "1080"];
            qualities.forEach(quality => {
                downloadContainer.innerHTML += `
                    <iframe style="border: 0; outline: none; display:inline; min-width: 150px; max-height: 45px; height: 45px !important; margin-top: 10px; overflow: hidden;"   
                            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-downloads-without-user-activation"  
                            scrolling="no"
                            src="https://vkrdownloader.xyz/server/dlbtn.php?q=${encodeURIComponent(quality)}&vkr=${encodeURIComponent(videoSource)}">
                    </iframe>`;
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

                    const redirectUrl = `https://vkrdownloader.xyz/forcedl?force=${encodeURIComponent(downloadUrl)}`;
                    downloadContainer.innerHTML += `
                        <button class="dlbtns" style="background:${bgColor}" onclick="window.open('${redirectUrl}', '_blank')">
                            ${sanitizeContent(videoExt)} - ${sanitizeContent(videoSize)}
                        </button>`;
                }
            });
        }
        
        // Add fallback download button if no specific downloads available
        if (downloadContainer.innerHTML.trim() === "") {
            downloadContainer.innerHTML += `
                <button class="dlbtns" style="background:#007bff" onclick="window.open('https://vkrdownloader.xyz/download.php?vkr=${encodeURIComponent(inputUrl)}', '_blank')">
                    Download Video (Fallback)
                </button>`;
        }
    } else {
        // Fallback for when no data structure matches
        downloadContainer.innerHTML += `
            <button class="dlbtns" style="background:#007bff" onclick="window.open('https://vkrdownloader.xyz/download.php?vkr=${encodeURIComponent(inputUrl)}', '_blank')">
                Download Video (External)
            </button>`;
    }
}
