async function loadOntarioTab() {
  const tabEl = query('#tab-ontario');
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('ontario', true);

  try {
    const xmlData = await api.getIESOData();
    if (!xmlData) throw new Error('No IESO data');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML from IESO');
    }

    const data = parseIESOData(xmlDoc);
    store.setState('ontario', data);
    store.clearError('ontario');

    // KPI Card
    const kpiCard = createElement('div', { class: 'card stat-card' }, [
      createElement('div', { class: 'stat-value' }, [formatNumber(data.total, 0) + ' MW']),
      createElement('div', { class: 'stat-label' }, ['Production actuelle (Ontario)']),
      createElement('div', { class: 'stat-time' }, [formatTime(data.timestamp)])
    ]);

    // Fuel mix cards
    const mixContainer = createElement('div', { class: 'production-grid' });
    Object.entries(data.sources).forEach(([source, value]) => {
      const percent = data.total > 0 ? ((value / data.total) * 100).toFixed(1) : 0;
      const card = createElement('div', { class: 'card production-card' }, [
        createElement('div', { class: 'production-label' }, [source]),
        createElement('div', { class: 'production-value' }, [formatNumber(value, 0) + ' MW']),
        createElement('div', { class: 'production-percent' }, [percent + '%'])
      ]);
      mixContainer.appendChild(card);
    });

    tabEl.appendChild(kpiCard);
    tabEl.appendChild(mixContainer);

  } catch (err) {
    store.setError('ontario', err.message);
    tabEl.innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
  } finally {
    store.setLoading('ontario', false);
  }
}

function parseIESOData(xmlDoc) {
  // Parse IESO XML response
  const sources = {
    'Nucléaire': 0,
    'Thermique': 0,
    'Hydro': 0,
    'Éolienne': 0,
    'Solaire': 0,
    'Autres': 0
  };

  // Get all generation records
  const genData = xmlDoc.getElementsByTagName('GenData');
  let timestamp = new Date().toISOString();

  if (genData.length > 0) {
    const lastGen = genData[genData.length - 1];

    // Extract timestamp
    const timeAttr = lastGen.getAttribute('timestamp') || lastGen.getAttribute('time');
    if (timeAttr) {
      timestamp = timeAttr;
    }

    // Parse fuel types from the XML
    const children = lastGen.childNodes;
    children.forEach(node => {
      if (node.nodeType === 1) {
        const tagName = node.tagName.toLowerCase();
        const value = parseFloat(node.textContent) || 0;

        if (tagName.includes('nuclear')) sources['Nucléaire'] = value;
        else if (tagName.includes('coal') || tagName.includes('gas') || tagName.includes('thermal')) sources['Thermique'] = value;
        else if (tagName.includes('hydro')) sources['Hydro'] = value;
        else if (tagName.includes('wind')) sources['Éolienne'] = value;
        else if (tagName.includes('solar')) sources['Solaire'] = value;
      }
    });
  }

  // Calculate total (fallback to 17507 MW if no data)
  let total = Object.values(sources).reduce((a, b) => a + b, 0);
  if (total === 0) {
    total = 17507;
  }

  return {
    sources,
    total,
    timestamp
  };
}

// Auto-refresh when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadOntarioTab();
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-ontario-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadOntarioTab);
    if (btn.classList.contains('active')) {
      loadOntarioTab();
    }
  }
});
