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
 * Make an AJAX GET request with retry capability.
 * @param {string} inputUrl - The input URL for the request.
 * @param {number} retries - Number of retry attempts remaining.
 */
function makeRequest(inputUrl, retries = 2) {
    const proxyUrl = `/.netlify/functions/proxy?vkr=${encodeURIComponent(inputUrl)}`;
    const directUrl = `https://vkrdownloader.xyz/server?api_key=vkrdownloader&vkr=${encodeURIComponent(inputUrl)}`;
    const retryDelay = 2000; // Initial retry delay in milliseconds
    const maxRetries = retries;

    function attempt(url, triedProxy = false, remaining = retries) {
        $.ajax({
            url,
            type: 'GET',
            cache: false,
            async: true,
            crossDomain: true,
            dataType: 'json',
            timeout: 12000,
            success: function (data) {
                try {
                    handleSuccessResponse(data, inputUrl);
                } catch (e) {
                    if (!triedProxy) {
                        // Try proxy if direct shape unexpected
                        attempt(proxyUrl, true, remaining);
                    } else {
                        throw e;
                    }
                }
            },
            error: function (xhr, status, error) {
                if (!triedProxy) {
                    // Try proxy once if direct failed
                    attempt(proxyUrl, true, remaining);
                } else if (remaining > 0) {
                    let delay = retryDelay * Math.pow(2, maxRetries - remaining);
                    console.log(`Retrying in ${delay / 1000} seconds... (${remaining} attempts left)`);
                    setTimeout(() => attempt(directUrl, false, remaining - 1), delay);
                } else {
                    const errorMessage = getErrorMessage(xhr, status, error);
                    console.error(`Error Details: ${errorMessage}`);
                    displayError('Unable to fetch the download link after several attempts. Please check the URL or try again later.');
                    const loadingEl = document.getElementById('loading');
                    if (loadingEl) loadingEl.style.display = 'none';
                }
            },
            complete: function () {
                document.getElementById('downloadBtn').disabled = false;
            }
        });
    }

    // Start with direct API for speed, fallback to proxy
    attempt(directUrl, false, retries);
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
    const loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.style.display = "block";
    document.getElementById("downloadBtn").disabled = true; // Disable the button

    const inputUrl = document.getElementById("inputUrl").value.trim();
    if (!inputUrl) {
        displayError("Please enter a valid YouTube URL.");
    if (loadingEl) loadingEl.style.display = "none";
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
    document.getElementById("container").style.display = "block";
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = "none";

    // Normalize shape: some endpoints return {data:{...}}, others return {...} directly
    const videoData = data?.data ? data.data : data;
    if (videoData && (videoData.downloads || Array.isArray(videoData.formats))) {
        // VKr API: downloads array; Other API: formats
        const downloadsArr = videoData.downloads || videoData.formats || [];
        
        // Extract necessary data
        const downloadUrls = downloadsArr.map(d => d.url || d.source || d.link).filter(Boolean);
        const videoSource = videoData.source || inputUrl;
        const videoId = getYouTubeVideoIds(videoSource);
        const thumbnailUrl = videoId 
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : (videoData.thumbnail || videoData.thumb || videoData.image || "");
        // Construct video HTML
        const videoHtml = `
    <video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:500px; border-radius:20px;' 
           poster='${thumbnailUrl}' controls playsinline>
        ${Array.isArray(downloadUrls) ? downloadUrls.map(url => `<source src='${url}' type='video/mp4'>`).join('') : ''}
        <source src='https://vkrdownloader.xyz/server/dl.php?vkr=${encodeURIComponent(inputUrl)}' type='video/mp4'>
    </video>`;
                const YTvideoHtml = `
                        <video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:500px; border-radius:20px;' 
                                     poster='${thumbnailUrl}' controls playsinline>
                                 ${downloadUrls.map(url => `<source src='${url}' type='video/mp4'>`).join('')}
                                 <source src='https://vkrdownloader.xyz/server/dl.php?vkr=${encodeURIComponent(inputUrl)}' type='video/mp4'>
                        </video>`;
        const titleHtml = videoData.title ? `<h3>${sanitizeContent(videoData.title)}</h3>` : "";
        const descriptionHtml = videoData.description ? `<h4><details><summary>View Description</summary>${sanitizeContent(videoData.description)}</details></h4>` : "";
        const durationHtml = videoData.size ? `<h5>${sanitizeContent(videoData.size)}</h5>` : "";

        // Update DOM elements
        if (videoId) {
            updateElement("thumb", YTvideoHtml);
        } else {
            updateElement("thumb", videoHtml);
        }
        updateElement("title", titleHtml);
        updateElement("description", descriptionHtml);
        updateElement("duration", durationHtml);

        // Generate download buttons
    // Pass normalized structure to buttons generator
    generateDownloadButtons({ data: { downloads: downloadsArr, source: videoSource } }, inputUrl);
    } else {
        displayError("Issue: Unable to retrieve the download link. Please check the URL and contact us on Social Media @TheOfficialVKr.");
        document.getElementById("loading").style.display = "none";
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
        const videoSource = videoData.data.source;

        // Add YouTube specific buttons only (no auto-iframe)
        const videoId = getYouTubeVideoIds(videoSource);
        if (videoId) {
            const labelMap = { mp3: 'MP3 (Audio)', 360: 'MP4 360p', 720: 'MP4 720p', 1080: 'MP4 1080p' };
            ["mp3", "360", "720", "1080"].forEach(quality => {
                const href = `https://vkrdownloader.xyz/server/dlbtn.php?q=${encodeURIComponent(quality)}&vkr=${encodeURIComponent(videoSource)}`;
                downloadContainer.innerHTML += `
                  <a class="dlbtns" style="background:#6d28d9" href="${href}" target="_blank" rel="noopener noreferrer">${labelMap[quality]}</a>`;
            });
            // Skip rendering the raw format list for YouTube (per request)
            return;
        }
                // Generate download buttons for available formats (non-YouTube only)
                const cards = [];
                downloads.forEach(download => {
                        if (download && download.url) {
                                const downloadUrl = download.url;
                                const itag = getParameterByName("itag", downloadUrl);
                                const label = download.format_id || download.ext || 'video';
                                const sizeLabel = (download.size && download.size !== '0 B') ? download.size : '';
                                const redirectUrl = `https://vkrdownloader.xyz/forcedl?force=${encodeURIComponent(downloadUrl)}`;
                                cards.push(`
                                    <div class="dlcard" onclick="forceDownload('${redirectUrl}', 'video_${itag || 'file'}.mp4')">
                                        <span class="dl-label">${sanitizeContent(label)}</span>
                                        ${sizeLabel ? `<span class="dl-size">${sanitizeContent(sizeLabel)}</span>` : ''}
                                    </div>`);
                        }
                });
                if (cards.length) {
                        downloadContainer.innerHTML += `<div class="download-grid">${cards.join('')}</div>`;
                }

    } else {
        displayError("No download links found or data structure is incorrect.");
        document.getElementById("loading").style.display = "none";
    }

    // If no download buttons or iframes were added, notify the user
    if (downloadContainer.innerHTML.trim() === "") {
        displayError("Server Down due to Too Many Requests. Please contact us on Social Media @TheOfficialVKr.");
        document.getElementById("container").style.display = "none";
        // Redirecting the user to an alternative download page
       // window.location.href = `https://vkrdownloader.xyz/download.php?vkr=${encodeURIComponent(inputUrl)}`;
    }
}
