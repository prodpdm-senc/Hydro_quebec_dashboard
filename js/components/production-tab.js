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
        createElement('h6', { style: 'padding: 0 16px; margin: 16px 0 8px;' }, ['Production - 7 derniers jours']),
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

  window.chartManager.createOrUpdate(canvas, 'line', {
    labels,
    datasets: [{
      label: 'Production (MW)',
      data: last7Days.map(d => d.valeurs?.total || 0),
      borderColor: '#f39c12',
      backgroundColor: 'rgba(243, 156, 18, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6
    }]
  }, {
    animate: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: 'var(--text-primary)' }
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
