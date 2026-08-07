/* Global Smith — Admin */

function getCategoryOptions(selected) {
  return Object.entries(CATEGORY_LABELS).map(([k, v]) =>
    `<option value="${k}" ${selected === k ? 'selected' : ''}>${v}</option>`
  ).join('');
}

/* ---------- PRODUTOS ---------- */

function renderAdminProducts() {
  const el = document.getElementById('admin-products-list');
  if (!el) return;

  const products = Object.entries(state.products)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (products.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhum produto cadastrado.</div>';
    return;
  }

  el.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Entrega</th>
            <th>Categoria</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const stock = (p.stock === null || p.stock === undefined) ? '∞' : p.stock;
            const delivery = p.deliveryDays > 0 ? `${p.deliveryDays}d` : 'Imediata';
            return `
              <tr>
                <td>
                  <div class="admin-prod-name">${escapeHTML(p.name)}</div>
                  <div class="admin-prod-desc">${escapeHTML((p.description || '').slice(0, 60))}</div>
                </td>
                <td class="mono">${formatMoney(p.price)}</td>
                <td class="mono">${stock}</td>
                <td>${delivery}</td>
                <td>${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</td>
                <td class="admin-actions-cell">
                  <button class="btn btn-ghost btn-sm" onclick="adminEditProduct('${p.id}')">Editar</button>
                  <button class="btn btn-ghost btn-sm text-danger" onclick="adminDeleteProduct('${p.id}')">Apagar</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function adminResetProductForm() {
  state.editingProductId = null;
  const form = document.getElementById('admin-product-form');
  if (form) form.reset();
  const title = document.getElementById('admin-product-form-title');
  if (title) title.textContent = 'Adicionar Produto';
  const btn = document.getElementById('admin-product-submit');
  if (btn) btn.textContent = 'Adicionar Produto';
  const cancel = document.getElementById('admin-product-cancel');
  if (cancel) cancel.classList.add('hidden');
}

function adminEditProduct(id) {
  const p = state.products[id];
  if (!p) return;

  state.editingProductId = id;
  document.getElementById('admin-product-name').value = p.name || '';
  document.getElementById('admin-product-desc').value = p.description || '';
  document.getElementById('admin-product-price').value = p.price ?? '';
  document.getElementById('admin-product-category').value = p.category || 'equipamentos';
  document.getElementById('admin-product-image').value = p.image || '';
  document.getElementById('admin-product-stock').value =
    (p.stock === null || p.stock === undefined) ? '' : p.stock;
  document.getElementById('admin-product-delivery').value =
    p.deliveryDays > 0 ? p.deliveryDays : 0;

  document.getElementById('admin-product-form-title').textContent = 'Editar Produto';
  document.getElementById('admin-product-submit').textContent = 'Salvar alterações';
  document.getElementById('admin-product-cancel')?.classList.remove('hidden');

  document.getElementById('admin-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function adminSaveProduct(e) {
  e.preventDefault();

  const name = document.getElementById('admin-product-name').value.trim();
  const description = document.getElementById('admin-product-desc').value.trim();
  const price = parseFloat(document.getElementById('admin-product-price').value);
  const category = document.getElementById('admin-product-category').value;
  const image = document.getElementById('admin-product-image').value.trim();
  const stockRaw = document.getElementById('admin-product-stock').value;
  const deliveryDays = parseInt(document.getElementById('admin-product-delivery').value, 10) || 0;

  if (!name || isNaN(price)) {
    showToast('Preencha nome e preço corretamente.', 'error');
    return;
  }

  const product = {
    name,
    description,
    price,
    category,
    image: image || '',
    stock: stockRaw === '' ? null : parseInt(stockRaw, 10),
    deliveryDays: deliveryDays > 0 ? deliveryDays : 0,
    createdAt: state.editingProductId
      ? (state.products[state.editingProductId]?.createdAt || Date.now())
      : Date.now(),
    updatedAt: Date.now()
  };

  try {
    if (state.editingProductId) {
      await db.ref('products/' + state.editingProductId).update(product);
      showToast('Produto atualizado!');
    } else {
      await db.ref('products').push(product);
      showToast('Produto adicionado!');
    }
    adminResetProductForm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar produto.', 'error');
  }
}

async function adminDeleteProduct(id) {
  const p = state.products[id];
  if (!p) return;
  if (!confirm(`Apagar "${p.name}"?\nEssa ação não pode ser desfeita.`)) return;

  try {
    await db.ref('products/' + id).remove();
    showToast('Produto removido.');
    if (state.editingProductId === id) adminResetProductForm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao apagar produto.', 'error');
  }
}

/* ---------- PEDIDOS (admin) ---------- */

function renderAdminOrders() {
  const el = document.getElementById('admin-orders-list');
  if (!el) return;

  const orders = state.allOrders || [];
  if (orders.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhum pedido no sistema.</div>';
    return;
  }

  el.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Jogador</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Previsão</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => {
            const status = o.status || 'delivered';
            const statusClass = status === 'delivered' ? 'status-delivered' : 'status-transit';
            return `
              <tr>
                <td>
                  <div class="admin-prod-name">${escapeHTML(o.productName)}${(o.quantity || 1) > 1 ? ` ×${o.quantity}` : ''}</div>
                  <div class="admin-prod-desc">${formatDateTime(o.createdAt)}</div>
                </td>
                <td>${escapeHTML(o.userName || o.userId || '—')}</td>
                <td class="mono">${formatMoney(o.price)}</td>
                <td><span class="status-pill ${statusClass}">${STATUS_LABELS[status] || status}</span></td>
                <td>${o.estimatedDelivery ? formatDate(o.estimatedDelivery) : '—'}</td>
                <td class="admin-actions-cell">
                  ${status !== 'delivered'
                    ? `<button class="btn btn-primary btn-sm" onclick="adminMarkDelivered('${o.id}')">Marcar entregue</button>`
                    : `<span class="text-muted" style="font-size:12px">OK</span>`
                  }
                  <button class="btn btn-ghost btn-sm" onclick="adminEditOrderDelivery('${o.id}')">Data</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function adminMarkDelivered(orderId) {
  const order = state.allOrders.find(o => o.id === orderId);
  if (!order) return;
  if (!confirm(`Marcar "${order.productName}" como entregue para ${order.userName}?`)) return;

  const now = Date.now();
  const updates = {};
  updates[`orders/${orderId}/status`] = 'delivered';
  updates[`orders/${orderId}/deliveredAt`] = now;

  // Atualiza itens do inventário correspondentes (mesmo produto, ainda em trânsito)
  try {
    const invSnap = await db.ref(`users/${order.userId}/inventory`).once('value');
    const inv = invSnap.val() || {};
    Object.entries(inv).forEach(([key, item]) => {
      if (item.productId === order.productId && item.status === 'in_transit') {
        updates[`users/${order.userId}/inventory/${key}/status`] = 'delivered';
        updates[`users/${order.userId}/inventory/${key}/deliveredAt`] = now;
      }
    });

    await db.ref().update(updates);
    showToast('Pedido marcado como entregue!');
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar status.', 'error');
  }
}

async function adminEditOrderDelivery(orderId) {
  const order = state.allOrders.find(o => o.id === orderId);
  if (!order) return;

  const current = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toISOString().slice(0, 10)
    : '';

  const input = prompt('Nova data de previsão (AAAA-MM-DD):', current);
  if (input === null) return;

  const ts = Date.parse(input + 'T12:00:00');
  if (isNaN(ts)) {
    showToast('Data inválida.', 'error');
    return;
  }

  try {
    const updates = {};
    updates[`orders/${orderId}/estimatedDelivery`] = ts;
    if (order.status === 'delivered') {
      // se já entregue, só muda a data; senão mantém em trânsito
    } else {
      updates[`orders/${orderId}/status`] = 'in_transit';
    }

    // espelha no inventário em trânsito do mesmo produto
    const invSnap = await db.ref(`users/${order.userId}/inventory`).once('value');
    const inv = invSnap.val() || {};
    Object.entries(inv).forEach(([key, item]) => {
      if (item.productId === order.productId && item.status !== 'delivered') {
        updates[`users/${order.userId}/inventory/${key}/estimatedDelivery`] = ts;
        updates[`users/${order.userId}/inventory/${key}/status`] = 'in_transit';
      }
    });

    await db.ref().update(updates);
    showToast('Previsão atualizada!');
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar data.', 'error');
  }
}

/* ---------- SALDO ---------- */

async function adminAdjustBalance(e) {
  e.preventDefault();

  const input = document.getElementById('admin-user-id').value.trim();
  const newBalance = parseFloat(document.getElementById('admin-new-balance').value);

  if (isNaN(newBalance)) {
    showToast('Saldo inválido.', 'error');
    return;
  }

  try {
    let uid = input;

    if (input.includes('@')) {
      const snap = await db.ref('users').orderByChild('email').equalTo(input).once('value');
      const users = snap.val();
      if (!users) {
        showToast('Usuário não encontrado.', 'error');
        return;
      }
      uid = Object.keys(users)[0];
    }

    await db.ref(`users/${uid}/balance`).set(newBalance);
    showToast('Saldo atualizado!');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar saldo.', 'error');
  }
}

// Compat: formulário antigo apontava para adminAddProduct
async function adminAddProduct(e) {
  return adminSaveProduct(e);
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('admin-tab-' + tab)?.classList.remove('hidden');
  if (btn) btn.classList.add('active');
  if (tab === 'products') renderAdminProducts();
  if (tab === 'orders') renderAdminOrders();
}
