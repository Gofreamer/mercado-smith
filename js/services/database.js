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

/** Compra rápida (1 unidade) */
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

  const uid = state.user.uid;
  const orderId = generateId();
  const updates = {};

  updates[`users/${uid}/balance`] = balance - price;

  const invKey = generateId();
  updates[`users/${uid}/inventory/${invKey}`] = {
    productId,
    name: product.name,
    price,
    category: product.category,
    image: product.image || '',
    boughtAt: Date.now()
  };

  if (product.stock !== null && product.stock !== undefined) {
    updates[`products/${productId}/stock`] = product.stock - 1;
  }

  updates[`orders/${orderId}`] = {
    userId: uid,
    userName: state.profile.name,
    productId,
    productName: product.name,
    price,
    unitPrice: price,
    quantity: 1,
    image: product.image || '',
    category: product.category || '',
    createdAt: Date.now()
  };

  try {
    await db.ref().update(updates);
    showToast(`Comprado: ${product.name}`);
  } catch (err) {
    console.error(err);
    showToast('Erro ao processar compra.', 'error');
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
}
