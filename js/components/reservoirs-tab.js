async function loadReservoirsTab() {
  console.log('🏞 loadReservoirsTab() called');
  const tabEl = query('#tab-reservoirs');
  console.log('tabEl:', tabEl);
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('reservoirs', true);

  try {
    // Fetch reservoir water levels and turbined flow data
    const reservoirsData = await api.fetch('/api/hydro-quebec/reservoirs');
    const turbinedData = await api.fetch('/api/hydro-quebec/turbined-flow');

    if (!reservoirsData || !Array.isArray(reservoirsData)) {
      throw new Error('Invalid reservoir data');
    }

    store.setState('reservoirs', { reservoirs: reservoirsData, turbined: turbinedData });
    store.clearError('reservoirs');

    // Parse reservoir data by facility
    const reservoirsByFacility = parseReservoirData(reservoirsData);

    // Create KPI cards for top reservoirs
    const topReservoirs = Object.keys(reservoirsByFacility)
      .slice(0, 5);

    const kpiContainer = createElement('div', { class: 'row g-3 mb-3' });

    topReservoirs.forEach(name => {
      const data = reservoirsByFacility[name];
      if (data && data.length > 0) {
        const latest = data[data.length - 1];
        const level = latest.valeur || 0;
        const timestamp = formatTime(latest.date || latest.split_date);

        const card = createElement('div', { class: 'col-6 col-md-3' }, [
          createElement('div', { class: 'card stat-card' }, [
            createElement('div', { class: 'stat-label' }, [name]),
            createElement('div', { class: 'stat-value' }, [formatNumber(level, 2) + ' m']),
            createElement('div', { class: 'stat-time' }, [timestamp])
          ])
        ]);
        kpiContainer.appendChild(card);
      }
    });

    // Turbined flow KPI (if available)
    if (turbinedData && Array.isArray(turbinedData) && turbinedData.length > 0) {
      const latest = turbinedData[turbinedData.length - 1];
      const flow = latest.valeur || 0;
      const timestamp = formatTime(latest.date || latest.split_date);

      const card = createElement('div', { class: 'col-6 col-md-3' }, [
        createElement('div', { class: 'card stat-card' }, [
          createElement('div', { class: 'stat-label' }, ['Débit Turbiné']),
          createElement('div', { class: 'stat-value' }, [formatNumber(flow, 0) + ' m³/s']),
          createElement('div', { class: 'stat-time' }, [timestamp])
        ])
      ]);
      kpiContainer.appendChild(card);
    }

    tabEl.appendChild(kpiContainer);

    // Water level trend chart
    const chartCard = createElement('div', { class: 'card' }, [
      createElement('div', { class: 'chart-container-tall' }, [
        createElement('h6', { style: 'padding: 0 16px; margin: 16px 0 8px;' }, [
          'Niveau d\'eau des réservoirs - 7 derniers jours'
        ]),
        createElement('canvas', { id: 'reservoirsChart' })
      ])
    ]);

    tabEl.appendChild(chartCard);

    // Render water level trend chart
    setTimeout(() => renderReservoirsChart(reservoirsByFacility), 100);

    // Turbined flow chart
    if (turbinedData && Array.isArray(turbinedData) && turbinedData.length > 1) {
      const turbinedCard = createElement('div', { class: 'card' }, [
        createElement('div', { class: 'chart-container-tall' }, [
          createElement('h6', { style: 'padding: 0 16px; margin: 16px 0 8px;' }, [
            'Débit turbiné total - 7 derniers jours'
          ]),
          createElement('canvas', { id: 'turbinedChart' })
        ])
      ]);

      tabEl.appendChild(turbinedCard);
      const turbinedByDate = parseTurbinedData(turbinedData);
      setTimeout(() => renderTurbinedChart(turbinedByDate), 150);
    }

    // Facility details grid
    const facilitiesContainer = createElement('div', { class: 'production-grid', style: 'margin-top: 20px;' });

    Object.entries(reservoirsByFacility).forEach(([facility, data]) => {
      if (data.length === 0) return;

      const latest = data[data.length - 1];
      const level = latest.valeur || 0;
      const trend = data.length > 1 ? calculateTrend(data) : 0;
      const trendColor = trend > 0 ? '#27ae60' : trend < 0 ? '#e74c3c' : '#95a5a6';

      const card = createElement('div', { class: 'card production-card' }, [
        createElement('div', { class: 'production-label' }, [facility]),
        createElement('div', { class: 'production-value' }, [formatNumber(level, 2) + ' m']),
        createElement('div', { class: 'production-percent', style: `color: ${trendColor};` }, [
          (trend > 0 ? '+' : '') + formatNumber(trend, 2) + ' m'
        ])
      ]);

      facilitiesContainer.appendChild(card);
    });

    if (Object.keys(reservoirsByFacility).length > 0) {
      tabEl.appendChild(facilitiesContainer);
    }

  } catch (err) {
    console.error('Erreur réservoirs:', err);
    store.setError('reservoirs', err.message);
    tabEl.innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
  } finally {
    store.setLoading('reservoirs', false);
  }
}

