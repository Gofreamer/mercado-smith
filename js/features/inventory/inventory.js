/* Global Smith — Inventory & Orders */

function statusBannerHTML(status, msg, statusLabel, { withMsg = true } = {}) {
  const text = withMsg ? (msg || STATUS_MESSAGES[status] || '') : '';
  if (!statusLabel && !text) return '';
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

  items.sort((a, b) => {
    const au = a.used ? 1 : 0;
    const bu = b.used ? 1 : 0;
    if (au !== bu) return au - bu;
    return (b.boughtAt || 0) - (a.boughtAt || 0);
  });

  const active = items.filter(i => !i.used).length;
  const used = items.filter(i => i.used).length;

  list.innerHTML = `
    <div class="inv-toolbar">
      <div class="inv-toolbar-stats">
        <span><strong>${items.length}</strong> no cofre</span>
        <span class="text-muted">${active} disponíveis</span>
        ${used ? `<span class="text-muted">${used} consumidos</span>` : ''}
      </div>
      <div class="inv-toolbar-actions">
        <button class="btn btn-ghost btn-sm" onclick="toggleShowUsedInv()">
          ${state._hideUsedInv ? 'Mostrar consumidos' : 'Ocultar consumidos'}
        </button>
      </div>
    </div>
    <div class="inv-grid">
      ${items.filter(i => !(state._hideUsedInv && i.used)).map(item => {
        const status = item.status || 'delivered';
        const isTransit = status === 'in_transit' || status === 'held_customs' || status === 'resent';
        const statusLabel = isTransit ? formatDeliveryLabel(item) : '';
        const used = !!item.used;

        const img = item.image
          ? `<img class="inv-card-img" src="${escapeHTML(item.image)}" alt="" onerror="this.outerHTML='<div class=\\'inv-card-img placeholder\\'>${(item.name||'?')[0]}</div>'"/>`
          : `<div class="inv-card-img placeholder">${(item.name || '?')[0]}</div>`;

        return `
          <div class="inv-card ${item.illegal ? 'item-illegal' : ''} ${used ? 'inv-card-used' : ''}">
            <div class="inv-card-media">${img}
              ${used ? '<span class="inv-used-badge">Consumido</span>' : ''}
              ${item.illegal ? '<span class="inv-illegal-badge">Subsolo</span>' : ''}
            </div>
            <div class="inv-card-body">
              <div class="inv-card-cat">${escapeHTML(CATEGORY_LABELS[item.category] || item.category || '')}</div>
              <h4 class="inv-card-name">${escapeHTML(item.name)}</h4>
              ${isTransit ? `<span class="status-pill ${statusClass(status)}">${escapeHTML(statusLabel)}</span>` : ''}
              <div class="inv-card-meta">
                <span class="item-price">${formatMoney(item.price)}</span>
                <span class="item-date">${item.boughtAt ? formatDate(item.boughtAt) : ''}</span>
              </div>
              <div class="inv-card-actions">
                ${!used && !isTransit ? `
                  <button class="btn btn-ghost btn-sm" onclick="markInventoryUsed('${item.id}', true)">Marcar consumido</button>
                ` : ''}
                ${used ? `
                  <button class="btn btn-ghost btn-sm" onclick="markInventoryUsed('${item.id}', false)">Restaurar</button>
                  <button class="btn btn-ghost btn-sm text-danger" onclick="removeInventoryItem('${item.id}')">Remover</button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function toggleShowUsedInv() {
  state._hideUsedInv = !state._hideUsedInv;
  renderInventory();
}

async function markInventoryUsed(invKey, used) {
  if (!state.user) return;
  try {
    await db.ref(`users/${state.user.uid}/inventory/${invKey}/used`).set(!!used);
    if (used) {
      await db.ref(`users/${state.user.uid}/inventory/${invKey}/usedAt`).set(Date.now());
    } else {
      await db.ref(`users/${state.user.uid}/inventory/${invKey}/usedAt`).remove();
    }
    showToast(used ? 'Marcado como consumido/utilizado.' : 'Item restaurado no cofre.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao atualizar item.', 'error');
  }
}

async function removeInventoryItem(invKey) {
  if (!state.user) return;
  if (!confirm('Remover este item do inventário? Não devolve saldo.')) return;
  try {
    await db.ref(`users/${state.user.uid}/inventory/${invKey}`).remove();
    showToast('Item removido.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao remover.', 'error');
  }
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

  list.innerHTML = `
    <div class="orders-toolbar">
      <div class="orders-toolbar-stats">
        <span><strong>${state.orders.length}</strong> pedido(s)</span>
      </div>
      <div class="orders-toolbar-actions">
        <button class="btn btn-ghost btn-sm text-danger" onclick="clearMyOrderHistory()">Limpar histórico</button>
      </div>
    </div>
    <div class="orders-grid">
      ${state.orders.map(order => {
        const qty = order.quantity || 1;
        const unit = order.unitPrice != null ? order.unitPrice : order.price;
        const status = order.status || 'delivered';
        const statusLabel = formatDeliveryLabel(order);
        const msg = order.statusMessage || STATUS_MESSAGES[status] || '';

        const img = order.image
          ? `<img class="order-card-img" src="${escapeHTML(order.image)}" alt="" onerror="this.outerHTML='<div class=\\'order-card-img placeholder\\'>${(order.productName||'?')[0]}</div>'"/>`
          : `<div class="order-card-img placeholder">${(order.productName || '?')[0]}</div>`;

        return `
          <div class="order-card ${order.illegal ? 'item-illegal' : ''}">
            <div class="order-card-media">${img}</div>
            <div class="order-card-body">
              <div class="order-card-top">
                <div>
                  ${order.category ? `<div class="inv-card-cat">${escapeHTML(CATEGORY_LABELS[order.category] || order.category)}</div>` : ''}
                  <h4 class="order-card-name">${escapeHTML(order.productName)}${qty > 1 ? ` <span class="qty-badge">×${qty}</span>` : ''}</h4>
                  <p class="order-card-date">${formatDateTime(order.createdAt)}</p>
                </div>
                <div class="order-card-price">
                  <div class="item-price success">${formatMoney(order.price)}</div>
                  ${qty > 1 ? `<div class="item-date">${formatMoney(unit)} un.</div>` : ''}
                </div>
              </div>
              ${statusBannerHTML(status, msg, statusLabel, { withMsg: true })}
              <div class="order-card-actions">
                <button class="btn btn-ghost btn-sm text-danger" onclick="deleteMyOrder('${order.id}')">Apagar do histórico</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function deleteMyOrder(orderId) {
  if (!state.user || !orderId) return;
  if (!confirm('Apagar este pedido do histórico?\nNão remove o item do inventário nem devolve saldo.')) return;
  try {
    const order = (state.orders || []).find(o => o.id === orderId);
    if (order && order.userId && order.userId !== state.user.uid) {
      showToast('Pedido de outro usuário.', 'error');
      return;
    }
    await db.ref('orders/' + orderId).remove();
    showToast('Pedido removido do histórico.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao apagar pedido (rules?).', 'error');
  }
}

async function clearMyOrderHistory() {
  if (!state.user) return;
  const n = (state.orders || []).length;
  if (!n) return;
  if (!confirm(`Apagar todos os ${n} pedidos do seu histórico?\nInventário e saldo não mudam.`)) return;
  try {
    const updates = {};
    (state.orders || []).forEach(o => {
      if (o.id) updates['orders/' + o.id] = null;
    });
    await db.ref().update(updates);
    showToast('Histórico de pedidos limpo.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao limpar histórico.', 'error');
  }
}
