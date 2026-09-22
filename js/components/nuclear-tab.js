async function loadNuclearTab() {
  const tabEl = query('#tab-nuclear');
  if (!tabEl) return;

  clearChildren(tabEl);
  store.setLoading('nuclear', true);

  try {
    // Try to load nuclear data from history (for now use fallback data)
    const data = await fetchNuclearData();
    if (!data) throw new Error('No nuclear data');

    store.setState('nuclear', data);
    store.clearError('nuclear');

    const timestamp = data.timestamp || new Date().toISOString();
    const totalNuclear = data.plants.reduce((sum, p) => sum + p.current, 0);

    // Ontario KPI Card
    const kpiCard = createElement('div', { class: 'card stat-card' }, [
      createElement('div', { class: 'stat-value' }, [formatNumber(totalNuclear, 0) + ' MW']),
      createElement('div', { class: 'stat-label' }, ['Production Nucléaire (Ontario)']),
      createElement('div', { class: 'stat-time' }, [formatTime(timestamp)])
    ]);

    // Plant cards
    const plantsContainer = createElement('div', { class: 'nuclear-plants-grid' });
    data.plants.forEach(plant => {
      const capacity = plant.capacity > 0 ? plant.capacity : 1;
      const utilization = ((plant.current / capacity) * 100).toFixed(1);

      const plantCard = createElement('div', { class: 'card nuclear-plant-card', style: 'cursor: pointer;' }, [
        createElement('div', { class: 'plant-name' }, [plant.name]),
        createElement('div', { class: 'plant-capacity' }, [plant.current + ' / ' + plant.capacity + ' MW']),
        createElement('div', { class: 'plant-utilization' }, [utilization + '% utilization']),
        createElement('div', { class: 'plant-units', style: 'font-size: 12px; color: var(--text-secondary); margin-top: 8px;' }, [
          plant.units.length + ' reactor' + (plant.units.length !== 1 ? 's' : '')
        ])
      ]);

      plantCard.addEventListener('click', () => showNuclearModal(plant, data.history));
      plantsContainer.appendChild(plantCard);
    });

    tabEl.appendChild(kpiCard);
    tabEl.appendChild(plantsContainer);

  } catch (err) {
    store.setError('nuclear', err.message);
    tabEl.innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
  } finally {
    store.setLoading('nuclear', false);
  }
}

async function fetchNuclearData() {
  // Try to load from API first, fallback to default data
  try {
    const response = await api.fetch('/proxy?url=https://raw.githubusercontent.com/hydro-quebec-data/nuclear-history/main/history.json', {
      ttl: 5 * 60 * 1000
    });
    if (response && response.data) {
      return parseNuclearHistory(response.data);
    }
  } catch (err) {
    console.log('Could not load nuclear data from GitHub, using default data');
  }

  // Fallback data structure
  return {
    timestamp: new Date().toISOString(),
    plants: [
      { name: 'Bruce', current: 6400, capacity: 6400, units: ['A1', 'A2', 'B1', 'B2'] },
      { name: 'Darlington', current: 3512, capacity: 3512, units: ['1', '2', '3', '4'] },
      { name: 'Pickering', current: 4120, capacity: 4120, units: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'] },
      { name: 'Lepreau', current: 635, capacity: 635, units: ['1'] }
    ],
    history: []
  };
}

function parseNuclearHistory(historyData) {
  // Parse JSON history of nuclear generation
  const plants = {
    'Bruce': { current: 0, capacity: 6400, units: ['A1', 'A2', 'B1', 'B2'] },
    'Darlington': { current: 0, capacity: 3512, units: ['1', '2', '3', '4'] },
    'Pickering': { current: 0, capacity: 4120, units: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'] },
    'Lepreau': { current: 0, capacity: 635, units: ['1'] }
  };

  // If historyData is an array, take the latest values
  if (Array.isArray(historyData) && historyData.length > 0) {
    const latest = historyData[historyData.length - 1];
    Object.keys(plants).forEach(plantName => {
      if (latest[plantName.toLowerCase()]) {
        plants[plantName].current = latest[plantName.toLowerCase()];
      }
    });
  }

  return {
    timestamp: new Date().toISOString(),
    plants: Object.entries(plants).map(([name, data]) => ({ name, ...data })),
    history: historyData || []
  };
}

function showNuclearModal(plant, history) {
  // Create modal overlay
  const modal = createElement('div', { class: 'nuclear-modal-overlay', style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;' }, [
    createElement('div', { class: 'nuclear-modal', style: 'background: var(--bg-secondary); border-radius: 8px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;' }, [
      createElement('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;' }, [
        createElement('h3', {}, [plant.name + ' Nuclear Station']),
        createElement('button', {
          style: 'background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-primary);',
          onclick: function() { modal.remove(); }
        }, ['×'])
      ]),
      createElement('div', { class: 'plant-details' }, [
        createElement('p', { style: 'margin: 8px 0;' }, [
          createElement('strong', {}, ['Current Output:']),
          ' ' + formatNumber(plant.current, 0) + ' MW'
        ]),
        createElement('p', { style: 'margin: 8px 0;' }, [
          createElement('strong', {}, ['Total Capacity:']),
          ' ' + formatNumber(plant.capacity, 0) + ' MW'
        ]),
        createElement('p', { style: 'margin: 8px 0;' }, [
          createElement('strong', {}, ['Utilization:']),
          ' ' + ((plant.current / plant.capacity) * 100).toFixed(1) + '%'
        ]),
        createElement('div', { style: 'margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);' }, [
          createElement('h5', {}, ['Reactor Units']),
          createElement('div', { class: 'units-list', style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-top: 8px;' },
            plant.units.map(unit =>
              createElement('div', { class: 'unit-item', style: 'background: var(--bg-primary); padding: 8px; border-radius: 4px; text-align: center; font-size: 12px; border: 1px solid var(--border-color);' }, [unit])
            )
          )
        ])
      ])
    ])
  ]);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

// Auto-refresh when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadNuclearTab();
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-nuclear-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadNuclearTab);
    if (btn.classList.contains('active')) {
      loadNuclearTab();
    }
  }
});
