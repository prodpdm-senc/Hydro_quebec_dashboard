/**
 * Storage Manager - 7-Day Rolling Memory for Energy Dashboard
 * Persists energy data (demand, production, exchange) to localStorage
 * Maintains a rolling window of the last 7 days
 */

const StorageManager = (() => {
  const STORAGE_KEY = 'hq-energy-history';
  const MAX_DAYS = 7;
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // Cleanup every hour

  let cleanupTimeout = null;

  /**
   * Data structure stored in localStorage:
   * {
   *   demand: [{ date, valeurs }, ...],
   *   production: [{ date, valeurs }, ...],
   *   exchange: [{ date, valeurs }, ...],
   *   lastUpdated: timestamp,
   *   version: 1
   * }
   */

  const init = () => {
    cleanup();
    scheduleCleanup();
    log('💾 Mémoire 7j rolling initialisée');
  };

  const save = (dataType, data) => {
    /**
     * Save a single data point
     * @param {string} dataType - 'demand', 'production', or 'exchange'
     * @param {object} data - { date, valeurs }
     */
    const stored = load();

    if (!stored[dataType]) {
      stored[dataType] = [];
    }

    // Avoid duplicates
    const exists = stored[dataType].some(d => d.date === data.date);
    if (!exists) {
      stored[dataType].push(data);
      // Keep sorted by date
      stored[dataType].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    stored.lastUpdated = Date.now();
    stored.version = 1;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.warn('StorageManager: localStorage full or disabled', e);
    }
  };

  const saveBatch = (entries) => {
    /**
     * Add multiple data points at once
     * @param {array} entries - [{ type: 'demand', date, valeurs }, ...]
     */
    const stored = load();

    entries.forEach(({ type, date, valeurs }) => {
      if (!stored[type]) {
        stored[type] = [];
      }

      // Avoid duplicates
      const exists = stored[type].some(d => d.date === date);
      if (!exists) {
        stored[type].push({ date, valeurs });
      }
    });

    // Sort all arrays
    Object.keys(['demand', 'production', 'exchange']).forEach(key => {
      if (stored[key]) {
        stored[key].sort((a, b) => new Date(a.date) - new Date(b.date));
      }
    });

    stored.lastUpdated = Date.now();
    stored.version = 1;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.warn('StorageManager: localStorage full or disabled', e);
    }
  };

  const load = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { demand: [], production: [], exchange: [], version: 1 };

      const parsed = JSON.parse(stored);
      return {
        demand: parsed.demand || [],
        production: parsed.production || [],
        exchange: parsed.exchange || [],
        lastUpdated: parsed.lastUpdated,
        version: parsed.version || 1
      };
    } catch (e) {
      console.error('StorageManager: Error loading data', e);
      return { demand: [], production: [], exchange: [], version: 1 };
    }
  };

  const getLastDays = (days = MAX_DAYS) => {
    const data = load();
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    return {
      demand: data.demand.filter(d => new Date(d.date) >= new Date(cutoffTime)),
      production: data.production.filter(d => new Date(d.date) >= new Date(cutoffTime)),
      exchange: data.exchange.filter(d => new Date(d.date) >= new Date(cutoffTime)),
      lastUpdated: data.lastUpdated
    };
  };

  const cleanup = () => {
    const data = load();
    const cutoffTime = Date.now() - (MAX_DAYS * 24 * 60 * 60 * 1000);

    const before = {
      demand: data.demand.length,
      production: data.production.length,
      exchange: data.exchange.length
    };

    // Remove entries older than 7 days
    data.demand = data.demand.filter(d => new Date(d.date) >= new Date(cutoffTime));
    data.production = data.production.filter(d => new Date(d.date) >= new Date(cutoffTime));
    data.exchange = data.exchange.filter(d => new Date(d.date) >= new Date(cutoffTime));

    data.lastUpdated = Date.now();
    data.version = 1;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('StorageManager: cleanup failed', e);
    }

    const after = {
      demand: data.demand.length,
      production: data.production.length,
      exchange: data.exchange.length
    };

    const deleted = {
      demand: before.demand - after.demand,
      production: before.production - after.production,
      exchange: before.exchange - after.exchange
    };

    log(`🧹 Nettoyage 7j: ${deleted.demand} demandes, ${deleted.production} prod, ${deleted.exchange} échanges supprimés`);
    return deleted;
  };

  const scheduleCleanup = () => {
    if (cleanupTimeout) clearTimeout(cleanupTimeout);
    cleanupTimeout = setTimeout(() => {
      cleanup();
      scheduleCleanup();
    }, CLEANUP_INTERVAL);
  };

  const clear = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      log('🗑️ Mémoire 7 jours vidée');
    } catch (e) {
      console.warn('StorageManager: clear failed', e);
    }
  };

  const getStats = () => {
    const data = load();
    const size = new Blob([JSON.stringify(data)]).size;
    const sizeKB = (size / 1024).toFixed(2);

    return {
      demandPoints: data.demand.length,
      productionPoints: data.production.length,
      exchangePoints: data.exchange.length,
      storageSizeKB: sizeKB,
      storagePercent: ((size / (5 * 1024 * 1024)) * 100).toFixed(2), // 5MB limit
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('fr-CA') : 'Jamais'
    };
  };

  const logStats = () => {
    const stats = getStats();
    log(`📊 Mémoire: ${stats.demandPoints} demandes, ${stats.productionPoints} prod, ${stats.exchangePoints} échanges | ${stats.storageSizeKB}KB (${stats.storagePercent}%)`);
  };

  return {
    init,
    save,
    saveBatch,
    load,
    getLastDays,
    cleanup,
    clear,
    getStats,
    logStats
  };
})();
