async function loadProductionTab() {
  const tabEl = query('#tab-production');
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('production', true);

  try {
    const data = await api.getProduction();
    if (!data || !data.details) throw new Error('No production data');

    const details = data.details || [];
    // Find latest record with actual data (some recent records may be empty)
    let latest = {};
    for (let i = details.length - 1; i >= 0; i--) {
      if (details[i].valeurs && Object.keys(details[i].valeurs).length > 0) {
        latest = details[i];
        break;
      }
    }
    if (Object.keys(latest).length === 0) {
      latest = details[details.length - 1] || {};
    }
    const timestamp = latest.date || new Date().toISOString();

    store.setState('production', data);
    store.clearError('production');

    // Get total production
    const valeurs = latest.valeurs || {};
    const total = valeurs.total || 0;

    // KPI Card
    const kpiCard = createElement('div', { class: 'card stat-card' }, [
      createElement('div', { class: 'stat-value' }, [formatNumber(total, 0) + ' MW']),
      createElement('div', { class: 'stat-label' }, ['Production totale']),
      createElement('div', { class: 'stat-time' }, [formatTime(timestamp)])
    ]);

    // Chart
    const chartCard = createElement('div', { class: 'card' }, [
      createElement('div', { class: 'chart-container' }, [
        createElement('h6', { style: 'padding: 0 16px; margin: 16px 0 8px;' }, ['Mix énergétique - 7 derniers jours']),
        createElement('canvas', { id: 'productionChart' })
      ])
    ]);

    tabEl.appendChild(kpiCard);
    tabEl.appendChild(chartCard);

    // Render chart
    setTimeout(() => renderProductionChart(data), 100);

  } catch (err) {
    store.setError('production', err.message);
    tabEl.innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
  } finally {
    store.setLoading('production', false);
  }
}

function renderProductionChart(data) {
  const canvas = query('#productionChart');
  if (!canvas) return;

  const details = data.details || [];
  const last7Days = details.slice(-336);

  const labels = last7Days.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
  });

  // Extract sources for stacked mix (harmonized with Ontario "stacked shaded" style)
  // Map possible API field names to nice labels
  const sourceMap = [
    { key: 'hydraulique', label: 'Hydraulique', color: { border: '#2E86AB', bg: 'rgba(46, 134, 171, 0.65)' } },
    { key: 'eolien',      label: 'Éolien',      color: { border: '#A23B72', bg: 'rgba(162, 59, 114, 0.65)' } },
    { key: 'solaire',     label: 'Solaire',     color: { border: '#F18F01', bg: 'rgba(241, 143, 1, 0.65)' } },
    { key: 'thermique',   label: 'Thermique',   color: { border: '#C73E1D', bg: 'rgba(199, 62, 29, 0.65)' } },
    { key: 'autres',      label: 'Autres',      color: { border: '#6C757D', bg: 'rgba(108, 117, 125, 0.55)' } }
  ];

  const datasets = sourceMap.map(({ key, label, color }) => ({
    label,
    data: last7Days.map(d => {
      const v = d.valeurs || {};
      return v[key] ?? v[key + '_total'] ?? 0;
    }),
    borderColor: color.border,
    backgroundColor: color.bg,
    fill: 'stack',
    tension: 0.4,
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 4
  }));

  window.chartManager.createOrUpdate(canvas, 'line', {
    labels,
    datasets
  }, {
    animate: false,
    scales: {
      x: {
        stacked: true
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: 'var(--text-primary)' }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true }
      }
    }
  });
}

// Auto-refresh when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadProductionTab();
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-production-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadProductionTab);
    if (btn.classList.contains('active')) {
      loadProductionTab();
    }
  }
});