/* Global Smith — Shopping Cart */

function getCartCount() {
  return Object.values(state.cart).reduce((sum, item) => sum + (item.qty || 0), 0);
}

function getCartTotal() {
  let total = 0;
  for (const [pid, item] of Object.entries(state.cart)) {
    const product = state.products[pid];
    if (product) total += (Number(product.price) || 0) * (item.qty || 0);
  }
  return total;
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = getCartCount();
  if (badge) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.toggle('hidden', count === 0);
  }
}

function openCart() {
  state.cartOpen = true;
  document.getElementById('cart-drawer')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCart();
}

function closeCart() {
  state.cartOpen = false;
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function toggleCart() {
  if (state.cartOpen) closeCart();
  else openCart();
}

function addToCart(productId, qty = 1) {
  const product = state.products[productId];
  if (!product) {
    showToast('Produto não encontrado.', 'error');
    return;
  }
  if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
    showToast('Produto esgotado.', 'error');
    return;
  }

  const current = state.cart[productId]?.qty || 0;
  let newQty = current + qty;

  if (product.stock !== null && product.stock !== undefined && newQty > product.stock) {
    showToast(`Só restam ${product.stock} unidades.`, 'error');
    return;
  }

  state.cart[productId] = {
    qty: newQty,
    addedAt: state.cart[productId]?.addedAt || Date.now()
  };

  saveCartToStorage();
  updateCartBadge();
  showToast(`${product.name} adicionado ao carrinho`);
  if (state.cartOpen) renderCart();
  if (state.currentView === 'market') renderProducts();
}

function setCartQty(productId, qty) {
  qty = Math.max(0, parseInt(qty, 10) || 0);
  const product = state.products[productId];

  if (qty === 0) {
    delete state.cart[productId];
  } else {
    if (product && product.stock !== null && product.stock !== undefined && qty > product.stock) {
      showToast(`Só restam ${product.stock} unidades.`, 'error');
      qty = product.stock;
    }
    state.cart[productId] = {
      qty,
      addedAt: state.cart[productId]?.addedAt || Date.now()
    };
  }

  saveCartToStorage();
  updateCartBadge();
  renderCart();
  if (state.currentView === 'market') renderProducts();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  saveCartToStorage();
  updateCartBadge();
  renderCart();
  showToast('Item removido do carrinho');
  if (state.currentView === 'market') renderProducts();
}

function clearCart() {
  state.cart = {};
  saveCartToStorage();
  updateCartBadge();
  renderCart();
}

