/* Global Smith — Database Service */

function listenUserProfile(uid) {
  db.ref('users/' + uid).on('value', (snap) => {
    const prevInv = state.profile?.inventory || {};
    state.profile = snap.val() || null;
    state.wishlist = state.profile?.wishlist || {};
    updateBalanceUI();
    updateAdminVisibility();
    updateBlackMarketNav();
    if (typeof updateDocumentTitle === 'function') updateDocumentTitle();
    // Toast cinematográfico quando item muda para delivered
    if (typeof notifyDeliveryStatusChanges === 'function') {
      notifyDeliveryStatusChanges(prevInv, state.profile?.inventory || {});
    }
    if (state.currentView === 'inventory') renderInventory();
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'wishlist') renderWishlist();
    if (state.currentView === 'bank' && typeof renderBank === 'function') renderBank();
    if (state.currentView === 'market' && typeof renderMarketSidePanels === 'function') renderMarketSidePanels();
    if (state.currentView === 'blackmarket') renderBlackMarket();
  });
}

function notifyDeliveryStatusChanges(prevInv, nextInv) {
  if (!state._deliveryToastReady) {
    state._deliveryToastReady = true;
    return; // ignora primeira carga
  }
  Object.entries(nextInv || {}).forEach(([key, item]) => {
    const prev = prevInv?.[key];
    if (!prev || !item) return;
    const was = prev.status || 'delivered';
    const now = item.status || 'delivered';
    if (was === now) return;
    const flavor = (typeof DELIVERY_TOAST_FLAVOR !== 'undefined' && DELIVERY_TOAST_FLAVOR[now])
      || (STATUS_MESSAGES && STATUS_MESSAGES[now])
      || ('Status: ' + now);
    const name = item.name || 'Item';
    showToast(name + ' — ' + flavor, now === 'delivered' ? 'success' : 'info');
  });
}

function listenProducts() {
  db.ref('products').on('value', (snap) => {
    const next = snap.val() || {};
    if (typeof checkWishlistRestocks === 'function') {
      checkWishlistRestocks(next);
    }
    state.products = next;
    if (state.currentView === 'market') renderProducts();
    if (state.currentView === 'blackmarket') renderBlackMarket();
    if (state.currentView === 'admin') renderAdminProducts();
    if (state.currentView === 'wishlist') renderWishlist();
    if (state.cartOpen) renderCart();
  });
}

function listenSiteSettings() {
  db.ref('siteSettings').on('value', (snap) => {
    state.siteSettings = snap.val() || {};
    if (state.currentView === 'market' && typeof renderMarketSidePanels === 'function') {
      renderMarketSidePanels();
    }
  });
}

function listenVendors() {
  db.ref('vendors').on('value', (snap) => {
    state.vendors = snap.val() || {};
    if (state.currentView === 'market') renderProducts();
    if (state.currentView === 'admin' && typeof renderAdminVendors === 'function') renderAdminVendors();
    if (typeof fillVendorSelects === 'function') fillVendorSelects();
  });
}

