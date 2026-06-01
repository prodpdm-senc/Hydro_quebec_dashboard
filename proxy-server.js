/**
 * Serveur Proxy CORS pour Hydro-Québec Dashboard
 * 
 * Version "Le plus simple" (JSON) pour 7 jours de sauvegarde solide.
 * - Récupère les données régulièrement
 * - Sauvegarde dans des fichiers JSON quotidiens (data/*.jsonl)
 * - Garde automatiquement les 7 derniers jours
 * - Expose /api/history/* pour que le dashboard puisse lire l'historique
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodeFetch = require('node-fetch');
const fetch = globalThis.fetch || nodeFetch;

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// JSON 7 jours - Le plus simple possible (NDJSON par jour)
// ============================================================

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getDailyFile(type) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(DATA_DIR, `${type}-${date}.jsonl`);
}

function appendRecord(type, timestamp, data) {
  try {
    const file = getDailyFile(type);
    const line = JSON.stringify({ timestamp, data }) + '\n';
    fs.appendFileSync(file, line);
  } catch (e) {
    console.error(`Erreur append ${type}:`, e.message);
  }
}

function cleanupOldFiles() {
  const cutoff = Date.now() - (8 * 24 * 60 * 60 * 1000);
  const files = fs.readdirSync(DATA_DIR);
  let deleted = 0;

  for (const f of files) {
    const match = f.match(/^(demand|production|exchange)-(\d{4}-\d{2}-\d{2})\.jsonl$/);
    if (match) {
      const fileDate = new Date(match[2] + 'T00:00:00');
      if (fileDate.getTime() < cutoff) {
        fs.unlinkSync(path.join(DATA_DIR, f));
        deleted++;
      }
    }
  }
  if (deleted > 0) {
    console.log(`\ud83e\uddf9 Nettoyage 7j JSON : ${deleted} fichiers supprimés`);
  }
}

function getHistory(type, hours = 168) {
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(`${type}-`) && f.endsWith('.jsonl'))
    .sort();

  const result = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
      const lines = content.trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        const obj = JSON.parse(line);
        if (new Date(obj.timestamp).getTime() >= cutoff) {
          result.push(obj);
        }
      }
    } catch (e) {}
  }
  return result;
}

// Nettoyage au démarrage
cleanupOldFiles();

// ============================================================
// In-Memory Cache (gardé pour performance)
// ============================================================

const responseCache = new Map();
const DEFAULT_TTL_MS = 8 * 60 * 1000;

function getFromCache(key, ttlMs = DEFAULT_TTL_MS) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age > ttlMs) { responseCache.delete(key); return null; }
  return entry;
}

function saveToCache(key, data, contentType) {
  responseCache.set(key, { data, contentType: contentType || 'application/json', timestamp: Date.now() });
}

function clearCache() {
  responseCache.clear();
}

// ============================================================
// Middleware
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const logRequest = (method, path, status, time, cached = false) => {
  const ts = new Date().toLocaleTimeString('fr-CA');
  const tag = cached ? ' [CACHE]' : '';
  console.log(`[${ts}] ${method} ${path} → ${status} (${time}ms)${tag}`);
};

// ============================================================
// Endpoints d'historique (7 jours solides)
// ============================================================

app.get('/api/history/demand', (req, res) => {
  const hours = parseInt(req.query.hours) || 168;
  res.json(getHistory('demand', hours));
});

app.get('/api/history/production', (req, res) => {
  const hours = parseInt(req.query.hours) || 168;
  res.json(getHistory('production', hours));
});

app.get('/api/history/exchange', (req, res) => {
  const hours = parseInt(req.query.hours) || 168;
  res.json(getHistory('exchange', hours));
});

// ============================================================
// Proxy Routes (avec sauvegarde)
// ============================================================

app.get('/api/hydro-quebec/demande', async (req, res) => {
  const cacheKey = 'hydro-demande';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logRequest('GET', '/api/hydro-quebec/demande', 200, 0, true);
    return res.setHeader('Content-Type', cached.contentType).send(cached.data);
  }

  try {
    const start = Date.now();
    const response = await fetch('https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/demande.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    });
    const data = await response.json();
    const time = Date.now() - start;

    logRequest('GET', '/api/hydro-quebec/demande', response.status, time);

    // Sauvegarde 7 jours (JSON)
    if (data && data.details && data.details.length > 0) {
      const latest = data.details[data.details.length - 1];
      if (latest.date) appendRecord('demand', latest.date, latest);
    }

    saveToCache(cacheKey, JSON.stringify(data), 'application/json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Demande indisponible' });
  }
});

app.get('/api/hydro-quebec/production', async (req, res) => {
  const cacheKey = 'hydro-production';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logRequest('GET', '/api/hydro-quebec/production', 200, 0, true);
    return res.setHeader('Content-Type', cached.contentType).send(cached.data);
  }

  try {
    const start = Date.now();
    const response = await fetch('https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/production.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    });
    const data = await response.json();
    const time = Date.now() - start;

    logRequest('GET', '/api/hydro-quebec/production', response.status, time);

    if (data && data.details && data.details.length > 0) {
      const latest = data.details[data.details.length - 1];
      if (latest.date) appendRecord('production', latest.date, latest);
    }

    saveToCache(cacheKey, JSON.stringify(data), 'application/json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Production indisponible' });
  }
});

app.get('/api/hydro-quebec/exchange', async (req, res) => {
  const cacheKey = 'hydro-exchange';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logRequest('GET', '/api/hydro-quebec/exchange', 200, 0, true);
    return res.setHeader('Content-Type', cached.contentType).send(cached.data);
  }

  try {
    const start = Date.now();
    const response = await fetch('https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/importations-exportations-avec-transits/exports/json?lang=fr&limit=2000', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    });
    const data = await response.json();
    const time = Date.now() - start;

    logRequest('GET', '/api/hydro-quebec/exchange', response.status, time);

    // Pour les échanges, on prend le dernier enregistrement
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length - 1];
      const ts = latest.date || latest.fields?.date;
      if (ts) appendRecord('exchange', ts, latest);
    }

    saveToCache(cacheKey, JSON.stringify(data), 'application/json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Échanges indisponible' });
  }
});

// ============================================================
// Utilitaires
// ============================================================

app.get('/health', (req, res) => {
  // Simple count from today's files (for quick visibility)
  const today = new Date().toISOString().slice(0, 10);
  let countDemand = 0, countProd = 0, countExch = 0;

  try {
    const demandFile = path.join(DATA_DIR, `demand-${today}.jsonl`);
    if (fs.existsSync(demandFile)) countDemand = fs.readFileSync(demandFile, 'utf8').trim().split('\n').filter(Boolean).length;

    const prodFile = path.join(DATA_DIR, `production-${today}.jsonl`);
    if (fs.existsSync(prodFile)) countProd = fs.readFileSync(prodFile, 'utf8').trim().split('\n').filter(Boolean).length;

    const exchFile = path.join(DATA_DIR, `exchange-${today}.jsonl`);
    if (fs.existsSync(exchFile)) countExch = fs.readFileSync(exchFile, 'utf8').trim().split('\n').filter(Boolean).length;
  } catch (e) {}

  res.json({
    status: 'OK',
    persistence: 'JSON files (7 jours)',
    recordsToday: {
      demand: countDemand,
      production: countProd,
      exchange: countExch
    }
  });
});

app.post('/history/cleanup', (req, res) => {
  cleanupOldFiles();
  res.json({ status: 'cleanup done' });
});

// ============================================================
// Démarrage
// ============================================================

app.listen(PORT, () => {
  console.log(`\n\u2705 Proxy + Sauvegarde 7 jours (JSON files) lancé sur http://localhost:${PORT}`);
  console.log(`   Historique : /api/history/demand?hours=168`);
  console.log(`   Nettoyage manuel : POST /history/cleanup\n`);
});

process.on('unhandledRejection', (err) => console.error(err));
