function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined) return '--';
  return new Intl.NumberFormat('fr-CA', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  }).format(num);
}

function formatDate(date) {
  if (!date) return '--';
  const d = new Date(date);
  return d.toLocaleDateString('fr-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(date) {
  if (!date) return '--:--';
  const d = new Date(date);
  return d.toLocaleTimeString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatPercent(val, total, decimals = 1) {
  if (total === 0) return '0%';
  return ((val / total) * 100).toFixed(decimals) + '%';
}

function formatCapacityFactor(production, capacity) {
  if (capacity === 0) return '--';
  return formatPercent(production, capacity, 1);
}

function formatMW(mw) {
  if (mw === null || mw === undefined) return '--';
  return formatNumber(mw, 0) + ' MW';
}
