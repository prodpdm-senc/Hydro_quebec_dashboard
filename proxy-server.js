/**
 * Serveur Proxy CORS pour Hydro-Québec Dashboard
 * 
 * Version "Le plus simple" pour 7 jours de sauvegarde solide.
 * - Récupère les données régulièrement
 * - Sauvegarde tout dans un seul fichier SQLite (hq-history.db)
 * - Garde automatiquement les 7 derniers jours
 * - Expose /api/history/* pour que le dashboard puisse lire l'historique
 */

const express = require('express');
const cors = require('cors');
const nodeFetch = require('node-fetch');
const Database = require('better-sqlite3');
const fetch = globalThis.fetch || nodeFetch;

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// SQLite - Sauvegarde 7 jours (le plus simple possible)
// ============================================================

const db = new Database('hq-history.db');
db.pragma('journal_mode = WAL');

// Création des tables (si elles n'existent pas)
db.exec(`
  CREATE TABLE IF NOT EXISTS demand (
    timestamp TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS production (
    timestamp TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exchange (
    timestamp TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

// Nettoyage automatique des données > 8 jours (marge de sécurité)
function cleanupOldData() {
  const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const stmtDemand = db.prepare('DELETE FROM demand WHERE timestamp < ?');
  const stmtProd = db.prepare('DELETE FROM production WHERE timestamp < ?');
  const stmtExch = db.prepare('DELETE FROM exchange WHERE timestamp < ?');

  const deletedDemand = stmtDemand.run(cutoff).changes;
  const deletedProd = stmtProd.run(cutoff).changes;
  const deletedExch = stmtExch.run(cutoff).changes;

  if (deletedDemand + deletedProd + deletedExch > 0) {
    console.log(`🧹 Nettoyage 7j : ${deletedDemand} demande, ${deletedProd} production, ${deletedExch} échanges supprimés`);
  }
}

// Sauvegarde d'un enregistrement
function saveRecord(table, timestamp, data) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO ${table} (timestamp, data) VALUES (?, ?)
    `);
    stmt.run(timestamp, JSON.stringify(data));
  } catch (e) {
    console.error(`Erreur sauvegarde ${table}:`, e.message);
  }
}

// Récupérer l'historique (utilisé par le dashboard)
function getHistory(table, hours = 168) { // 168h = 7 jours
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare(`
    SELECT timestamp, data FROM ${table} 
    WHERE timestamp >= ? 
    ORDER BY timestamp ASC
  `);
  const rows = stmt.all(cutoff);
  return rows.map(r => ({
    timestamp: r.timestamp,
    ...JSON.parse(r.data)
  }));
}

// Nettoyage au démarrage
cleanupOldData();

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

    // Sauvegarde 7 jours
    if (data && data.details && data.details.length > 0) {
      const latest = data.details[data.details.length - 1];
      if (latest.date) saveRecord('demand', latest.date, latest);
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
      if (latest.date) saveRecord('production', latest.date, latest);
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
      if (ts) saveRecord('exchange', ts, latest);
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
  const countDemand = db.prepare('SELECT COUNT(*) as c FROM demand').get().c;
  const countProd = db.prepare('SELECT COUNT(*) as c FROM production').get().c;
  const countExch = db.prepare('SELECT COUNT(*) as c FROM exchange').get().c;

  res.json({
    status: 'OK',
    persistence: 'SQLite (7 jours)',
    records: {
      demand: countDemand,
      production: countProd,
      exchange: countExch
    }
  });
});

app.post('/history/cleanup', (req, res) => {
  cleanupOldData();
  res.json({ status: 'cleanup done' });
});

// ============================================================
// Démarrage
// ============================================================

app.listen(PORT, () => {
  console.log(`\n✅ Proxy + Sauvegarde 7 jours SQLite lancé sur http://localhost:${PORT}`);
  console.log(`   Historique : /api/history/demand?hours=168`);
  console.log(`   Nettoyage manuel : POST /history/cleanup\n`);
});

process.on('unhandledRejection', (err) => console.error(err));
