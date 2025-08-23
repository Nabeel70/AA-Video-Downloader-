// Netlify Function: Proxy to VKrDownloader API with CORS handling
// GET /.netlify/functions/proxy?vkr=<videoUrl>

exports.handler = async function(event) {
  try {
    const url = event.queryStringParameters?.vkr;
    if (!url) {
      return json(400, { error: 'Missing vkr query param' });
    }

    const apiUrl = `https://vkrdownloader.xyz/server?api_key=vkrdownloader&vkr=${encodeURIComponent(url)}`;

    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      },
    });

    const text = await res.text();
    // Attempt to parse JSON, fall back to text
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return json(res.status, data);
  } catch (err) {
    return json(500, { error: 'Proxy error', details: String(err) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
    },
    body: JSON.stringify(body)
  };
}
