async function loadExchangeTab() {
  const tabEl = query('#tab-exchange');
  if (!tabEl) return;

  clearChildren(tabEl);
  tabEl.innerHTML = '<div class="loading">🔄 Exchange tab - Coming soon</div>';
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-exchange-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadExchangeTab);
  }
});
