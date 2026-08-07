/* Global Smith — Navigation */

function showView(viewName) {
  // gate black market
  if (viewName === 'blackmarket' && !hasBlackMarketAccess()) {
    showToast('Acesso ao Subsolo negado.', 'error');
    viewName = 'market';
  }

  state.currentView = viewName;

  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Theme swap for black market
  document.body.classList.toggle('theme-blackmarket', viewName === 'blackmarket');

  const hero = document.getElementById('hero-banner');
  if (hero) {
    hero.classList.toggle('hidden', viewName !== 'market');
  }

  closeMobileNav();

  if (viewName === 'market') renderProducts();
  if (viewName === 'blackmarket') renderBlackMarket();
  if (viewName === 'inventory') renderInventory();
  if (viewName === 'orders') renderOrders();
  if (viewName === 'profile') renderProfile();
  if (viewName === 'wishlist') renderWishlist();
  if (viewName === 'admin') {
    renderAdminProducts();
    renderAdminOrders();
    if (typeof renderAdminCoupons === 'function') renderAdminCoupons();
    if (typeof renderAdminOffers === 'function') renderAdminOffers();
    if (typeof renderAdminEvents === 'function') renderAdminEvents();
    if (typeof renderAdminLog === 'function') renderAdminLog();
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
