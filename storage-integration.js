/**
 * Storage Integration - Charge les données historiques 7j au démarrage
 *
 * Ce fichier ne contient plus que loadHistoricalDataToStore(), appelée par
 * l'INIT d'index.html. Il définissait aussi loadDemandTabWithHistory,
 * loadProductionTabWithHistory et loadExchangeTabWithHistory, mais le script
 * inline d'index.html redéclare ces trois fonctions plus bas : les versions
 * d'ici étaient donc systématiquement écrasées, et elles appelaient de toute
 * façon loadDemandTab/loadProductionTab/loadExchangeTab, qui vivent dans
 * js/components/ — des fichiers qu'index.html ne charge pas. mergeWithHistorical
 * et showStorageStats n'étaient appelées de nulle part.
 */

// Charger les données historiques au démarrage
function loadHistoricalDataToStore() {
  log('📚 Chargement données historiques 7 jours');

  try {
    const historical = StorageManager.getLastDays(7);

    // Charger les données dans store si elles n'y sont pas
    if (historical.demand.length > 0 && store.demand.length === 0) {
      store.demand = historical.demand;
      log(`✅ Historique demand: ${store.demand.length} points chargés`);
    }

    if (historical.production.length > 0 && store.production.length === 0) {
      store.production = historical.production;
      log(`✅ Historique production: ${store.production.length} points chargés`);
    }

    if (historical.exchange.length > 0 && store.exchange.length === 0) {
      store.exchange = historical.exchange;
      log(`✅ Historique exchange: ${store.exchange.length} points chargés`);
    }

    // Afficher les stats
    StorageManager.logStats();

  } catch(err) {
    log(`⚠️ Historique non disponible: ${err.message}`);
  }
}
