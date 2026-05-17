async function loadCanadaTab() {
  const tabEl = query('#tab-canada');
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('canada', true);

  try {
    // Get production data for Canadian analysis
    const prodData = await api.getProduction();
    const ontData = await api.getOntarioData();

    if (!prodData) throw new Error('No production data');

    store.setState('canada', { production: prodData, ontario: ontData });
    store.clearError('canada');

    const timestamp = new Date().toISOString();

    // KPI Cards
    const kpiRow = createElement('div', { class: 'row g-3 mb-3' }, [
      createElement('div', { class: 'col-6 col-md-3' }, [
        createElement('div', { class: 'card stat-card' }, [
          createElement('div', { class: 'stat-label' }, ['Capacité Canada']),
          createElement('div', { class: 'stat-value' }, ['141 GW']),
          createElement('div', { class: 'stat-time' }, ['installée (10 provinces)'])
        ])
      ]),
      createElement('div', { class: 'col-6 col-md-3' }, [
        createElement('div', { class: 'card stat-card' }, [
          createElement('div', { class: 'stat-label' }, ['Électricité propre moy.']),
          createElement('div', { class: 'stat-value' }, ['76 %']),
          createElement('div', { class: 'stat-time' }, ['hydro · éolien · solaire · nucl.'])
        ])
      ]),
      createElement('div', { class: 'col-6 col-md-3' }, [
        createElement('div', { class: 'card stat-card' }, [
          createElement('div', { class: 'stat-label' }, ['Québec (en direct)']),
          createElement('div', { class: 'stat-value' }, ['--']),
          createElement('div', { class: 'stat-time' }, ['MW'])
        ])
      ]),
      createElement('div', { class: 'col-6 col-md-3' }, [
        createElement('div', { class: 'card stat-card' }, [
          createElement('div', { class: 'stat-label' }, ['Ontario (en direct)']),
          createElement('div', { class: 'stat-value' }, ['--']),
          createElement('div', { class: 'stat-time' }, ['MW'])
        ])
      ])
    ]);

    // Chart container
    const chartCard = createElement('div', { class: 'card' }, [
      createElement('div', { class: 'chart-container-tall' }, [
        createElement('h6', { style: 'padding: 0 16px; margin: 16px 0 8px;' }, ['Part d\'électricité propre par province (%)']),
        createElement('canvas', { id: 'canadaCleanChart' })
      ])
    ]);

    // Province grid placeholder
    const provinceGrid = createElement('div', { id: 'provinceGrid', class: 'province-grid' });

    tabEl.appendChild(kpiRow);
    tabEl.appendChild(chartCard);
    tabEl.appendChild(provinceGrid);

    // Render chart
    setTimeout(() => renderCanadaChart(), 100);

  } catch (err) {
    store.setError('canada', err.message);
    tabEl.innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
  } finally {
    store.setLoading('canada', false);
  }
}

function renderCanadaChart() {
  const canvas = query('#canadaCleanChart');
  if (!canvas) return;

  // Provincial clean energy percentages
  const provinces = [
    { name: 'BC', clean: 94 },
    { name: 'AB', clean: 42 },
    { name: 'SK', clean: 47 },
    { name: 'MB', clean: 98 },
    { name: 'ON', clean: 82 },
    { name: 'QC', clean: 99 },
    { name: 'NB', clean: 66 },
    { name: 'NS', clean: 42 },
    { name: 'PE', clean: 61 },
    { name: 'NL', clean: 98 }
  ];

  const labels = provinces.map(p => p.name);
  const data = provinces.map(p => p.clean);

  window.chartManager.createOrUpdate(canvas, 'bar', {
    labels,
    datasets: [{
      label: '% Électricité propre',
      data,
      backgroundColor: 'rgba(46, 139, 106, 0.7)',
      borderColor: '#2e8b6a',
      borderWidth: 1
    }]
  }, {
    animate: false,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: { color: 'var(--text-primary)' }
      }
    }
  });
}

// Auto-refresh when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const activeTab = query('.tab-pane.show.active');
    if (activeTab && activeTab.id === 'tab-canada') {
      loadCanadaTab();
    }
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-canada-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadCanadaTab);
    if (btn.classList.contains('active')) {
      loadCanadaTab();
    }
  }
});
