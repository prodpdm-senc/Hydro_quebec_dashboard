async function loadExchangeTab() {
  const tabEl = query('#tab-exchange');
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('exchange', true);

  try {
    const data = await api.getExchange();
    if (!data || !data.records) throw new Error('No exchange data');

    const records = data.records || [];
    if (records.length === 0) throw new Error('No exchange records available');

    const latest = records[records.length - 1];
    const fields = latest.fields || {};
    const timestamp = fields.date || new Date().toISOString();

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

  // Map field names to partners
  const partnerMap = {
    'importation_ontario': 'Ontario',
    'importation_manitoba': 'Manitoba',
    'importation_us_new_york': 'New York (USA)',
    'importation_us_vermont': 'Vermont (USA)',
    'importation_us_massachusetts': 'Massachusetts (USA)',
    'importation_us_other': 'USA (Autres)',
    'exportation_ontario': 'Ontario',
    'exportation_manitoba': 'Manitoba',
    'exportation_us_new_york': 'New York (USA)',
    'exportation_us_vermont': 'Vermont (USA)',
    'exportation_us_massachusetts': 'Massachusetts (USA)',
    'exportation_us_other': 'USA (Autres)'
  };

  // Extract data from fields
  Object.entries(fields).forEach(([fieldName, value]) => {
    const lowerName = fieldName.toLowerCase();
    const numValue = parseFloat(value) || 0;

    Object.entries(partnerMap).forEach(([pattern, partnerName]) => {
      if (lowerName.includes(pattern)) {
        if (!partners[partnerName]) {
          partners[partnerName] = { imports: 0, exports: 0 };
        }
        if (pattern.includes('importation')) {
          partners[partnerName].imports += numValue;
        } else {
          partners[partnerName].exports += numValue;
        }
      }
    });
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
