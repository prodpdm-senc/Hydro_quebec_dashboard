async function loadOntarioTab() {
  const tabEl = query('#tab-ontario');
  if (!tabEl) return;

  clearChildren(tabEl);
  tabEl.innerHTML = '<div class="loading">🇨🇦 Ontario tab - Coming soon</div>';
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-ontario-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadOntarioTab);
  }
});
