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

  console.log('[ProductionMix] Rendering stacked chart with sources:', sourceMap.map(s => s.label));

  // Extract sources for stacked mix (harmonized with Ontario "stacked shaded" style)
  // Map possible API field names to nice labels
  const sourceMap = [
    { key: 'hydraulique', label: 'Hydraulique', color: { border: '#1e88e5', bg: 'rgba(30, 136, 229, 0.75)' } },
    { key: 'eolien',      label: 'Éolien',      color: { border: '#8e24aa', bg: 'rgba(142, 36, 170, 0.7)' } },
    { key: 'solaire',     label: 'Solaire',     color: { border: '#fb8c00', bg: 'rgba(251, 140, 0, 0.7)' } },
    { key: 'thermique',   label: 'Thermique',   color: { border: '#e53935', bg: 'rgba(229, 57, 53, 0.65)' } },
    { key: 'autres',      label: 'Autres',      color: { border: '#546e7a', bg: 'rgba(84, 110, 122, 0.6)' } }
  ];

  // Order from bottom to top for nicer visual stacking (largest base first)
  const orderedSourceMap = [...sourceMap].reverse();

  const datasets = orderedSourceMap.map(({ key, label, color }) => ({
    label,
    data: last7Days.map(d => {
      const v = d.valeurs || {};
      return v[key] ?? v[key + '_total'] ?? 0;
    }),
    borderColor: color.border,
    backgroundColor: color.bg,
    fill: 'stack',           // Stacked shaded curves
    tension: 0.35,
    borderWidth: 1.2,
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