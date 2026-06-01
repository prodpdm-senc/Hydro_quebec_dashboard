async function loadExchangeTab() {
  const tabEl = query('#tab-exchange');
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('exchange', true);

  try {
    const data = await api.getExchange();

    // Handle both array and object with records property
    const records = Array.isArray(data) ? data : (data.records || []);
    if (!records || records.length === 0) throw new Error('No exchange data');

    const latest = records[records.length - 1];
    const fields = latest.fields || latest; // Latest can be object directly or have fields property
    const timestamp = fields.date || new Date().toISOString();

    // Ontario data in HQ exchange feed is often ~2 hours delayed.
    // Only include Ontario partner when we consider the data "complete".
    const recordDate = new Date(timestamp);
    const ageMinutes = (Date.now() - recordDate.getTime()) / (1000 * 60);
    const ONTARIO_MAX_AGE_MINUTES = 90; // Adjust as needed (user wants to see it only when fresh)
    const ontarioDataFresh = ageMinutes <= ONTARIO_MAX_AGE_MINUTES;

    store.setState('exchange', data);
    store.clearError('exchange');

    // Summary cards for main flows
    const totalImports = Object.keys(fields)
      .filter(k => k.includes('importation'))
      .reduce((sum, k) => sum + (parseFloat(fields[k]) || 0), 0);

    const totalExports = Object.keys(fields)
      .filter(k => k.includes('exportation'))
      .reduce((sum, k) => sum + (parseFloat(fields[k]) || 0), 0);

    const netFlow = totalExports - totalImports;

    // KPI Cards
    const importCard = createElement('div', { class: 'card stat-card' }, [
      createElement('div', { class: 'stat-value' }, [formatNumber(totalImports, 0) + ' MW']),
      createElement('div', { class: 'stat-label' }, ['Importations']),
      createElement('div', { class: 'stat-time' }, [formatTime(timestamp)])
    ]);

    const exportCard = createElement('div', { class: 'card stat-card' }, [
      createElement('div', { class: 'stat-value' }, [formatNumber(totalExports, 0) + ' MW']),
      createElement('div', { class: 'stat-label' }, ['Exportations']),
      createElement('div', { class: 'stat-time' }, [formatTime(timestamp)])
    ]);

    const netCard = createElement('div', { class: 'card stat-card' }, [
      createElement('div', { class: 'stat-value', style: netFlow > 0 ? 'color: #27ae60;' : 'color: #e74c3c;' }, [
        formatNumber(Math.abs(netFlow), 0) + ' MW'
      ]),
      createElement('div', { class: 'stat-label' }, [netFlow > 0 ? 'Solde export' : 'Solde import']),
      createElement('div', { class: 'stat-time' }, [formatTime(timestamp)])
    ]);

    // Detailed breakdown by partner
    const partnersContainer = createElement('div', { class: 'exchange-partners' });
    const partners = parseExchangePartners(fields);

    Object.entries(partners).forEach(([partner, { imports, exports }]) => {
      // Skip Ontario if its data in the HQ feed is considered stale (often ~2h late)
      if (partner === 'Ontario' && !ontarioDataFresh) {
        return;
      }

      const net = exports - imports;
      const card = createElement('div', { class: 'card exchange-partner-card' }, [
        createElement('div', { class: 'exchange-partner-name' }, [partner]),
        createElement('div', { class: 'exchange-partner-row' }, [
          createElement('span', {}, ['Import:']),
          createElement('span', { style: 'font-weight: bold;' }, [formatNumber(imports, 0) + ' MW'])
        ]),
        createElement('div', { class: 'exchange-partner-row' }, [
          createElement('span', {}, ['Export:']),
          createElement('span', { style: 'font-weight: bold;' }, [formatNumber(exports, 0) + ' MW'])
        ]),
        createElement('div', { class: 'exchange-partner-row', style: 'border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;' }, [
          createElement('span', {}, ['Solde:']),
          createElement('span', { style: `font-weight: bold; color: ${net > 0 ? '#27ae60' : '#e74c3c'};` }, [
            formatNumber(Math.abs(net), 0) + ' MW ' + (net > 0 ? '↑' : '↓')
          ])
        ])
      ]);
      partnersContainer.appendChild(card);
    });

    // Optional note when Ontario is hidden due to delay
    if (partners['Ontario'] && !ontarioDataFresh) {
      const note = createElement('div', { 
        class: 'text-muted small mt-2', 
        style: 'font-size: 0.8rem; opacity: 0.7;' 
      }, [
        '⚠️ Données Ontario en retard (environ 2h). Masquées jusqu\'\u00e0 mise à jour complète.'
      ]);
      partnersContainer.appendChild(note);
    }

    tabEl.appendChild(importCard);
    tabEl.appendChild(exportCard);
    tabEl.appendChild(netCard);
    tabEl.appendChild(partnersContainer);

  } catch (err) {
    store.setError('exchange', err.message);
    tabEl.innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
  } finally {
    store.setLoading('exchange', false);
  }
}

function parseExchangePartners(fields) {
  const partners = {};

  // Parse API field names: exportations_ontario, importations_sources_newyork_total, etc.
  Object.entries(fields).forEach(([fieldName, value]) => {
    const numValue = parseFloat(value) || 0;
    if (numValue === 0 && value !== 0) return; // Skip null/undefined values

    // Extract partner from field names like "exportations_ontario" or "importations_sources_newyork_total"
    let partner = null;

    if (fieldName.includes('exportations_ontario')) partner = 'Ontario';
    else if (fieldName.includes('importations_sources_ontario')) partner = 'Ontario';
    else if (fieldName.includes('exportations_newbrunswick')) partner = 'New Brunswick';
    else if (fieldName.includes('importations_sources_newbrunswick')) partner = 'New Brunswick';
    else if (fieldName.includes('exportations_newyork')) partner = 'New York (USA)';
    else if (fieldName.includes('importations_sources_newyork')) partner = 'New York (USA)';
    else if (fieldName.includes('exportations_newengland')) partner = 'New England (USA)';
    else if (fieldName.includes('importations_sources_newengland')) partner = 'New England (USA)';

    if (partner) {
      if (!partners[partner]) {
        partners[partner] = { imports: 0, exports: 0 };
      }
      if (fieldName.includes('exportations')) {
        partners[partner].exports += numValue;
      } else if (fieldName.includes('importations')) {
        partners[partner].imports += numValue;
      }
    }
  });

  return partners;
}

// Auto-refresh when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadExchangeTab();
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-exchange-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadExchangeTab);
    if (btn.classList.contains('active')) {
      loadExchangeTab();
    }
  }
});