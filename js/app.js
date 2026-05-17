// Application initialization
let refreshInterval = null;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function initApp() {
  console.log('[App] Initializing dashboard...');

  // Load theme preference
  const savedTheme = StorageUtils.getIfFresh('theme') || 'light';
  applyTheme(savedTheme);

  // Theme toggle
  const themeBtn = query('#themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }

  // Refresh button
  const refreshBtn = query('#refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshAllData);
  }

  // Subscribe to store changes to update last update time
  store.subscribe((state) => {
    const lastUpdateEl = query('#lastUpdate');
    if (lastUpdateEl && state.lastUpdate) {
      lastUpdateEl.textContent = formatTime(state.lastUpdate);
    }
  });

  // Set up visibility API to pause polling when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[App] Page hidden - pausing polling');
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    } else {
      console.log('[App] Page visible - resuming polling');
      startAutoRefresh();
    }
  });

  // Start auto-refresh
  startAutoRefresh();

  console.log('[App] Dashboard initialized');
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }
  StorageUtils.setWithTTL('theme', theme, 365 * 24 * 60 * 60 * 1000);
  store.setState('theme', theme);
}

function toggleTheme() {
  const currentTheme = store.getState('theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  console.log(`[Theme] Switched to ${newTheme}`);
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(refreshAllData, REFRESH_INTERVAL);
  console.log('[App] Auto-refresh enabled (every 5 minutes)');
}

async function refreshAllData() {
  if (document.hidden) return;

  console.log('[Refresh] Updating all data...');
  store.updateState({ lastUpdate: new Date().toISOString() });

  // Refresh the active tab
  const activeTab = query('.tab-pane.active');
  if (activeTab && activeTab.id === 'tab-demande') {
    loadDemandTab();
  } else if (activeTab && activeTab.id === 'tab-production') {
    // loadProductionTab();
  } else if (activeTab && activeTab.id === 'tab-nuclear') {
    // loadNuclearTab();
  } else if (activeTab && activeTab.id === 'tab-ontario') {
    // loadOntarioTab();
  } else if (activeTab && activeTab.id === 'tab-exchange') {
    // loadExchangeTab();
  }
}

// Debug panel toggle
document.addEventListener('DOMContentLoaded', () => {
  const debugToggle = query('#debugToggle');
  const debugBox = query('#debug');

  if (debugToggle && debugBox) {
    debugToggle.addEventListener('click', () => {
      debugBox.classList.toggle('collapsed');
      debugBox.classList.toggle('expanded');
      debugToggle.textContent = debugBox.classList.contains('expanded') ? 'Masquer' : 'Afficher';
    });

    // Update debug info periodically
    setInterval(() => {
      const debugContent = query('#debugContent');
      if (debugContent && debugBox.classList.contains('expanded')) {
        const cacheStatus = api.cacheStatus();
        const storageStatus = StorageUtils.getAll();
        debugContent.textContent = `Cache: ${JSON.stringify(cacheStatus, null, 2)}\n\nThème: ${store.getState('theme')}\n\nDernière mise à jour: ${new Date().toLocaleString('fr-CA')}`;
      }
    }, 1000);
  }
});

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
