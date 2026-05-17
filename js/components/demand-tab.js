async function loadDemandTab() {
  const tabEl = query('#tab-demande');
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('demande', true);

  try {
    const data = await api.getDemande();
    if (!data || !data.details) throw new Error('No demand data');

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
    const demande = latest.valeurs?.demandeTotal || 0;
    const timestamp = latest.date || new Date().toISOString();

    store.setState('demande', data);
    store.clearError('demande');

    // KPI Card
    const kpiCard = createElement('div', { class: 'card stat-card' }, [
      createElement('div', { class: 'stat-value' }, [formatNumber(demande, 0) + ' MW']),
      createElement('div', { class: 'stat-label' }, ['Demande actuelle']),
      createElement('div', { class: 'stat-time' }, [formatTime(timestamp)])
    ]);

    // Chart
    const chartCard = createElement('div', { class: 'card' }, [
      createElement('div', { class: 'chart-container' }, [
        createElement('h6', { style: 'padding: 0 16px; margin: 16px 0 8px;' }, ['Demande - 7 derniers jours']),
        createElement('canvas', { id: 'demandChart' })
      ])
    ]);

    tabEl.appendChild(kpiCard);
    tabEl.appendChild(chartCard);

    // Render chart
    setTimeout(() => renderDemandChart(data), 100);

  } catch (err) {
    store.setError('demande', err.message);
    tabEl.innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
  } finally {
    store.setLoading('demande', false);
  }
}

function renderDemandChart(data) {
  const canvas = query('#demandChart');
  if (!canvas) return;

  const details = data.details || [];
  const last7Days = details.slice(-336); // 7 days * 48 intervals (15-min resolution)
  const labels = last7Days.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
  });

  const demandValues = last7Days.map(d => d.valeurs?.demandeTotal || 0);

  window.chartManager.createOrUpdate(canvas, 'line', {
    labels,
    datasets: [{
      label: 'Demande (MW)',
      data: demandValues,
      borderColor: '#4a7fa5',
      backgroundColor: 'rgba(74, 127, 165, 0.1)',
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
    loadDemandTab();
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-demande-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadDemandTab);
    if (btn.classList.contains('active')) {
      loadDemandTab();
    }
  }
});
