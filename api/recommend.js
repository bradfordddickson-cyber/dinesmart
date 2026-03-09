/**
 * Vercel Serverless Function — /api/recommend
 *
 * Proxies AI recommendation requests to Anthropic.
 * The ANTHROPIC_API_KEY environment variable must be set in Vercel's
 * project settings (Settings → Environment Variables).
 */

const https = require('https');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Set ANTHROPIC_API_KEY in Vercel environment variables.' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  const body = JSON.stringify({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    };

    const proxyReq = https.request(options, proxyRes => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        try {
          res.status(proxyRes.statusCode).json(JSON.parse(data));
        } catch {
          res.status(502).json({ error: 'Invalid response from AI service.' });
        }
        resolve();
      });
    });

    proxyReq.on('error', err => {
      console.error('AI proxy error:', err.message);
      res.status(502).json({ error: 'AI service unavailable.' });
      resolve();
    });

    proxyReq.write(body);
    proxyReq.end();
  });
}
