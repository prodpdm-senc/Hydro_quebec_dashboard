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
    console.log(`🧹 Nettoyage 7j JSON : ${deleted} fichiers supprimés`);
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
// Données hydrauliques Hydro-Québec (donnees.hydroquebec.com)
//
// Deux jeux de données, deux conventions de champs :
//  - donnees-hydrometriques      : débits aux installations
//      type   -> depil_json_type_point_donnee  ("Débit turbiné - La Grande-4")
//      date   -> split_date   (TEXTE, format "2026/09/11T16:00:00Z")
//      valeur -> split_value  (TEXTE)
//  - donnees-hydrometeorologiques : niveaux, débits en rivière, météo
//      type   -> composition_depil_type_point_donnee  ("Niveau")
//      date   -> date    (datetime ISO, filtrable côté serveur)
//      valeur -> valeur  (TEXTE)
//
// On passe par /exports/json et non /records : /records plafonne à
// limit=100 (HTTP 400 au-delà), alors que /exports/json rend le jeu
// complet en une requête. Aucune pagination n'est donc nécessaire.
// ============================================================

const ODS_BASE = 'https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets';

async function odsExport(dataset, { where, select } = {}) {
  const params = new URLSearchParams({ lang: 'fr' });
  if (where) params.set('where', where);
  if (select) params.set('select', select);

  const url = `${ODS_BASE}/${dataset}/exports/json?${params.toString()}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    timeout: 90000
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} — ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    // L'API renvoie {error_code, message} en cas de requête ODSQL invalide.
    throw new Error(data && data.message ? data.message : 'Réponse inattendue de l\'API');
  }
  return data;
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// "2026/09/11T16:00:00Z" n'est pas parsable par new Date() de façon fiable.
function normalizeHydrometriqueDate(v) {
  return typeof v === 'string' ? v.replace(/\//g, '-') : null;
}

function normHydrometrique(r) {
  return {
    nom: r.nom,
    regionqc: r.regionqc,
    type: r.depil_json_type_point_donnee,
    unite: r.depil_json_nom_unite_mesure,
    date: normalizeHydrometriqueDate(r.split_date),
    valeur: toNumber(r.split_value)
  };
}

function normHydrometeo(r) {
  return {
    nom: r.nom,
    regionqc: r.regionqc,
    type: r.composition_depil_type_point_donnee,
    unite: r.composition_depil_nom_unite_mesure,
    date: r.date,
    valeur: toNumber(r.valeur)
  };
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function byDateAsc(a, b) {
  return String(a.date).localeCompare(String(b.date));
}

// Petit wrapper : cache + log + gestion d'erreur, identiques pour chaque route.
function cachedRoute(routePath, cacheKey, ttlMs, loader) {
  app.get(routePath, async (req, res) => {
    const cached = getFromCache(cacheKey, ttlMs);
    if (cached) {
      logRequest('GET', routePath, 200, 0, true);
      return res.type(cached.contentType).send(cached.data);
    }

    const start = Date.now();
    try {
      const data = await loader(req);
      const payload = JSON.stringify(data);
      saveToCache(cacheKey, payload, 'application/json');
      logRequest('GET', routePath, 200, Date.now() - start);
      console.log(`   ✅ ${Array.isArray(data) ? data.length + ' enregistrements' : 'ok'}`);
      res.type('application/json').send(payload);
    } catch (err) {
      logRequest('GET', routePath, 500, Date.now() - start);
      console.error(`   ❌ ${routePath}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });
}

// ── Niveaux d'eau des réservoirs ────────────────────────────
// ?days=N (défaut 7, max 90)
cachedRoute('/api/hydro-quebec/reservoirs', 'hq-niveaux', 30 * 60 * 1000, async (req) => {
  const days = Math.min(parseInt(req.query.days, 10) || 7, 90);
  console.log(`💧 Niveaux d'eau — ${days} derniers jours`);

  const raw = await odsExport('donnees-hydrometeorologiques', {
    where: `composition_depil_type_point_donnee="Niveau" AND date > '${isoDaysAgo(days)}'`,
    select: 'nom,regionqc,date,valeur,composition_depil_nom_unite_mesure,composition_depil_type_point_donnee'
  });

  const data = raw.map(normHydrometeo).filter(r => r.valeur !== null).sort(byDateAsc);
  const latest = data[data.length - 1];
  if (latest) appendRecord('reservoirs', latest.date, latest);
  return data;
});

