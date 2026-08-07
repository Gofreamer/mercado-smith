/* Global Smith — Inventory & Orders */

function statusBannerHTML(status, msg, statusLabel) {
  const text = msg || STATUS_MESSAGES[status] || '';
  if (!text && !statusLabel) return '';
  return `
    <div class="status-banner ${statusClass(status)}">
      <div class="status-banner-top">
        <span class="status-pill ${statusClass(status)}">${escapeHTML(statusLabel || STATUS_LABELS[status] || status)}</span>
      </div>
      ${text ? `<p class="status-msg">${escapeHTML(text)}</p>` : ''}
    </div>
  `;
}

function renderInventory() {
  const list = document.getElementById('inventory-list');
  if (!list) return;

  const inv = state.profile?.inventory || {};
  const items = Object.entries(inv).map(([id, item]) => ({ id, ...item }));

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">🎒</div>
        <h3>Cofre vazio</h3>
        <p>Nada aqui ainda. O mercado GS espera — qualidade, poder e exclusividade.</p>
        <button class="btn btn-primary" onclick="showView('market')">Entrar no Mercado</button>
      </div>
    `;
    return;
  }

  items.sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));

  list.innerHTML = items.map(item => {
    const status = item.status || 'delivered';
    const statusLabel = formatDeliveryLabel(item);
    const msg = item.statusMessage || STATUS_MESSAGES[status] || '';

    const img = item.image
      ? `<img class="inv-thumb" src="${escapeHTML(item.image)}" alt="" onerror="this.outerHTML='<div class=\\'inv-thumb placeholder\\'>${(item.name||'?')[0]}</div>'"/>`
      : `<div class="inv-thumb placeholder">${(item.name || '?')[0]}</div>`;

    return `
      <div class="inventory-item ${item.illegal ? 'item-illegal' : ''}">
        ${img}
        <div class="item-info">
          <h4>${escapeHTML(item.name)}${item.illegal ? ' <span class="tag-illegal">Subsolo</span>' : ''}</h4>
          <p>${escapeHTML(CATEGORY_LABELS[item.category] || item.category || '')}</p>
          ${statusBannerHTML(status, msg, statusLabel)}
        </div>
        <div class="item-meta">
          <div class="item-price">${formatMoney(item.price)}</div>
          <div class="item-date">${item.boughtAt ? formatDate(item.boughtAt) : ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderOrders() {
  const list = document.getElementById('orders-list');
  if (!list) return;

  if (!state.orders || state.orders.length === 0) {
    list.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">🧾</div>
        <h3>Nenhuma operação registrada</h3>
        <p>Quando o courier sair com seu pacote, o rastro aparece aqui.</p>
        <button class="btn btn-primary" onclick="showView('market')">Explorar o catálogo</button>
      </div>
    `;
    return;
  }

  list.innerHTML = state.orders.map(order => {
    const qty = order.quantity || 1;
    const unit = order.unitPrice != null ? order.unitPrice : order.price;
    const status = order.status || 'delivered';
    const statusLabel = formatDeliveryLabel(order);
    const msg = order.statusMessage || STATUS_MESSAGES[status] || '';

    const img = order.image
      ? `<img class="inv-thumb" src="${escapeHTML(order.image)}" alt="" onerror="this.outerHTML='<div class=\\'inv-thumb placeholder\\'>${(order.productName||'?')[0]}</div>'"/>`
      : `<div class="inv-thumb placeholder">${(order.productName || '?')[0]}</div>`;

    return `
      <div class="order-item ${order.illegal ? 'item-illegal' : ''}">
        ${img}
        <div class="item-info">
          <h4>${escapeHTML(order.productName)}${qty > 1 ? ` <span class="qty-badge">×${qty}</span>` : ''}</h4>
          <p>${formatDateTime(order.createdAt)}</p>
          ${order.category ? `<span class="order-cat">${escapeHTML(CATEGORY_LABELS[order.category] || order.category)}</span>` : ''}
          ${statusBannerHTML(status, msg, statusLabel)}
        </div>
        <div class="item-meta">
          <div class="item-price success">${formatMoney(order.price)}</div>
          ${qty > 1 ? `<div class="item-date">${formatMoney(unit)} un.</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}
