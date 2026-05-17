async function loadNuclearTab() {
  const tabEl = query('#tab-nuclear');
  if (!tabEl) return;

  clearChildren(tabEl);
  tabEl.innerHTML = '<div class="loading">☢️ Nuclear tab - Coming soon</div>';
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = query('#tab-nuclear-btn');
  if (btn) {
    btn.addEventListener('shown.bs.tab', loadNuclearTab);
  }
});
