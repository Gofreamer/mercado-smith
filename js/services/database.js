/* Global Smith — Database Service */

function listenUserProfile(uid) {
  db.ref('users/' + uid).on('value', (snap) => {
    state.profile = snap.val() || null;
    state.wishlist = state.profile?.wishlist || {};
    updateBalanceUI();
    updateAdminVisibility();
    updateBlackMarketNav();
    if (state.currentView === 'inventory') renderInventory();
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'wishlist') renderWishlist();
    if (state.currentView === 'blackmarket') renderBlackMarket();
  });
}

function listenProducts() {
  db.ref('products').on('value', (snap) => {
    state.products = snap.val() || {};
    if (state.currentView === 'market') renderProducts();
    if (state.currentView === 'blackmarket') renderBlackMarket();
    if (state.currentView === 'admin') renderAdminProducts();
    if (state.currentView === 'wishlist') renderWishlist();
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
    if (state.currentView === 'profile') renderProfile();
  });
}


function listenAllUsers() {
  db.ref('users').on('value', (snap) => {
    state.allUsers = snap.val() || {};
    if (state.currentView === 'admin') {
      if (typeof renderAdminPlayers === 'function') renderAdminPlayers();
    }
  });
}

function listenAllOrders() {
  db.ref('orders').on('value', (snap) => {
    const data = snap.val() || {};
    state.allOrders = Object.entries(data)
      .map(([id, order]) => ({ id, ...order }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'admin') renderAdminOrders();
  });
}

function listenFeed() {
  db.ref('marketFeed').limitToLast(20).on('value', (snap) => {
    const data = snap.val() || {};
    state.feed = Object.entries(data)
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderMarketFeed();
  });
}

function listenCoupons() {
  db.ref('coupons').on('value', (snap) => {
    state.coupons = snap.val() || {};
    if (state.currentView === 'admin') renderAdminCoupons();
  });
}

function listenOffers() {
  db.ref('offers').on('value', (snap) => {
    const data = snap.val() || {};
    state.offers = Object.entries(data)
      .map(([id, o]) => ({ id, ...o }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'admin') renderAdminOffers();
    if (state.currentView === 'profile') renderProfile();
  });
}

function listenAdminLog() {
  db.ref('adminLog').limitToLast(100).on('value', (snap) => {
    const data = snap.val() || {};
    state.adminLog = Object.entries(data)
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'admin') renderAdminLog();
  });
}

async function pushAdminLog(entry) {
  try {
    await db.ref('adminLog').push({
      ...entry,
      createdAt: Date.now()
    });
  } catch (e) {
    console.warn('adminLog', e);
  }
}

async function pushFeed(text, type = 'info') {
  try {
    await db.ref('marketFeed').push({
      text,
      type,
      createdAt: Date.now()
    });
  } catch (e) {
    console.warn('feed', e);
  }
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

function assertCanBuyProduct(product) {
  if (!product) return 'Produto não encontrado.';
  if (product.category === 'ilegais' && !hasBlackMarketAccess()) {
    return 'Acesso ao Subsolo negado.';
  }
  if (product.secretRank && !canSeeSecret(product)) {
    return `Item restrito. Requer rank ${RANK_THRESHOLDS.find(r => r.id === product.secretRank)?.label || product.secretRank}.`;
  }
  return null;
}

function calcCouponDiscount(total, coupon) {
  if (!coupon) return 0;
  if (coupon.type === 'percent') {
    return Math.min(total, total * (Number(coupon.value) || 0) / 100);
  }
  if (coupon.type === 'fixed') {
    return Math.min(total, Number(coupon.value) || 0);
  }
  return 0;
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

  const gate = assertCanBuyProduct(product);
  if (gate) {
    showToast(gate, 'error');
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

  const warn = product.category === 'ilegais'
    ? '\n\n⚠ Aquisição irregular — sem suporte oficial GS.'
    : '';

  const ok = confirm(
    `Confirmar compra?\n\n` +
    `${product.name}\n` +
    `Preço: ${formatMoney(price)}\n` +
    `Saldo após: ${formatMoney(balance - price)}\n` +
    `${deliveryInfo}${warn}`
  );
  if (!ok) return;

  await executePurchase([{ productId, qty: 1 }]);
}

async function executePurchase(lines) {
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
    const gate = assertCanBuyProduct(p);
    if (gate) {
      showToast(gate, 'error');
      return false;
    }
    if (p.stock !== null && p.stock !== undefined && p.stock < line.qty) {
      showToast(`${p.name}: só restam ${p.stock} unidades.`, 'error');
      return false;
    }
    total += (Number(p.price) || 0) * line.qty;
  }

  // Cupom
  let discount = 0;
  let couponCode = null;
  if (state.appliedCoupon) {
    const c = state.coupons[state.appliedCoupon] || state.appliedCouponData;
    if (c) {
      const rank = getUserRank(state.profile, state.orders);
      if (c.minRank && !rankMeets(rank.id, c.minRank)) {
        showToast('Cupom exige rank superior.', 'error');
        return false;
      }
      if (c.maxUses != null && (c.uses || 0) >= c.maxUses) {
        showToast('Cupom esgotado.', 'error');
        return false;
      }
      if (c.expires && c.expires < Date.now()) {
        showToast('Cupom expirado.', 'error');
        return false;
      }
      discount = calcCouponDiscount(total, c);
      couponCode = state.appliedCoupon;
    }
  }

  const payTotal = Math.max(0, total - discount);
  const balance = Number(state.profile.balance) || 0;
  if (balance < payTotal) {
    showToast(`Saldo insuficiente. Faltam ${formatMoney(payTotal - balance)}.`, 'error');
    return false;
  }

  const uid = state.user.uid;
  const updates = {};
  let runningBalance = balance;

  for (const line of lines) {
    const p = state.products[line.productId];
    const price = Number(p.price) || 0;
    const lineTotal = price * line.qty;
    // discount applied proportionally only at balance level
    const delivery = computeDelivery(p);
    const isIllegal = p.category === 'ilegais';

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
        deliveredAt: delivery.deliveredAt,
        illegal: !!isIllegal,
        statusMessage: STATUS_MESSAGES[delivery.status] || ''
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
      statusMessage: STATUS_MESSAGES[delivery.status] || '',
      illegal: !!isIllegal,
      coupon: couponCode || null,
      discount: discount > 0 ? discount : null,
      createdAt: Date.now()
    };

    // rep only on delivered immediately
    if (delivery.status === 'delivered') {
      const prevSpent = Number(state.profile.repSpent) || 0;
      const prevOrders = Number(state.profile.repOrders) || 0;
      updates[`users/${uid}/repSpent`] = prevSpent + lineTotal;
      updates[`users/${uid}/repOrders`] = prevOrders + 1;
      state.profile.repSpent = prevSpent + lineTotal;
      state.profile.repOrders = prevOrders + 1;
    }
  }

  runningBalance -= payTotal;
  updates[`users/${uid}/balance`] = runningBalance;

  if (couponCode) {
    const uses = (state.coupons[couponCode]?.uses || 0) + 1;
    updates[`coupons/${couponCode}/uses`] = uses;
  }

  try {
    await db.ref().update(updates);

    // feed + log
    const names = lines.map(l => state.products[l.productId]?.name).filter(Boolean);
    if (names.length) {
      const label = names.length === 1 ? names[0] : `${names.length} itens`;
      pushFeed(`${label} — movimento no mercado.`, 'sale');
    }
    pushAdminLog({
      type: 'purchase',
      userId: uid,
      userName: state.profile.name,
      total: payTotal,
      discount,
      coupon: couponCode,
      items: lines.map(l => ({
        productId: l.productId,
        name: state.products[l.productId]?.name,
        qty: l.qty
      }))
    });

    state.appliedCoupon = null;
    state.appliedCouponData = null;
    const couponInput = document.getElementById('cart-coupon-input');
    if (couponInput) couponInput.value = '';

    showToast(`Compra realizada! ${formatMoney(payTotal)}${discount ? ' (cupom aplicado)' : ''}`);
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
  const rankEl = document.getElementById('header-rank');
  if (rankEl && state.profile) {
    const rank = getUserRank(state.profile, state.orders);
    rankEl.textContent = rank.label;
    rankEl.style.color = rank.color;
    rankEl.classList.remove('hidden');
  }
}

function updateAdminVisibility() {
  const isAdmin = state.profile?.isAdmin || ADMIN_UIDS.includes(state.user?.uid);
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin);
  });
  if (isAdmin && state.allOrders.length === 0) {
    listenAllOrders();
    listenCoupons();
    listenOffers();
    listenAdminLog();
  }
  if (isAdmin && (!state.allUsers || Object.keys(state.allUsers).length === 0)) {
    listenAllUsers();
  }
}

function updateBlackMarketNav() {
  const btn = document.getElementById('nav-blackmarket');
  if (!btn) return;
  const access = hasBlackMarketAccess();
  btn.classList.toggle('hidden', !access);
  if (!access && state.currentView === 'blackmarket') {
    showView('market');
    document.body.classList.remove('theme-blackmarket');
  }
}