// ── Débit turbiné par centrale ──────────────────────────────
// Le débit turbiné est le proxy du niveau de production d'une centrale :
// il indique quelles centrales turbinent réellement.
cachedRoute('/api/hydro-quebec/turbined-flow', 'hq-turbine', 30 * 60 * 1000, async () => {
  console.log('⚡ Débits turbinés — toutes les centrales');

  const raw = await odsExport('donnees-hydrometriques', {
    where: 'depil_json_type_point_donnee LIKE "Débit turbiné"',
    select: 'nom,regionqc,depil_json_type_point_donnee,depil_json_nom_unite_mesure,split_date,split_value'
  });

  const data = raw.map(normHydrometrique).filter(r => r.valeur !== null).sort(byDateAsc);
  const latest = data[data.length - 1];
  if (latest) appendRecord('turbined', latest.date, latest);
  return data;
});

// ── Catalogue région → installation → type ──────────────────
// Reproduit les trois sélecteurs en cascade du tableau de bord HQ.
cachedRoute('/api/hydro-quebec/stations', 'hq-stations', 60 * 60 * 1000, async () => {
  console.log('🗂  Catalogue des stations');

  const [metriques, meteo] = await Promise.all([
    odsExport('donnees-hydrometriques', {
      select: 'nom,regionqc,depil_json_type_point_donnee,depil_json_nom_unite_mesure'
    }),
    odsExport('donnees-hydrometeorologiques', {
      select: 'nom,regionqc,composition_depil_type_point_donnee,composition_depil_nom_unite_mesure'
    })
  ]);

  const catalogue = {};
  const add = (dataset, r) => {
    if (!r.nom || !r.regionqc || !r.type) return;
    const region = (catalogue[r.regionqc] ||= {});
    const station = (region[r.nom] ||= []);
    if (!station.some(t => t.type === r.type)) {
      station.push({ type: r.type, unite: r.unite, dataset });
    }
  };

  metriques.map(normHydrometrique).forEach(r => add('hydrometriques', r));
  meteo.map(normHydrometeo).forEach(r => add('hydrometeorologiques', r));
  return catalogue;
});

// ── Série temporelle ciblée ─────────────────────────────────
// ?dataset=hydrometriques|hydrometeorologiques&type=...&station=...&days=N
app.get('/api/hydro-quebec/timeseries', async (req, res) => {
  const { dataset = 'hydrometriques', type, station } = req.query;
  const days = Math.min(parseInt(req.query.days, 10) || 7, 90);

  if (!type) {
    return res.status(400).json({ error: 'Paramètre "type" requis' });
  }

  const isMetrique = dataset === 'hydrometriques';
  const cacheKey = `hq-ts:${dataset}:${type}:${station || '*'}:${days}`;
  const cached = getFromCache(cacheKey, 15 * 60 * 1000);
  if (cached) {
    logRequest('GET', '/api/hydro-quebec/timeseries', 200, 0, true);
    return res.type(cached.contentType).send(cached.data);
  }

  const start = Date.now();
  try {
    const esc = (v) => String(v).replace(/"/g, '\\"');
    const typeField = isMetrique
      ? 'depil_json_type_point_donnee'
      : 'composition_depil_type_point_donnee';

    const clauses = [`${typeField}="${esc(type)}"`];
    if (station) clauses.push(`nom="${esc(station)}"`);
    // split_date est du texte côté hydrometriques : pas de filtre serveur possible.
    if (!isMetrique) clauses.push(`date > '${isoDaysAgo(days)}'`);

    const raw = await odsExport(
      isMetrique ? 'donnees-hydrometriques' : 'donnees-hydrometeorologiques',
      {
        where: clauses.join(' AND '),
        select: isMetrique
          ? 'nom,regionqc,depil_json_type_point_donnee,depil_json_nom_unite_mesure,split_date,split_value'
          : 'nom,regionqc,date,valeur,composition_depil_nom_unite_mesure,composition_depil_type_point_donnee'
      }
    );

    const data = raw
      .map(isMetrique ? normHydrometrique : normHydrometeo)
      .filter(r => r.valeur !== null)
      .sort(byDateAsc);

    const payload = JSON.stringify(data);
    saveToCache(cacheKey, payload, 'application/json');
    logRequest('GET', '/api/hydro-quebec/timeseries', 200, Date.now() - start);
    res.type('application/json').send(payload);
  } catch (err) {
    logRequest('GET', '/api/hydro-quebec/timeseries', 500, Date.now() - start);
    console.error(`   ❌ timeseries: ${err.message}`);
    res.status(500).json({ error: err.message });
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
  console.log(`\n✅ Proxy + Sauvegarde 7 jours (JSON files) lancé sur http://localhost:${PORT}`);
  console.log(`   Historique : /api/history/demand?hours=168`);
  console.log(`   Nettoyage manuel : POST /history/cleanup\n`);
});

process.on('unhandledRejection', (err) => console.error(err));
