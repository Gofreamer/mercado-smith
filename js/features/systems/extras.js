/* Global Smith — Wishlist, Coupons, Offers */

async function toggleWishlist(productId) {
  if (!state.user) return;
  const p = state.products[productId];
  if (!p) return;

  const path = `users/${state.user.uid}/wishlist/${productId}`;
  try {
    if (state.wishlist && state.wishlist[productId]) {
      await db.ref(path).remove();
      showToast('Removido da lista de desejos');
    } else {
      await db.ref(path).set({
        productId,
        name: p.name,
        price: p.price,
        image: p.image || '',
        category: p.category || '',
        addedAt: Date.now()
      });
      showToast('Adicionado à lista de desejos');
    }
  } catch (e) {
    console.error(e);
    showToast('Erro ao atualizar desejos.', 'error');
  }
}

function renderWishlist() {
  const list = document.getElementById('wishlist-list');
  if (!list) return;

  const entries = Object.entries(state.wishlist || {});
  if (!entries.length) {
    list.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">☆</div>
        <h3>Lista de desejos vazia</h3>
        <p>Marque itens no mercado com a estrela para acompanhá-los.</p>
        <button class="btn btn-primary" onclick="showView('market')">Ir ao Mercado</button>
      </div>
    `;
    return;
  }

  list.innerHTML = entries.map(([pid, w]) => {
    const p = state.products[pid];
    const available = p && (p.stock === null || p.stock === undefined || p.stock > 0);
    const gone = !p;
    const price = p ? p.price : w.price;
    const name = p ? p.name : w.name;

    return `
      <div class="wishlist-item ${gone ? 'gone' : ''}">
        <div class="wishlist-info">
          <h4>${escapeHTML(name)}</h4>
          <p>${escapeHTML(CATEGORY_LABELS[w.category] || w.category || '')}</p>
          <div class="wishlist-meta">
            <span class="item-price">${formatMoney(price)}</span>
            ${gone ? '<span class="status-pill status-lost">Indisponível</span>' :
              available ? '<span class="status-pill status-delivered">Em estoque</span>' :
              '<span class="status-pill status-held">Esgotado</span>'}
          </div>
        </div>
        <div class="wishlist-actions">
          ${!gone && available ? `<button class="btn btn-primary btn-sm" onclick="buyProduct('${pid}')">Comprar</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="toggleWishlist('${pid}')">Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

async function applyCartCoupon() {
  const input = document.getElementById('cart-coupon-input');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) {
    showToast('Digite um código.', 'error');
    return;
  }

  try {
    const snap = await db.ref('coupons/' + code).once('value');
    const c = snap.val();
    if (!c) {
      showToast('Cupom inválido.', 'error');
      return;
    }
    if (c.maxUses != null && (c.uses || 0) >= c.maxUses) {
      showToast('Cupom esgotado.', 'error');
      return;
    }
    if (c.expires && c.expires < Date.now()) {
      showToast('Cupom expirado.', 'error');
      return;
    }
    const rank = getUserRank(state.profile, state.orders);
    if (c.minRank && !rankMeets(rank.id, c.minRank)) {
      showToast('Seu rank não permite este cupom.', 'error');
      return;
    }

    state.appliedCoupon = code;
    state.appliedCouponData = c;
    showToast(`Cupom ${code} aplicado!`);
    renderCart();
  } catch (e) {
    console.error(e);
    showToast('Erro ao validar cupom.', 'error');
  }
}

function clearCartCoupon() {
  state.appliedCoupon = null;
  state.appliedCouponData = null;
  const input = document.getElementById('cart-coupon-input');
  if (input) input.value = '';
  renderCart();
}

async function submitOffer(productId) {
  if (!canNegotiate()) {
    showToast('Negociação liberada a partir do rank Platina.', 'error');
    return;
  }
  const p = state.products[productId];
  if (!p) return;

  const raw = prompt(`Oferta para "${p.name}"\nPreço atual: ${formatMoney(p.price)}\n\nSua oferta ($):`);
  if (raw === null) return;
  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    showToast('Valor inválido.', 'error');
    return;
  }
  if (amount >= Number(p.price)) {
    showToast('Oferta deve ser menor que o preço. Use Comprar para o valor cheio.', 'error');
    return;
  }

  try {
    await db.ref('offers').push({
      userId: state.user.uid,
      userName: state.profile.name,
      productId,
      productName: p.name,
      listPrice: Number(p.price),
      amount,
      status: 'pending',
      createdAt: Date.now()
    });
    pushAdminLog({
      type: 'offer',
      userId: state.user.uid,
      userName: state.profile.name,
      productName: p.name,
      amount
    });
    showToast('Oferta enviada ao núcleo GS.');
    closeProductModal();
  } catch (e) {
    console.error(e);
    showToast('Erro ao enviar oferta.', 'error');
  }
}

async function adminRespondOffer(offerId, action) {
  const offer = state.offers.find(o => o.id === offerId);
  if (!offer) return;

  if (action === 'reject') {
    await db.ref('offers/' + offerId).update({ status: 'rejected', resolvedAt: Date.now() });
    showToast('Oferta rejeitada.');
    return;
  }

  if (action === 'accept') {
    const p = state.products[offer.productId];
    if (!p) {
      showToast('Produto sumiu.', 'error');
      return;
    }
    if (!confirm(`Aceitar oferta de ${formatMoney(offer.amount)} de ${offer.userName} por "${offer.productName}"?`)) return;

    try {
      const userSnap = await db.ref('users/' + offer.userId).once('value');
      const user = userSnap.val();
      if (!user) {
        showToast('Usuário não encontrado.', 'error');
        return;
      }
      const bal = Number(user.balance) || 0;
      if (bal < offer.amount) {
        showToast('Jogador sem saldo para a oferta.', 'error');
        await db.ref('offers/' + offerId).update({ status: 'rejected', note: 'saldo insuficiente', resolvedAt: Date.now() });
        return;
      }

      const delivery = computeDelivery(p);
      const updates = {};
      updates[`users/${offer.userId}/balance`] = bal - offer.amount;
      const invKey = generateId();
      updates[`users/${offer.userId}/inventory/${invKey}`] = {
        productId: offer.productId,
        name: p.name,
        price: offer.amount,
        category: p.category,
        image: p.image || '',
        boughtAt: Date.now(),
        status: delivery.status,
        estimatedDelivery: delivery.estimatedDelivery,
        deliveredAt: delivery.deliveredAt,
        viaOffer: true
      };
      if (p.stock != null) updates[`products/${offer.productId}/stock`] = Math.max(0, (p.stock || 0) - 1);

      const orderId = generateId();
      updates[`orders/${orderId}`] = {
        userId: offer.userId,
        userName: offer.userName,
        productId: offer.productId,
        productName: p.name,
        price: offer.amount,
        unitPrice: offer.amount,
        quantity: 1,
        image: p.image || '',
        category: p.category || '',
        status: delivery.status,
        estimatedDelivery: delivery.estimatedDelivery,
        deliveredAt: delivery.deliveredAt,
        viaOffer: true,
        createdAt: Date.now()
      };

      if (delivery.status === 'delivered') {
        updates[`users/${offer.userId}/repSpent`] = (Number(user.repSpent) || 0) + offer.amount;
        updates[`users/${offer.userId}/repOrders`] = (Number(user.repOrders) || 0) + 1;
      }

      updates[`offers/${offerId}/status`] = 'accepted';
      updates[`offers/${offerId}/resolvedAt`] = Date.now();

      await db.ref().update(updates);
      pushAdminLog({ type: 'offer_accepted', offerId, userName: offer.userName, amount: offer.amount, productName: p.name });
      showToast('Oferta aceita e compra processada.');
    } catch (e) {
      console.error(e);
      showToast('Erro ao aceitar oferta.', 'error');
    }
    return;
  }

  if (action === 'counter') {
    const raw = prompt('Contraproposta ($):', String(Math.round(offer.amount * 1.1)));
    if (raw === null) return;
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) {
      showToast('Valor inválido.', 'error');
      return;
    }
    await db.ref('offers/' + offerId).update({
      status: 'counter',
      counterAmount: amount,
      resolvedAt: Date.now()
    });
    showToast('Contraproposta enviada.');
  }
}
