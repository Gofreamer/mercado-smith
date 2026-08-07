/* Global Smith — Database Service */

function listenUserProfile(uid) {
  db.ref('users/' + uid).on('value', (snap) => {
    state.profile = snap.val() || null;
    updateBalanceUI();
    updateAdminVisibility();
    if (state.currentView === 'inventory') renderInventory();
    if (state.currentView === 'profile') renderProfile();
  });
}

function listenProducts() {
  db.ref('products').on('value', (snap) => {
    state.products = snap.val() || {};
    if (state.currentView === 'market') renderProducts();
    if (state.currentView === 'admin') renderAdminProducts();
    if (state.cartOpen) renderCart();
  });
}

function listenOrders(uid) {
  db.ref('orders').orderByChild('userId').equalTo(uid).on('value', (snap) => {
    const data = snap.val() || {};
    state.orders = Object.entries(data)
      .map(([id, order]) => ({ id, ...order }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'orders') renderOrders();
  });
}

function listenAllOrders() {
  // Só faz sentido para admin; escuta todos
  db.ref('orders').on('value', (snap) => {
    const data = snap.val() || {};
    state.allOrders = Object.entries(data)
      .map(([id, order]) => ({ id, ...order }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'admin') renderAdminOrders();
  });
}

function computeDelivery(product) {
  const days = Number(product.deliveryDays);
  if (!days || days <= 0) {
    return {
      status: 'delivered',
      estimatedDelivery: Date.now(),
      deliveredAt: Date.now()
    };
  }
  const eta = Date.now() + days * 24 * 60 * 60 * 1000;
  return {
    status: 'in_transit',
    estimatedDelivery: eta,
    deliveredAt: null
  };
}

/** Compra rápida (1 unidade) com confirmação */
async function buyProduct(productId) {
  const product = state.products[productId];
  if (!product) {
    showToast('Produto não encontrado.', 'error');
    return;
  }
  if (!state.profile) {
    showToast('Perfil não carregado.', 'error');
    return;
  }

  const price = Number(product.price) || 0;
  const balance = Number(state.profile.balance) || 0;

  if (balance < price) {
    showToast('Saldo insuficiente.', 'error');
    return;
  }
  if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
    showToast('Produto esgotado.', 'error');
    return;
  }

  const deliveryInfo = product.deliveryDays > 0
    ? `Chega em ~${product.deliveryDays} dia(s).`
    : 'Entrega imediata.';

  const ok = confirm(
    `Confirmar compra?\n\n` +
    `${product.name}\n` +
    `Preço: ${formatMoney(price)}\n` +
    `Saldo após: ${formatMoney(balance - price)}\n` +
    `${deliveryInfo}`
  );
  if (!ok) return;

  await executePurchase([{ productId, qty: 1 }]);
}

async function executePurchase(lines) {
  // lines: [{ productId, qty }]
  if (!state.profile || !state.user) {
    showToast('Faça login para comprar.', 'error');
    return false;
  }

  let total = 0;
  for (const line of lines) {
    const p = state.products[line.productId];
    if (!p) {
      showToast('Produto inválido no carrinho.', 'error');
      return false;
    }
    if (p.stock !== null && p.stock !== undefined && p.stock < line.qty) {
      showToast(`${p.name}: só restam ${p.stock} unidades.`, 'error');
      return false;
    }
    total += (Number(p.price) || 0) * line.qty;
  }

  const balance = Number(state.profile.balance) || 0;
  if (balance < total) {
    showToast(`Saldo insuficiente. Faltam ${formatMoney(total - balance)}.`, 'error');
    return false;
  }

  const uid = state.user.uid;
  const updates = {};
  let runningBalance = balance;

  for (const line of lines) {
    const p = state.products[line.productId];
    const price = Number(p.price) || 0;
    const lineTotal = price * line.qty;
    runningBalance -= lineTotal;

    const delivery = computeDelivery(p);

    for (let i = 0; i < line.qty; i++) {
      const invKey = generateId();
      updates[`users/${uid}/inventory/${invKey}`] = {
        productId: line.productId,
        name: p.name,
        price,
        category: p.category,
        image: p.image || '',
        boughtAt: Date.now(),
        status: delivery.status,
        estimatedDelivery: delivery.estimatedDelivery,
        deliveredAt: delivery.deliveredAt
      };
    }

    if (p.stock !== null && p.stock !== undefined) {
      updates[`products/${line.productId}/stock`] = p.stock - line.qty;
    }

    const orderId = generateId();
    updates[`orders/${orderId}`] = {
      userId: uid,
      userName: state.profile.name,
      productId: line.productId,
      productName: p.name,
      price: lineTotal,
      unitPrice: price,
      quantity: line.qty,
      image: p.image || '',
      category: p.category || '',
      status: delivery.status,
      estimatedDelivery: delivery.estimatedDelivery,
      deliveredAt: delivery.deliveredAt,
      createdAt: Date.now()
    };
  }

  updates[`users/${uid}/balance`] = runningBalance;

  try {
    await db.ref().update(updates);
    showToast(`Compra realizada! ${formatMoney(total)}`);
    return true;
  } catch (err) {
    console.error(err);
    showToast('Erro ao processar compra.', 'error');
    return false;
  }
}

function updateBalanceUI() {
  const el = document.getElementById('user-balance');
  if (el && state.profile) {
    el.textContent = formatMoney(state.profile.balance);
  }
}

function updateAdminVisibility() {
  const isAdmin = state.profile?.isAdmin || ADMIN_UIDS.includes(state.user?.uid);
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin);
  });
  // Se virou admin, começa a escutar todos os pedidos
  if (isAdmin && state.allOrders.length === 0) {
    listenAllOrders();
  }
}
