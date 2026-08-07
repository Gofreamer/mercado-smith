/* Global Smith — Navigation */

function showView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Hero só no mercado
  const hero = document.getElementById('hero-banner');
  if (hero) {
    hero.classList.toggle('hidden', viewName !== 'market');
  }

  // Fecha menu mobile
  closeMobileNav();

  if (viewName === 'market') renderProducts();
  if (viewName === 'inventory') renderInventory();
  if (viewName === 'orders') renderOrders();
  if (viewName === 'profile') renderProfile();
  if (viewName === 'admin') {
    renderAdminProducts();
    renderAdminOrders();
    loadAiApiKey();
  }
}

function toggleMobileNav() {
  const nav = document.querySelector('.nav');
  const btn = document.getElementById('mobile-menu-btn');
  if (!nav) return;
  nav.classList.toggle('open');
  if (btn) btn.classList.toggle('open');
}

function closeMobileNav() {
  const nav = document.querySelector('.nav');
  const btn = document.getElementById('mobile-menu-btn');
  if (nav) nav.classList.remove('open');
  if (btn) btn.classList.remove('open');
}
