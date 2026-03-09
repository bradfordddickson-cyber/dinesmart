/**
 * DineSmart — Backend Server
 *
 * Responsibilities:
 *   1. Serve the static index.html
 *   2. Proxy Claude API calls (keeps API key server-side, never in browser)
 *   3. Audit log every AI recommendation request (student ID, timestamp, prefs)
 *   4. HarvardKey (Shibboleth SAML) auth hook — stubbed, ready to wire up
 *   5. Rate limiting to prevent abuse
 *
 * For production deployment, set these environment variables:
 *   ANTHROPIC_API_KEY   — your Claude API key
 *   SESSION_SECRET      — random string for session signing
 *   PORT                — defaults to 3000
 *   HARVARD_KEY_ENABLED — set to "true" to enforce HarvardKey auth
 *   NODE_ENV            — "production" enables security headers + rate limits
 */

'use strict';

const express     = require('express');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');
const helmet      = require('helmet');
const morgan      = require('morgan');
const session     = require('express-session');
const path        = require('path');
const fs          = require('fs');
const https       = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'unpkg.com', "'unsafe-inline'"],  // Babel + React CDN
      styleSrc:    ["'self'", 'fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc:     ["'self'", 'fonts.gstatic.com'],
      connectSrc:  ["'self'"],  // AI calls go through /api — never direct to Anthropic
      imgSrc:      ["'self'", 'data:'],
    },
  },
}));

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan(PROD ? 'combined' : 'dev'));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '32kb' }));
app.use(cors({ origin: PROD ? 'https://dinesmart.harvard.edu' : '*' }));

// ─── Session (needed for HarvardKey) ─────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   PROD,       // HTTPS only in prod
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000,  // 8-hour session (one dining day)
  },
}));

// ─── Rate limiting ─────────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      20,               // 20 AI requests per student per 15 min
  message:  { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ─── Audit log ───────────────────────────────────────────────────────────────
const AUDIT_LOG = path.join(__dirname, 'audit.log');

function auditLog(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFile(AUDIT_LOG, line, () => {});  // fire-and-forget
}

// ─── HarvardKey (Shibboleth SAML) auth middleware ────────────────────────────
//
// In production, Harvard IT provides a Shibboleth SP (Service Provider) module
// that sets req.session.user after the IdP (identity.harvard.edu) authenticates.
//
// To enable:
//   1. Register your app at https://huit.harvard.edu/saml-registration
//   2. Set HARVARD_KEY_ENABLED=true in your environment
//   3. Configure passport-saml with the Harvard IdP metadata
//   4. Replace the stub below with real session validation
//
function requireHarvardKey(req, res, next) {
  if (process.env.HARVARD_KEY_ENABLED !== 'true') {
    // Dev mode: bypass auth, attach a mock user
    req.user = { huid: 'dev-user', name: 'Dev Student', email: 'dev@college.harvard.edu' };
    return next();
  }

  if (req.session?.user?.huid) {
    return next();
  }

  // Redirect to HarvardKey IdP (in production, passport-saml handles this)
  res.status(401).json({
    error:       'Authentication required',
    loginUrl:    'https://identity.harvard.edu/idp/profile/SAML2/Redirect/SSO',
    description: 'Sign in with your Harvard Key to use DineSmart.',
  });
}

// ─── AI Recommendation proxy ─────────────────────────────────────────────────
//
// The browser NEVER sends requests directly to Anthropic.
// The API key lives only here, in the server environment.
//
app.post('/api/recommend', aiLimiter, requireHarvardKey, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Set ANTHROPIC_API_KEY.' });
  }

  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  // Audit every AI request — required for Harvard IT data governance review
  auditLog({
    type:    'ai_recommend',
    huid:    req.user?.huid,
    msgCount: messages.length,
    ip:      req.ip,
  });

  try {
    // Proxy to Anthropic Messages API
    const body = JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      messages,
    });

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
      });
    });

    proxyReq.on('error', err => {
      console.error('AI proxy error:', err.message);
      res.status(502).json({ error: 'AI service unavailable.' });
    });

    proxyReq.write(body);
    proxyReq.end();

  } catch (err) {
    console.error('Unexpected error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── Future: FoodPro menu sync endpoint ──────────────────────────────────────
//
// Harvard HUDS runs FoodPro at foodpro.huds.harvard.edu.
// This endpoint will fetch and cache today's menu server-side once HUDS
// provides a data-sharing agreement and FoodPro API credentials.
//
app.get('/api/menus/today', requireHarvardKey, (req, res) => {
  res.json({
    status:  'not_implemented',
    message: 'Live FoodPro sync pending HUDS data agreement. Contact huds@harvard.edu.',
    date:    new Date().toISOString().split('T')[0],
  });
});

// ─── Health check (for uptime monitoring / Harvard IT review) ─────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    version: require('./package.json').version,
    env:     PROD ? 'production' : 'development',
    auth:    process.env.HARVARD_KEY_ENABLED === 'true' ? 'HarvardKey' : 'dev-bypass',
    ai:      process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
    time:    new Date().toISOString(),
  });
});

// ─── Serve static app ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`DineSmart running at http://localhost:${PORT}`);
  console.log(`Auth:  ${process.env.HARVARD_KEY_ENABLED === 'true' ? 'HarvardKey enforced' : 'Dev bypass (set HARVARD_KEY_ENABLED=true for prod)'}`);
  console.log(`AI:    ${process.env.ANTHROPIC_API_KEY ? 'API key loaded' : 'WARNING: ANTHROPIC_API_KEY not set'}`);
});
