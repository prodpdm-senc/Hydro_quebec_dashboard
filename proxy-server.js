/**
 * Serveur Proxy CORS pour Hydro-Québec Dashboard
 * Élimine les problèmes CORS en faisant les requêtes côté serveur
 */

const express = require('express');
const cors = require('cors');
// Node.js 18+ a fetch natif, sinon on utilise node-fetch
const nodeFetch = require('node-fetch');
const fetch = globalThis.fetch || nodeFetch;
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Logger pour déboguer
const logRequest = (method, path, status, time) => {
  const timestamp = new Date().toLocaleTimeString('fr-CA');
  console.log(`[${timestamp}] ${method} ${path} → ${status} (${time}ms)`);
};

// ============================================================
// Proxy Routes
// ============================================================

/**
 * Route générique pour proxifier n'importe quelle URL
 * Usage: /proxy?url=https://example.com/api/data
 */
app.get('/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Paramètre url requis' });
  }

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      timeout: 10000,
      redirect: 'follow'
    });

    const contentType = response.headers.get('content-type') || '';
    const time = Date.now() - startTime;
    logRequest('GET', url, response.status, time);

    if (!response.ok) {
      console.error(`⚠️ Response not OK: ${response.status} ${response.statusText}`);
    }

    res.setHeader('Content-Type', contentType || 'application/octet-stream');

    if (contentType.includes('xml') || url.includes('.xml')) {
      const xmlData = await response.text();
      res.send(xmlData);
    } else if (contentType.includes('json')) {
      const jsonData = await response.json();
      res.json(jsonData);
    } else {
      const data = await response.text();
      res.send(data);
    }

  } catch (err) {
    console.error(`❌ Erreur proxy: ${err.message}`);
    res.status(500).json({
      error: err.message,
      url: url
    });
  }
});

/**
 * Route spécifique pour Hydro-Québec Demande
 */
app.get('/api/hydro-quebec/demande', async (req, res) => {
  const url = 'https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/demande.json';

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    });
    const data = await response.json();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/hydro-quebec/demande', response.status, time);
    res.json(data);

  } catch (err) {
    console.error(`❌ Demande: ${err.message}`);
    res.status(500).json({ error: 'Hydro-Québec Demande indisponible', details: err.message });
  }
});

/**
 * Route spécifique pour Hydro-Québec Production
 */
app.get('/api/hydro-quebec/production', async (req, res) => {
  const url = 'https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/production.json';

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    });
    const data = await response.json();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/hydro-quebec/production', response.status, time);
    res.json(data);

  } catch (err) {
    console.error(`❌ Production: ${err.message}`);
    res.status(500).json({ error: 'Hydro-Québec Production indisponible', details: err.message });
  }
});

/**
 * Route spécifique pour Hydro-Québec Échanges (Import/Export)
 */
app.get('/api/hydro-quebec/exchange', async (req, res) => {
  const url = 'https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/importations-exportations-avec-transits/exports/json?lang=fr&limit=2000';

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    });
    const data = await response.json();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/hydro-quebec/exchange', response.status, time);
    res.json(data);

  } catch (err) {
    console.error(`❌ Échanges: ${err.message}`);
    res.status(500).json({ error: 'Hydro-Québec Échanges indisponible', details: err.message });
  }
});

/**
 * Route spécifique pour Ontario IESO
 */
app.get('/api/ieso/realtime', async (req, res) => {
  const url = 'https://reports.ieso.ca/public/RealtimeConstTotals/PUB_RealtimeConstTotals.xml';

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    });
    const data = await response.text();
    const time = Date.now() - startTime;

    logRequest('GET', '/api/ieso/realtime', response.status, time);
    res.setHeader('Content-Type', 'application/xml');
    res.send(data);

  } catch (err) {
    console.error(`❌ IESO: ${err.message}`);
    res.status(500).json({ error: 'Ontario IESO indisponible', details: err.message });
  }
});

// ============================================================
// Health Check & Status
// ============================================================

/**
 * Route de santé pour vérifier que le serveur roule
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT
  });
});

/**
 * Route d'info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Hydro-Québec Dashboard Proxy Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      '/api/hydro-quebec/demande': 'Données de demande Hydro-Québec',
      '/api/hydro-quebec/production': 'Données de production Hydro-Québec',
      '/api/hydro-quebec/exchange': 'Données d\'import/export Hydro-Québec',
      '/api/ieso/realtime': 'Données temps réel Ontario IESO',
      '/proxy?url=...': 'Proxy générique pour n\'importe quelle URL',
      '/health': 'Vérifier la santé du serveur'
    }
  });
});

// ============================================================
// Démarrage
// ============================================================

app.listen(PORT, () => {
  console.log(`\n✅ Serveur Proxy lancé sur http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Demande: http://localhost:${PORT}/api/hydro-quebec/demande`);
  console.log(`⚡ Production: http://localhost:${PORT}/api/hydro-quebec/production`);
  console.log(`🔄 Échanges: http://localhost:${PORT}/api/hydro-quebec/exchange`);
  console.log(`🔌 IESO: http://localhost:${PORT}/api/ieso/realtime`);
  console.log(`💊 Santé: http://localhost:${PORT}/health\n`);
});

// Gestion des erreurs
process.on('unhandledRejection', (err) => {
  console.error('❌ Erreur non gérée:', err);
});