function listenEvents() {
  db.ref('events').on('value', (snap) => {
    state.events = snap.val() || {};
    if (typeof renderEventBanner === 'function') renderEventBanner();
    if (state.currentView === 'market') renderProducts();
    if (state.currentView === 'blackmarket') renderBlackMarket();
    if (state.currentView === 'admin' && typeof renderAdminEvents === 'function') renderAdminEvents();
    if (state.currentView === 'wishlist') renderWishlist();
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
    if (typeof renderMarketSidePanels === 'function') renderMarketSidePanels();
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
    const nego = document.getElementById('nego-modal');
    if (nego && nego.classList.contains('open')) {
      const pid = nego.dataset.productId;
      const oid = nego.dataset.offerId;
      if (pid || oid) openNegotiationModal(pid, oid);
    }
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

  const listPrice = Number(product.price) || 0;
  const discInfo = (typeof getEventDiscountForProduct === 'function')
    ? getEventDiscountForProduct(productId, listPrice)
    : { discount: 0, final: listPrice, pct: 0 };
  const price = discInfo.final;
  const balance = Number(state.profile.balance) || 0;
  const afterBuy = balance - price;
  const floor = typeof BALANCE_FLOOR === 'number' ? BALANCE_FLOOR : -200000;

  if (afterBuy < floor) {
    const room = balance - floor;
    showToast(
      room <= 0
        ? `Limite de crédito esgotado (−${formatMoney(Math.abs(floor))}).`
        : `Acima do limite. Você pode gastar até ${formatMoney(room)}.`,
      'error'
    );
    return;
  }
  if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
    showToast('Produto esgotado.', 'error');
    return;
  }

  const deliveryInfo = product.deliveryDays > 0
    ? `Chega em ~${product.deliveryDays} dia(s)`
    : 'Entrega imediata';

  const rows = [
    { label: 'Item', value: product.name },
    discInfo.pct > 0
      ? { label: 'Preço', value: `${formatMoney(listPrice)} → ${formatMoney(price)} (−${discInfo.pct}%)`, success: true }
      : { label: 'Preço', value: formatMoney(price), success: true },
    { label: 'Saldo após', value: formatMoney(balance - price) },
    { label: 'Entrega', value: deliveryInfo, muted: true }
  ];
  if (product.category === 'ilegais') {
    rows.push({ label: 'Aviso', value: 'Aquisição irregular — sem suporte oficial GS', warn: true });
  }

  const ok = await gsConfirm({
    title: 'Confirmar compra',
    body: 'Revise a operação antes de debitar o cartão GS.',
    confirmLabel: 'Comprar agora',
    cancelLabel: 'Cancelar',
    rows
  });
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
    const list = Number(p.price) || 0;
    const disc = (typeof getEventDiscountForProduct === 'function')
      ? getEventDiscountForProduct(line.productId, list)
      : { final: list };
    total += disc.final * line.qty;
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
  const afterPay = balance - payTotal;
  const floorPay = typeof BALANCE_FLOOR === 'number' ? BALANCE_FLOOR : -200000;
  if (afterPay < floorPay) {
    const room = balance - floorPay;
    showToast(
      room <= 0
        ? `Limite de crédito esgotado (−${formatMoney(Math.abs(floorPay))}).`
        : `Acima do limite. Você pode gastar até ${formatMoney(room)}.`,
      'error'
    );
    return false;
  }

  const uid = state.user.uid;
  const updates = {};
  let runningBalance = balance;

  for (const line of lines) {
    const p = state.products[line.productId];
    const listPrice = Number(p.price) || 0;
    const disc = (typeof getEventDiscountForProduct === 'function')
      ? getEventDiscountForProduct(line.productId, listPrice)
      : { final: listPrice, pct: 0 };
    const price = disc.final;
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
        statusMessage: STATUS_MESSAGES[delivery.status] || '',
        eventDiscountPct: disc.pct || 0
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
      const qtyRep = Math.max(1, Number(line.qty) || 1);
      updates[`users/${uid}/repSpent`] = prevSpent + lineTotal;
      updates[`users/${uid}/repOrders`] = prevOrders + qtyRep;
      state.profile.repSpent = prevSpent + lineTotal;
      state.profile.repOrders = prevOrders + qtyRep;
    }
  }

  runningBalance -= payTotal;
  updates[`users/${uid}/balance`] = runningBalance;

  if (couponCode) {
    const uses = (state.coupons[couponCode]?.uses || 0) + 1;
    updates[`coupons/${couponCode}/uses`] = uses;
  }

  // extrato bancário
  const ledgerKey = generateId();
  const itemNames = lines.map(l => state.products[l.productId]?.name).filter(Boolean);
  const ledgerLabel = itemNames.length === 1
    ? `Compra: ${itemNames[0]}`
    : `Compra: ${itemNames.length} itens`;
  updates[`users/${uid}/ledger/${ledgerKey}`] = {
    type: 'purchase',
    amount: -payTotal,
    balanceAfter: runningBalance,
    label: ledgerLabel + (discount > 0 ? ' (cupom)' : ''),
    createdAt: Date.now()
  };

  try {
    await db.ref().update(updates);

    // log (sem post automático no feed — evita spam de compras)
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

function isUserAdmin() {
  if (state.user && Array.isArray(ADMIN_UIDS) && ADMIN_UIDS.includes(state.user.uid)) return true;
  const v = state.profile?.isAdmin;
  return v === true || v === 'true' || v === 1 || v === '1';
}

function updateAdminVisibility() {
  const isAdmin = isUserAdmin();
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin);
  });
  if (isAdmin && state.allOrders.length === 0) {
    listenAllOrders();
    listenCoupons();
    listenOffers();
    listenAdminLog();
    listenEvents();
    if (typeof listenLoanRequests === 'function') listenLoanRequests();
    listenVendors();
    listenSiteSettings();
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
