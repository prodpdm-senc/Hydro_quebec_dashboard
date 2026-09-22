class ChartManager {
  constructor() {
    this.charts = new Map();
  }

  createOrUpdate(canvasEl, type, data, options = {}) {
    const ctx = canvasEl.getContext('2d');
    const id = canvasEl.id;

    // Merge default options
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: options.animate !== false ? 300 : 0
      },
      plugins: {
        legend: {
          display: options.showLegend !== false,
          position: 'bottom'
        }
      },
      ...options
    };

    if (this.charts.has(id)) {
      // Update existing chart
      const chart = this.charts.get(id);
      chart.data = data;
      chart.options = { ...chart.options, ...chartOptions };
      chart.update('none');
      return chart;
    }

    // Create new chart only once
    const chart = new Chart(ctx, {
      type,
      data,
      options: chartOptions
    });

    this.charts.set(id, chart);
    return chart;
  }

  update(canvasId, data, options = {}) {
    if (this.charts.has(canvasId)) {
      const chart = this.charts.get(canvasId);
      chart.data = data;
      if (options.options) {
        chart.options = { ...chart.options, ...options.options };
      }
      chart.update(options.animate === false ? 'none' : 'active');
      return chart;
    }
    return null;
  }

  destroy(canvasId) {
    if (this.charts.has(canvasId)) {
      const chart = this.charts.get(canvasId);
      chart.destroy();
      this.charts.delete(canvasId);
    }
  }

  destroyAll() {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
  }

  has(canvasId) {
    return this.charts.has(canvasId);
  }

  get(canvasId) {
    return this.charts.get(canvasId);
  }

  getAll() {
    return Array.from(this.charts.values());
  }
}

window.chartManager = new ChartManager();
