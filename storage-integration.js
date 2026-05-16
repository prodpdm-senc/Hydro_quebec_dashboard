/**
 * Storage Integration - Charge les données historiques 7j au démarrage
 * Affiche l'historique sur les graphiques existants
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

// Fusionner les données historiques avec les nouvelles
function mergeWithHistorical(dataType, newData) {
  /**
   * Fusionne les nouvelles données avec l'historique
   * Évite les doublons et garde les données triées
   */
  const historical = StorageManager.getLastDays(7);
  const existing = historical[dataType] || [];

  // Créer une map des timestamps pour éviter doublons
  const timestampMap = new Map();

  // Ajouter l'historique d'abord
  existing.forEach(item => {
    timestampMap.set(item.date, item);
  });

  // Ajouter les nouvelles données (remplace si doublon)
  newData.forEach(item => {
    timestampMap.set(item.date, item);
  });

  // Convertir en array et trier chronologiquement
  const merged = Array.from(timestampMap.values());
  merged.sort((a, b) => new Date(a.date) - new Date(b.date));

  log(`🔄 Fusion ${dataType}: ${existing.length} historique + ${newData.length} nouveau = ${merged.length} total`);

  return merged;
}

// Modifier loadDemandTab pour afficher l'historique + nouvelles données
function loadDemandTabWithHistory() {
  log('🔄 Chargement Demande (avec historique)');
  try {
    // Si pas de données en store, charger l'historique
    if (!store.demand || store.demand.length === 0) {
      loadHistoricalDataToStore();
    }

    // Si toujours pas de données, charger depuis l'API
    if (!store.demand || store.demand.length === 0) {
      return loadDemandTab(); // Charger normalement depuis l'API
    }

    // Afficher les données (historique + mise à jour)
    renderDemandCharts();
    log(`✅ Demande affichée: ${store.demand.length} points (historique + actualisés)`);

  } catch(err) {
    log(`❌ Demande: ${err.message}`, true);
    throw err;
  }
}

// Modifier loadProductionTab pour afficher l'historique + nouvelles données
function loadProductionTabWithHistory() {
  log('🔄 Chargement Production (avec historique)');
  try {
    // Si pas de données en store, charger l'historique
    if (!store.production || store.production.length === 0) {
      loadHistoricalDataToStore();
    }

    // Si toujours pas de données, charger depuis l'API
    if (!store.production || store.production.length === 0) {
      return loadProductionTab(); // Charger normalement depuis l'API
    }

    // Afficher les données
    renderProductionCharts();
    log(`✅ Production affichée: ${store.production.length} points (historique + actualisés)`);

  } catch(err) {
    log(`❌ Production: ${err.message}`, true);
    throw err;
  }
}

// Modifier loadExchangeTab pour afficher l'historique + nouvelles données
function loadExchangeTabWithHistory() {
  log('🔄 Chargement Échanges (avec historique)');
  try {
    // Si pas de données en store, charger l'historique
    if (!store.exchange || store.exchange.length === 0) {
      loadHistoricalDataToStore();
    }

    // Si toujours pas de données, charger depuis l'API
    if (!store.exchange || store.exchange.length === 0) {
      return loadExchangeTab(); // Charger normalement depuis l'API
    }

    // Afficher les données
    renderExchangeCharts();
    log(`✅ Échanges affichés: ${store.exchange.length} points (historique + actualisés)`);

  } catch(err) {
    log(`❌ Échanges: ${err.message}`, true);
    throw err;
  }
}

// Ajouter un onglet "Historique" optionnel pour afficher les stats
function showStorageStats() {
  const stats = StorageManager.getStats();
  const msg = `📊 Historique 7j:\n` +
    `  Demande: ${stats.demandPoints} points\n` +
    `  Production: ${stats.productionPoints} points\n` +
    `  Échanges: ${stats.exchangePoints} points\n` +
    `  Stockage: ${stats.storageSizeKB}KB (${stats.storagePercent}%)\n` +
    `  Dernière maj: ${stats.lastUpdated}`;

  log(msg);
  alert(msg); // Afficher une alerte aussi
}