function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  if (!body) return;

  const entries = Object.entries(state.cart);
  if (entries.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h3>Carrinho sem carga</h3>
        <p>Nada reservado ainda. O catálogo GS tem o que a mesa precisa.</p>
        <button class="btn btn-primary" onclick="closeCart(); showView('market')">Abrir o Mercado</button>
      </div>
    `;
    if (footer) footer.classList.add('hidden');
    return;
  }

  if (footer) footer.classList.remove('hidden');
  entries.sort((a, b) => (a[1].addedAt || 0) - (b[1].addedAt || 0));

  body.innerHTML = entries.map(([pid, item]) => {
    const p = state.products[pid];
    if (!p) {
      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">Produto removido</div>
            <button class="btn btn-ghost btn-sm" onclick="removeFromCart('${pid}')">Remover</button>
          </div>
        </div>
      `;
    }

    const lineTotal = (Number(p.price) || 0) * item.qty;
    const imgHtml = p.image
      ? `<img src="${escapeHTML(p.image)}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'cart-item-placeholder\\'>?</div>'"/>`
      : `<div class="cart-item-placeholder">${(p.name || '?')[0]}</div>`;

    const maxStock = (p.stock !== null && p.stock !== undefined) ? p.stock : 99;
    const deliveryHint = p.deliveryDays > 0
      ? `<div class="cart-delivery">Chega em ~${p.deliveryDays}d</div>`
      : `<div class="cart-delivery instant">Entrega imediata</div>`;

    return `
      <div class="cart-item">
        <div class="cart-item-img">${imgHtml}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHTML(p.name)}</div>
          <div class="cart-item-cat">${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</div>
          <div class="cart-item-price">${formatMoney(p.price)} <span class="cart-line-total">· ${formatMoney(lineTotal)}</span></div>
          ${deliveryHint}
        </div>
        <div class="cart-item-actions">
          <div class="qty-control">
            <button class="qty-btn" onclick="setCartQty('${pid}', ${item.qty - 1})">−</button>
            <input type="number" class="qty-input" value="${item.qty}" min="1" max="${maxStock}"
                   onchange="setCartQty('${pid}', this.value)" />
            <button class="qty-btn" onclick="setCartQty('${pid}', ${item.qty + 1})">+</button>
          </div>
          <button class="cart-remove" onclick="removeFromCart('${pid}')" title="Remover">✕</button>
        </div>
      </div>
    `;
  }).join('');

  const subtotal = getCartTotal();
  let discount = 0;
  if (state.appliedCoupon && state.appliedCouponData) {
    discount = calcCouponDiscount(subtotal, state.appliedCouponData);
  }
  const totalEl = document.getElementById('cart-total-value');
  const countEl = document.getElementById('cart-count-label');
  const discountEl = document.getElementById('cart-discount-row');
  const discountVal = document.getElementById('cart-discount-value');
  if (totalEl) totalEl.textContent = formatMoney(Math.max(0, subtotal - discount));
  if (countEl) countEl.textContent = `${getCartCount()} item${getCartCount() !== 1 ? 's' : ''}`;
  if (discountEl && discountVal) {
    if (discount > 0) {
      discountEl.classList.remove('hidden');
      discountVal.textContent = '- ' + formatMoney(discount);
    } else {
      discountEl.classList.add('hidden');
    }
  }
  const applied = document.getElementById('cart-coupon-applied');
  if (applied) {
    if (state.appliedCoupon) {
      applied.classList.remove('hidden');
      applied.innerHTML = `Cupom <strong>${escapeHTML(state.appliedCoupon)}</strong> <button class="btn btn-ghost btn-sm" onclick="clearCartCoupon()">Remover</button>`;
    } else {
      applied.classList.add('hidden');
      applied.innerHTML = '';
    }
  }
}

async function checkoutCart() {
  const entries = Object.entries(state.cart);
  if (entries.length === 0) {
    showToast('Carrinho vazio.', 'error');
    return;
  }

  const total = getCartTotal();
  const balance = Number(state.profile?.balance) || 0;

  let payTotal = total;
  let discount = 0;
  if (state.appliedCoupon && state.appliedCouponData) {
    discount = calcCouponDiscount(total, state.appliedCouponData);
    payTotal = Math.max(0, total - discount);
  }
  if (balance < payTotal) {
    showToast(`Saldo insuficiente. Faltam ${formatMoney(payTotal - balance)}.`, 'error');
    return;
  }

  const rows = [
    { label: 'Itens', value: `${getCartCount()} no carrinho` },
    { label: 'Subtotal', value: formatMoney(total) }
  ];
  if (discount > 0) rows.push({ label: 'Desconto', value: `− ${formatMoney(discount)}`, success: true });
  rows.push(
    { label: 'Total', value: formatMoney(payTotal), success: true },
    { label: 'Saldo após', value: formatMoney(balance - payTotal) }
  );

  const ok = await gsConfirm({
    title: 'Finalizar compra',
    body: 'Confirme o checkout do carrinho Global Smith.',
    confirmLabel: 'Pagar agora',
    cancelLabel: 'Voltar',
    rows
  });
  if (!ok) return;

  const btn = document.getElementById('btn-checkout');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processando...';
  }

  const lines = entries.map(([productId, item]) => ({ productId, qty: item.qty }));
  const success = await executePurchase(lines);

  if (success) {
    clearCart();
    clearCartStorage();
    updateCartBadge();
    closeCart();
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Finalizar Compra';
  }
}
