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
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCart();
}

function closeCart() {
  state.cartOpen = false;
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
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

  // Estoque
  if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
    showToast('Produto esgotado.', 'error');
    return;
  }

  const current = state.cart[productId]?.qty || 0;
  const newQty = current + qty;

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
}

function removeFromCart(productId) {
  delete state.cart[productId];
  saveCartToStorage();
  updateCartBadge();
  renderCart();
  showToast('Item removido do carrinho');
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
        <h3>Carrinho vazio</h3>
        <p>Explore o mercado e adicione itens exclusivos.</p>
        <button class="btn btn-primary" onclick="closeCart(); showView('market')">Ir ao Mercado</button>
      </div>
    `;
    if (footer) footer.classList.add('hidden');
    return;
  }

  if (footer) footer.classList.remove('hidden');

  // Ordena por data de adição
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

    return `
      <div class="cart-item">
        <div class="cart-item-img">${imgHtml}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHTML(p.name)}</div>
          <div class="cart-item-cat">${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</div>
          <div class="cart-item-price">${formatMoney(p.price)} <span class="cart-line-total">· ${formatMoney(lineTotal)}</span></div>
        </div>
        <div class="cart-item-actions">
          <div class="qty-control">
            <button class="qty-btn" onclick="setCartQty('${pid}', ${item.qty - 1})" aria-label="Diminuir">−</button>
            <input type="number" class="qty-input" value="${item.qty}" min="1" max="${maxStock}"
                   onchange="setCartQty('${pid}', this.value)" />
            <button class="qty-btn" onclick="setCartQty('${pid}', ${item.qty + 1})" aria-label="Aumentar">+</button>
          </div>
          <button class="cart-remove" onclick="removeFromCart('${pid}')" title="Remover">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Footer totals
  const totalEl = document.getElementById('cart-total-value');
  const countEl = document.getElementById('cart-count-label');
  if (totalEl) totalEl.textContent = formatMoney(getCartTotal());
  if (countEl) countEl.textContent = `${getCartCount()} item${getCartCount() !== 1 ? 's' : ''}`;
}

async function checkoutCart() {
  if (!state.profile || !state.user) {
    showToast('Faça login para comprar.', 'error');
    return;
  }

  const entries = Object.entries(state.cart);
  if (entries.length === 0) {
    showToast('Carrinho vazio.', 'error');
    return;
  }

  const total = getCartTotal();
  const balance = Number(state.profile.balance) || 0;

  if (balance < total) {
    showToast(`Saldo insuficiente. Faltam ${formatMoney(total - balance)}.`, 'error');
    return;
  }

  // Valida estoque novamente
  for (const [pid, item] of entries) {
    const p = state.products[pid];
    if (!p) {
      showToast('Um produto do carrinho não existe mais.', 'error');
      return;
    }
    if (p.stock !== null && p.stock !== undefined && p.stock < item.qty) {
      showToast(`${p.name}: só restam ${p.stock} unidades.`, 'error');
      return;
    }
  }

  const btn = document.getElementById('btn-checkout');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processando...';
  }

  const uid = state.user.uid;
  const updates = {};
  let runningBalance = balance;

  for (const [pid, item] of entries) {
    const p = state.products[pid];
    const price = Number(p.price) || 0;
    const lineTotal = price * item.qty;

    runningBalance -= lineTotal;

    // Inventário (um registro por unidade para manter histórico individual)
    for (let i = 0; i < item.qty; i++) {
      const invKey = generateId();
      updates[`users/${uid}/inventory/${invKey}`] = {
        productId: pid,
        name: p.name,
        price,
        category: p.category,
        image: p.image || '',
        boughtAt: Date.now()
      };
    }

    // Estoque
    if (p.stock !== null && p.stock !== undefined) {
      updates[`products/${pid}/stock`] = p.stock - item.qty;
    }

    // Pedido (agrupado por linha)
    const orderId = generateId();
    updates[`orders/${orderId}`] = {
      userId: uid,
      userName: state.profile.name,
      productId: pid,
      productName: p.name,
      price: lineTotal,
      unitPrice: price,
      quantity: item.qty,
      image: p.image || '',
      category: p.category || '',
      createdAt: Date.now()
    };
  }

  updates[`users/${uid}/balance`] = runningBalance;

  try {
    await db.ref().update(updates);
    clearCart();
    clearCartStorage();
    updateCartBadge();
    closeCart();
    showToast(`Compra realizada! ${formatMoney(total)}`);
  } catch (err) {
    console.error(err);
    showToast('Erro ao processar compra.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Finalizar Compra';
    }
  }
}
