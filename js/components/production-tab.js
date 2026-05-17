async function loadProductionTab() {
  const tabEl = query('#tab-production');
  if (!tabEl) return;

  clearChildren(tabEl);
  tabEl.innerHTML = '<div class="loading">📊 Production tab - Coming soon</div>';
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-production-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadProductionTab);
  }
});
