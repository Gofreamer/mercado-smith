/* Global Smith — Navigation */

function showView(viewName) {
  state.currentView = viewName;

  // Esconde todas as views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

  // Mostra a view pedida
  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.remove('hidden');

  // Atualiza nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Render específico
  if (viewName === 'market') renderProducts();
  if (viewName === 'inventory') renderInventory();
  if (viewName === 'orders') renderOrders();
  if (viewName === 'profile') renderProfile();
}
