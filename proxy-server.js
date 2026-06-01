/**
 * Serveur Proxy CORS pour Hydro-Québec Dashboard
 * Élimine les problèmes CORS en faisant les requêtes côté serveur
 * 
 * Phase 1 Optimizations:
 * - In-memory response caching
 * - Cache status + clear endpoints (for testing)
 * - Improved logging (cache hits)
 * - Minor hardening
 */

const express = require('express');
const cors = require('cors');
const nodeFetch = require('node-fetch');
const fetch = globalThis.fetch || nodeFetch;

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// Simple In-Memory Cache
// ============================================================

const responseCache = new Map();
const DEFAULT_TTL_MS = 8 * 60 * 1000; // 8 minutes (data updates every ~15 min)

function getFromCache(key, ttlMs = DEFAULT_TTL_MS) {
  const entry = responseCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttlMs) {
    responseCache.delete(key);
    return null;
  }
  return entry;
}

function saveToCache(key, data, contentType) {
  responseCache.set(key, {
    data,
    contentType: contentType || 'application/json',
    timestamp: Date.now()
  });
}

function clearCache() {
  const size = responseCache.size;
  responseCache.clear();
  console.log(`🧹 Proxy cache cleared (${size} entries)`);
  return size;
}

function getCacheStatus() {
  const entries = [];
  for (const [key, entry] of responseCache.entries()) {
    entries.push({
      key,
      ageSeconds: Math.round((Date.now() - entry.timestamp) / 1000),
      size: typeof entry.data === 'string' ? entry.data.length : JSON.stringify(entry.data).length
    });
  }
  return {
    size: responseCache.size,
    entries
  };
}

// ============================================================
// Middleware
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Logger
const logRequest = (method, path, status, time, cached = false) => {
  const timestamp = new Date().toLocaleTimeString('fr-CA');
  const cacheTag = cached ? ' [CACHE HIT]' : '';
  console.log(`[${timestamp}] ${method} ${path} → ${status} (${time}ms)${cacheTag}`);
};

// ============================================================
// Cache Management Endpoints (for testing & debugging)
// ============================================================

app.get('/cache/status', (req, res) => {
  res.json({
    status: 'OK',
    cache: getCacheStatus()
  });
});

app.post('/cache/clear', (req, res) => {
  const cleared = clearCache();
  res.json({ status: 'cleared', entriesRemoved: cleared });
});

// ============================================================
// Proxy Routes
// ============================================================

/**
 * Generic proxy with caching support
 */
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Paramètre url requis' });
  }

  const cacheKey = `proxy:${url}`;
  const cached = getFromCache(cacheKey, 5 * 60 * 1000); // shorter TTL for generic
  if (cached) {
    logRequest('GET', `/proxy?url=...`, 200, 0, true);
    res.setHeader('Content-Type', cached.contentType);
    return res.send(cached.data);
  }

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      },
      timeout: 12000,
      redirect: 'follow'
    });

    const contentType = response.headers.get('content-type') || '';
    const time = Date.now() - startTime;
    logRequest('GET', `/proxy?url=...`, response.status, time);

    let body;
    if (contentType.includes('json')) {
      body = await response.json();
      saveToCache(cacheKey, body, contentType);
      return res.json(body);
    } else {
      body = await response.text();
      saveToCache(cacheKey, body, contentType);
      res.setHeader('Content-Type', contentType || 'text/plain');
      return res.send(body);
    }
  } catch (err) {
    console.error(`❌ Erreur proxy générique: ${err.message}`);
    res.status(500).json({ error: err.message, url });
  }
});

/**
 * Hydro-Québec Demande (with caching)
 */
app.get('/api/hydro-quebec/demande', async (req, res) => {
  const cacheKey = 'hydro-demande';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logRequest('GET', '/api/hydro-quebec/demande', 200, 0, true);
    res.setHeader('Content-Type', cached.contentType);
    return res.send(cached.data);
  }

  try {
    const startTime = Date.now();
    const response = await fetch(
      'https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/demande.json',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 10000 }
    );
    const data = await response.json();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/hydro-quebec/demande', response.status, time);
    saveToCache(cacheKey, JSON.stringify(data), 'application/json');
    res.json(data);
  } catch (err) {
    console.error(`❌ Demande: ${err.message}`);
    res.status(500).json({ error: 'Hydro-Québec Demande indisponible', details: err.message });
  }
});