function parseReservoirData(data) {
  const result = {};

  if (!Array.isArray(data)) return result;

  data.forEach(record => {
    const facility = record.nom || 'Unknown';
    if (!result[facility]) result[facility] = [];
    result[facility].push(record);
  });

  // Sort each facility's data by date
  Object.keys(result).forEach(facility => {
    result[facility].sort((a, b) => {
      const dateA = new Date(a.date || a.split_date || 0);
      const dateB = new Date(b.date || b.split_date || 0);
      return dateA - dateB;
    });
  });

  return result;
}

function parseTurbinedData(data) {
  const result = [];

  if (!Array.isArray(data)) return result;

  // Group by date and sum values
  const byDate = {};
  data.forEach(record => {
    const date = record.date || record.split_date;
    if (!byDate[date]) {
      byDate[date] = { date, valeur: 0 };
    }
    byDate[date].valeur += parseFloat(record.valeur) || 0;
  });

  // Convert to array and sort
  return Object.values(byDate).sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateA - dateB;
  });
}

function calculateTrend(data) {
  if (data.length < 2) return 0;

  const oldValue = parseFloat(data[0].valeur) || 0;
  const newValue = parseFloat(data[data.length - 1].valeur) || 0;

  return newValue - oldValue;
}

function renderReservoirsChart(reservoirsByFacility) {
  const canvas = query('#reservoirsChart');
  if (!canvas) return;

  // Get top 5 reservoirs
  const topReservoirs = Object.keys(reservoirsByFacility).slice(0, 5);
  const labels = [];
  const datasets = [];

  topReservoirs.forEach((name, idx) => {
    const data = reservoirsByFacility[name];
    if (data && data.length > 0) {
      const sortedData = data.sort((a, b) => {
        const dateA = new Date(a.date || a.split_date || 0);
        const dateB = new Date(b.date || b.split_date || 0);
        return dateA - dateB;
      });

      if (labels.length === 0) {
        sortedData.forEach(record => {
          const date = new Date(record.date || record.split_date);
          labels.push(date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' }));
        });
      }

      const colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6'];
      datasets.push({
        label: name,
        data: sortedData.map(r => parseFloat(r.valeur) || 0),
        borderColor: colors[idx],
        backgroundColor: colors[idx] + '20',
        tension: 0.3
      });
    }
  });

  if (datasets.length === 0) return;

  window.chartManager.createOrUpdate(canvas, 'line', {
    labels,
    datasets
  }, {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
        ticks: { color: 'var(--text-primary)' }
      },
      x: {
        ticks: { color: 'var(--text-primary)' }
      }
    }
  });
}

function renderTurbinedChart(turbinedData) {
  const canvas = query('#turbinedChart');
  if (!canvas) return;

  const sortedData = turbinedData.sort((a, b) => {
    const dateA = new Date(a.date || a.split_date || 0);
    const dateB = new Date(b.date || b.split_date || 0);
    return dateA - dateB;
  });

  const labels = sortedData.map(record => {
    const date = new Date(record.date || record.split_date);
    return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit' });
  });

  window.chartManager.createOrUpdate(canvas, 'line', {
    labels,
    datasets: [{
      label: 'Débit Turbiné (m³/s)',
      data: sortedData.map(r => parseFloat(r.valeur) || 0),
      borderColor: '#2980b9',
      backgroundColor: '#2980b920',
      tension: 0.3,
      fill: true
    }]
  }, {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: 'var(--text-primary)' }
      },
      x: {
        ticks: { color: 'var(--text-primary)' }
      }
    }
  });
}

// Auto-refresh when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const activeTab = query('.tab-pane.show.active');
    if (activeTab && activeTab.id === 'tab-reservoirs') {
      loadReservoirsTab();
    }
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-reservoirs-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadReservoirsTab);
    if (btn.classList.contains('active')) {
      loadReservoirsTab();
    }
  }
});
