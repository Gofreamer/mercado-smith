/* Global Smith — Inventory & Orders */

function renderInventory() {
  const list = document.getElementById('inventory-list');
  const inv = state.profile?.inventory || {};
  const items = Object.entries(inv).map(([id, item]) => ({ id, ...item }));

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Seu inventário está vazio.</div>';
    return;
  }

  // Ordena do mais recente
  items.sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));

  list.innerHTML = items.map(item => `
    <div class="inventory-item">
      <div class="item-info">
        <h4>${escapeHTML(item.name)}</h4>
        <p>${escapeHTML(CATEGORY_LABELS[item.category] || item.category || '')}</p>
      </div>
      <div class="item-meta">
        <div>${formatMoney(item.price)}</div>
        <div>${item.boughtAt ? new Date(item.boughtAt).toLocaleDateString('pt-BR') : ''}</div>
      </div>
    </div>
  `).join('');
}

function renderOrders() {
  const list = document.getElementById('orders-list');

  if (!state.orders || state.orders.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhum pedido ainda.</div>';
    return;
  }

  list.innerHTML = state.orders.map(order => `
    <div class="order-item">
      <div class="item-info">
        <h4>${escapeHTML(order.productName)}</h4>
        <p>${order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : ''}</p>
      </div>
      <div class="item-meta">
        <div style="color: var(--success); font-weight: 600">${formatMoney(order.price)}</div>
      </div>
    </div>
  `).join('');
}