/**
 * Hydro-Québec Production (with caching)
 */
app.get('/api/hydro-quebec/production', async (req, res) => {
  const cacheKey = 'hydro-production';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logRequest('GET', '/api/hydro-quebec/production', 200, 0, true);
    res.setHeader('Content-Type', cached.contentType);
    return res.send(cached.data);
  }

  try {
    const startTime = Date.now();
    const response = await fetch(
      'https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/production.json',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 10000 }
    );
    const data = await response.json();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/hydro-quebec/production', response.status, time);
    saveToCache(cacheKey, JSON.stringify(data), 'application/json');
    res.json(data);
  } catch (err) {
    console.error(`❌ Production: ${err.message}`);
    res.status(500).json({ error: 'Hydro-Québec Production indisponible', details: err.message });
  }
});

/**
 * Hydro-Québec Échanges (with caching)
 */
app.get('/api/hydro-quebec/exchange', async (req, res) => {
  const cacheKey = 'hydro-exchange';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logRequest('GET', '/api/hydro-quebec/exchange', 200, 0, true);
    res.setHeader('Content-Type', cached.contentType);
    return res.send(cached.data);
  }

  try {
    const startTime = Date.now();
    const response = await fetch(
      'https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/importations-exportations-avec-transits/exports/json?lang=fr&limit=2000',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 10000 }
    );
    const data = await response.json();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/hydro-quebec/exchange', response.status, time);
    saveToCache(cacheKey, JSON.stringify(data), 'application/json');
    res.json(data);
  } catch (err) {
    console.error(`❌ Échanges: ${err.message}`);
    res.status(500).json({ error: 'Hydro-Québec Échanges indisponible', details: err.message });
  }
});

/**
 * Ontario IESO (with caching - XML)
 */
app.get('/api/ieso/realtime', async (req, res) => {
  const cacheKey = 'ieso-realtime';
  const cached = getFromCache(cacheKey, 10 * 60 * 1000); // IESO can be a bit slower
  if (cached) {
    logRequest('GET', '/api/ieso/realtime', 200, 0, true);
    res.setHeader('Content-Type', cached.contentType);
    return res.send(cached.data);
  }

  try {
    const startTime = Date.now();
    const response = await fetch(
      'https://reports.ieso.ca/public/RealtimeConstTotals/PUB_RealtimeConstTotals.xml',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 10000 }
    );
    const data = await response.text();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/ieso/realtime', response.status, time);
    saveToCache(cacheKey, data, 'application/xml');
    res.setHeader('Content-Type', 'application/xml');
    res.send(data);
  } catch (err) {
    console.error(`❌ IESO: ${err.message}`);
    res.status(500).json({ error: 'Ontario IESO indisponible', details: err.message });
  }
});

// ============================================================
// Health & Info
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    cacheSize: responseCache.size
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Hydro-Québec Dashboard Proxy Server',
    version: '1.1.0 (with caching)',
    status: 'running',
    cache: {
      size: responseCache.size,
      endpoints: ['/cache/status', '/cache/clear']
    },
    endpoints: {
      '/api/hydro-quebec/demande': 'Données de demande Hydro-Québec',
      '/api/hydro-quebec/production': 'Données de production',
      '/api/hydro-quebec/exchange': 'Import/export',
      '/api/ieso/realtime': 'Ontario IESO',
      '/proxy?url=...': 'Proxy générique',
      '/health': 'Santé',
      '/cache/status': 'Statut du cache',
      '/cache/clear': 'Vider le cache (POST)'
    }
  });
});

// ============================================================
// Startup
// ============================================================

app.listen(PORT, () => {
  console.log(`\n✅ Serveur Proxy lancé sur http://localhost:${PORT} (v1.1 - caching enabled)`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔄 Cache status: http://localhost:${PORT}/cache/status`);
  console.log(`🧹 Clear cache: POST http://localhost:${PORT}/cache/clear\n`);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Erreur non gérée:', err);
});
