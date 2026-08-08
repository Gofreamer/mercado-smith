/* Global Smith — Wishlist, Coupons, Offers / Negociação, Eventos */

/* ========== WISHLIST ========== */

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
        addedAt: Date.now(),
        wasOutOfStock: (p.stock !== null && p.stock !== undefined && p.stock <= 0)
      });
      showToast('Marcado nos desejos. Avisaremos se voltar ao estoque.');
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
        <h3>Nenhum desejo registrado</h3>
        <p>Toque na estrela de um item no mercado. Se esgotar, o núcleo GS avisa quando reaparecer.</p>
        <button class="btn btn-primary" onclick="showView('market')">Vasculhar o Mercado</button>
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
    const eventTags = !gone ? getActiveEventTagsForProduct(pid) : [];

    return `
      <div class="wishlist-item ${gone ? 'gone' : ''}">
        <div class="wishlist-info">
          <h4>${escapeHTML(name)}</h4>
          <p>${escapeHTML(CATEGORY_LABELS[w.category] || w.category || '')}</p>
          ${eventTags.map(t => `<span class="event-tag" style="--event-color:${escapeHTML(t.color)}">${escapeHTML(t.label)}</span>`).join('')}
          <div class="wishlist-meta">
            <span class="item-price">${formatMoney(price)}</span>
            ${gone ? '<span class="status-pill status-lost">Fora do catálogo</span>' :
              available ? '<span class="status-pill status-delivered">Em estoque</span>' :
              '<span class="status-pill status-held">Esgotado — aguardando reposição</span>'}
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

/** Chamado quando products atualizam — avisa se item da wishlist voltou ao estoque */
function checkWishlistRestocks(newProducts) {
  if (!state.user || !state.wishlist) return;
  const prev = state._prevStock;
  if (!prev) {
    // primeira carga: só grava snapshot
    state._prevStock = {};
    Object.entries(newProducts || {}).forEach(([id, p]) => {
      state._prevStock[id] = p.stock;
    });
    return;
  }

  Object.keys(state.wishlist).forEach(pid => {
    const p = newProducts[pid];
    if (!p) return;
    const oldStock = prev[pid];
    const newStock = p.stock;
    const wasOut = oldStock !== null && oldStock !== undefined && oldStock <= 0;
    const nowIn = newStock === null || newStock === undefined || newStock > 0;
    if (wasOut && nowIn && !state._restockNotified[pid]) {
      state._restockNotified[pid] = Date.now();
      showToast(`★ "${p.name}" voltou ao estoque.`, 'success');
      // marca no perfil para UI
      db.ref(`users/${state.user.uid}/wishlist/${pid}/wasOutOfStock`).set(false).catch(() => {});
      pushFeed(`Reposição detectada: ${p.name}`, 'info');
    }
  });

  state._prevStock = {};
  Object.entries(newProducts || {}).forEach(([id, p]) => {
    state._prevStock[id] = p.stock;
  });
}

/* ========== CUPONS ========== */

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

/* ========== NEGOCIAÇÃO (chat curto sobre oferta) ========== */

const NEGO_MAX_MESSAGES = 8;

async function submitOffer(productId) {
  if (!canNegotiate()) {
    showToast('Negociação liberada a partir do rank Platina.', 'error');
    return;
  }
  openNegotiationModal(productId);
}

function openNegotiationModal(productId, existingOfferId) {
  const p = state.products[productId];
  if (!p && !existingOfferId) return;

  let offer = null;
  if (existingOfferId) {
    offer = (state.offers || []).find(o => o.id === existingOfferId);
  } else if (state.user) {
    offer = (state.offers || []).find(o =>
      o.userId === state.user.uid &&
      o.productId === productId &&
      (o.status === 'pending' || o.status === 'counter' || o.status === 'open')
    );
  }

  const modal = document.getElementById('nego-modal');
  const body = document.getElementById('nego-modal-body');
  if (!modal || !body) return;

  const productName = offer?.productName || p?.name || '—';
  const listPrice = offer?.listPrice != null ? offer.listPrice : Number(p?.price) || 0;
  const messages = offer?.messages || [];
  const status = offer?.status || 'new';
  const canSend = !offer || status === 'pending' || status === 'counter' || status === 'open';
  const msgCount = messages.length;
  const limitReached = msgCount >= NEGO_MAX_MESSAGES;

  const bubbles = messages.length
    ? messages.map(m => `
        <div class="nego-bubble nego-${m.from === 'admin' ? 'admin' : 'player'}">
          <div class="nego-bubble-meta">${m.from === 'admin' ? 'Núcleo GS' : 'Você'} · ${formatDateTime(m.createdAt)}</div>
          <div class="nego-bubble-text">${escapeHTML(m.text || '')}</div>
          ${m.amount != null ? `<div class="nego-bubble-amount">${formatMoney(m.amount)}</div>` : ''}
        </div>
      `).join('')
    : `<div class="nego-empty">Nenhuma mensagem ainda. Proponha um valor abaixo do de lista.</div>`;

  body.innerHTML = `
    <div class="nego-header">
      <h3>Negociação</h3>
      <p class="nego-product">${escapeHTML(productName)}</p>
      <p class="nego-list-price">Preço de lista: <strong>${formatMoney(listPrice)}</strong></p>
      <span class="status-pill ${status === 'accepted' ? 'status-delivered' : status === 'rejected' ? 'status-lost' : 'status-transit'}">${escapeHTML(status)}</span>
    </div>
    <div class="nego-thread" id="nego-thread">${bubbles}</div>
    ${canSend && !limitReached && status !== 'accepted' && status !== 'rejected' ? `
      <div class="nego-compose">
        <textarea id="nego-text" rows="2" maxlength="160" placeholder="Mensagem curta (máx. 160 caracteres)…"></textarea>
        <div class="nego-compose-row">
          <input type="number" id="nego-amount" class="search-input" step="0.01" min="1" placeholder="Sua oferta ($)" value="${offer?.counterAmount || offer?.amount || ''}"/>
          <button class="btn btn-primary" onclick="sendNegotiationMessage('${productId}', '${offer?.id || ''}')">Enviar</button>
        </div>
        <p class="nego-hint">${msgCount}/${NEGO_MAX_MESSAGES} mensagens · barganha rápida, sem enrolação</p>
      </div>
    ` : limitReached ? `<p class="nego-hint">Limite de mensagens atingido. Aguarde o núcleo GS.</p>` : ''}
    ${offer && status === 'counter' && offer.counterAmount ? `
      <div class="nego-counter-actions">
        <p>Contraproposta do núcleo: <strong>${formatMoney(offer.counterAmount)}</strong></p>
        <button class="btn btn-primary btn-sm" onclick="acceptCounterOffer('${offer.id}')">Aceitar contraproposta</button>
      </div>
    ` : ''}
  `;

  modal.dataset.productId = productId || '';
  modal.dataset.offerId = offer?.id || '';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  const thread = document.getElementById('nego-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function closeNegotiationModal() {
  document.getElementById('nego-modal')?.classList.remove('open');
  if (!state.cartOpen) document.body.style.overflow = '';
}

async function sendNegotiationMessage(productId, offerId) {
  if (!state.user || !state.profile) return;
  const text = (document.getElementById('nego-text')?.value || '').trim().slice(0, 160);
  const amountRaw = document.getElementById('nego-amount')?.value;
  const amount = parseFloat(amountRaw);

  if (!text && (isNaN(amount) || amount <= 0)) {
    showToast('Escreva uma mensagem ou informe um valor.', 'error');
    return;
  }

  const p = state.products[productId];
  const existing = offerId ? (state.offers || []).find(o => o.id === offerId) : null;
  const listPrice = existing?.listPrice != null ? existing.listPrice : Number(p?.price) || 0;

  if (!isNaN(amount) && amount > 0 && amount >= listPrice) {
    showToast('Oferta deve ser menor que o preço de lista.', 'error');
    return;
  }

  const msg = {
    from: 'player',
    text: text || (amount ? `Proposta: ${formatMoney(amount)}` : ''),
    amount: (!isNaN(amount) && amount > 0) ? amount : null,
    createdAt: Date.now()
  };

  try {
    if (existing) {
      const messages = existing.messages || [];
      if (messages.length >= NEGO_MAX_MESSAGES) {
        showToast('Limite de mensagens atingido.', 'error');
        return;
      }
      messages.push(msg);
      const updates = {
        messages,
        status: 'pending',
        updatedAt: Date.now()
      };
      if (msg.amount != null) updates.amount = msg.amount;
      await db.ref('offers/' + existing.id).update(updates);
      showToast('Mensagem enviada ao núcleo GS.');
      openNegotiationModal(productId, existing.id);
    } else {
      if (!p) {
        showToast('Produto não encontrado.', 'error');
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        showToast('Informe um valor na primeira proposta.', 'error');
        return;
      }
      const ref = await db.ref('offers').push({
        userId: state.user.uid,
        userName: state.profile.name,
        productId,
        productName: p.name,
        listPrice: Number(p.price),
        amount,
        status: 'pending',
        messages: [msg],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      pushAdminLog({
        type: 'offer',
        userId: state.user.uid,
        userName: state.profile.name,
        productName: p.name,
        amount
      });
      showToast('Negociação aberta com o núcleo GS.');
      closeProductModal();
      openNegotiationModal(productId, ref.key);
    }
  } catch (e) {
    console.error(e);
    showToast('Erro ao enviar.', 'error');
  }
}

async function acceptCounterOffer(offerId) {
  const offer = (state.offers || []).find(o => o.id === offerId);
  if (!offer || !offer.counterAmount) return;
  const okCounter = await gsConfirm({
    title: 'Contraproposta',
    body: `Aceitar contraproposta de <strong>${formatMoney(offer.counterAmount)}</strong>?<br><span class="text-muted">O núcleo GS ainda confirma a operação.</span>`,
    confirmLabel: 'Aceitar'
  });
  if (!okCounter) return;

  try {
    const messages = offer.messages || [];
    messages.push({
      from: 'player',
      text: 'Aceito a contraproposta.',
      amount: offer.counterAmount,
      createdAt: Date.now()
    });
    await db.ref('offers/' + offerId).update({
      amount: offer.counterAmount,
      messages,
      status: 'pending',
      updatedAt: Date.now()
    });
    showToast('Contraproposta aceita. Aguardando confirmação do núcleo GS.');
    openNegotiationModal(offer.productId, offerId);
  } catch (e) {
    console.error(e);
    showToast('Erro ao aceitar.', 'error');
  }
}

async function adminRespondOffer(offerId, action) {
  const offer = state.offers.find(o => o.id === offerId);
  if (!offer) return;

  if (action === 'reject') {
    const note = prompt('Motivo (opcional, aparece no chat):', '') || '';
    const messages = offer.messages || [];
    messages.push({
      from: 'admin',
      text: note || 'Proposta recusada pelo núcleo GS.',
      amount: null,
      createdAt: Date.now()
    });
    await db.ref('offers/' + offerId).update({
      status: 'rejected',
      messages,
      resolvedAt: Date.now(),
      updatedAt: Date.now()
    });
    showToast('Oferta rejeitada.');
    return;
  }

  if (action === 'accept') {
    const p = state.products[offer.productId];
    if (!p) {
      showToast('Produto sumiu.', 'error');
      return;
    }
    const finalAmount = offer.amount;
    const okOffer = await gsConfirm({
      title: 'Aceitar oferta',
      body: `Aceitar oferta de <strong>${formatMoney(finalAmount)}</strong> de ${escapeHTML(offer.userName || '')} por &quot;${escapeHTML(offer.productName || '')}&quot;?`,
      confirmLabel: 'Aceitar'
    });
    if (!okOffer) return;

    try {
      const userSnap = await db.ref('users/' + offer.userId).once('value');
      const user = userSnap.val();
      if (!user) {
        showToast('Usuário não encontrado.', 'error');
        return;
      }
      const bal = Number(user.balance) || 0;
      if (bal < finalAmount) {
        showToast('Jogador sem saldo para a oferta.', 'error');
        await db.ref('offers/' + offerId).update({ status: 'rejected', note: 'saldo insuficiente', resolvedAt: Date.now() });
        return;
      }

      const delivery = computeDelivery(p);
      const updates = {};
      const newBal = bal - finalAmount;
      updates[`users/${offer.userId}/balance`] = newBal;
      const invKey = generateId();
      updates[`users/${offer.userId}/inventory/${invKey}`] = {
        productId: offer.productId,
        name: p.name,
        price: finalAmount,
        category: p.category,
        image: p.image || '',
        boughtAt: Date.now(),
        status: delivery.status,
        estimatedDelivery: delivery.estimatedDelivery,
        deliveredAt: delivery.deliveredAt,
        statusMessage: STATUS_MESSAGES[delivery.status] || '',
        viaOffer: true
      };
      const ledgerKey = generateId();
      updates[`users/${offer.userId}/ledger/${ledgerKey}`] = {
        type: 'offer',
        amount: -finalAmount,
        balanceAfter: newBal,
        label: `Negociação: ${p.name}`,
        refId: offerId,
        createdAt: Date.now()
      };
      if (p.stock != null) updates[`products/${offer.productId}/stock`] = Math.max(0, (p.stock || 0) - 1);

      const orderId = generateId();
      updates[`orders/${orderId}`] = {
        userId: offer.userId,
        userName: offer.userName,
        productId: offer.productId,
        productName: p.name,
        price: finalAmount,
        unitPrice: finalAmount,
        quantity: 1,
        image: p.image || '',
        category: p.category || '',
        status: delivery.status,
        estimatedDelivery: delivery.estimatedDelivery,
        deliveredAt: delivery.deliveredAt,
        statusMessage: STATUS_MESSAGES[delivery.status] || '',
        viaOffer: true,
        createdAt: Date.now()
      };

      if (delivery.status === 'delivered') {
        updates[`users/${offer.userId}/repSpent`] = (Number(user.repSpent) || 0) + finalAmount;
        updates[`users/${offer.userId}/repOrders`] = (Number(user.repOrders) || 0) + 1;
      }

      const messages = offer.messages || [];
      messages.push({
        from: 'admin',
        text: 'Proposta aceita. Operação processada.',
        amount: finalAmount,
        createdAt: Date.now()
      });
      updates[`offers/${offerId}/status`] = 'accepted';
      updates[`offers/${offerId}/resolvedAt`] = Date.now();
      updates[`offers/${offerId}/messages`] = messages;
      updates[`offers/${offerId}/updatedAt`] = Date.now();

      await db.ref().update(updates);
      pushAdminLog({ type: 'offer_accepted', offerId, userName: offer.userName, amount: finalAmount, productName: p.name });
      showToast('Oferta aceita e compra processada.');
    } catch (e) {
      console.error(e);
      showToast('Erro ao aceitar oferta.', 'error');
    }
    return;
  }

  if (action === 'counter') {
    const raw = prompt('Contraproposta ($):', String(Math.round((offer.amount || 0) * 1.1)));
    if (raw === null) return;
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) {
      showToast('Valor inválido.', 'error');
      return;
    }
    const note = prompt('Mensagem curta (opcional):', 'Contraproposta do núcleo GS.') || 'Contraproposta do núcleo GS.';
    const messages = offer.messages || [];
    messages.push({
      from: 'admin',
      text: note.slice(0, 160),
      amount,
      createdAt: Date.now()
    });
    await db.ref('offers/' + offerId).update({
      status: 'counter',
      counterAmount: amount,
      messages,
      updatedAt: Date.now()
    });
    showToast('Contraproposta enviada.');
  }

  if (action === 'reply') {
    const note = prompt('Mensagem ao jogador (máx 160):', '');
    if (note === null || !note.trim()) return;
    const messages = offer.messages || [];
    if (messages.length >= NEGO_MAX_MESSAGES) {
      showToast('Limite de mensagens.', 'error');
      return;
    }
    messages.push({
      from: 'admin',
      text: note.trim().slice(0, 160),
      amount: null,
      createdAt: Date.now()
    });
    await db.ref('offers/' + offerId).update({
      messages,
      updatedAt: Date.now()
    });
    showToast('Mensagem enviada.');
  }
}

/* ========== EVENTOS TEMPORÁRIOS ========== */

function parseLocalDateTimeInput(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0).getTime();
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function toLocalDateTimeInput(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isEventFlagActive(e) {
  if (e == null) return false;
  if (e.active === false || e.active === 'false' || e.active === 0) return false;
  return true; // true, 'true', undefined, null → ativo
}

function isEventInWindow(e, now = Date.now()) {
  const start = e.startsAt != null ? Number(e.startsAt) : null;
  const end = e.endsAt != null ? Number(e.endsAt) : null;
  if (start && !isNaN(start) && start > now) return false;
  if (end && !isNaN(end) && end < now) return false;
  return true;
}

function getActiveEvents() {
  const now = Date.now();
  return Object.entries(state.events || {})
    .map(([id, e]) => ({ id, ...e }))
    .filter(e => {
      if (!isEventFlagActive(e)) return false;
      // Só usa relógio real se o mestre marcar useRealSchedule
      if (e.useRealSchedule) return isEventInWindow(e, now);
      return true;
    });
}

function getActiveEventTagsForProduct(productId) {
  const tags = [];
  getActiveEvents().forEach(ev => {
    const ids = ev.productIds || [];
    if (ids.includes(productId) || (ev.allProducts && !ids.length)) {
      tags.push({
        id: ev.id,
        label: ev.tagLabel || ev.name || 'Evento',
        color: ev.tagColor || '#e11d48',
        discountPercent: Number(ev.discountPercent) || 0
      });
    }
  });
  return tags;
}

function getEventDiscountForProduct(productId, basePrice) {
  let best = 0;
  getActiveEventTagsForProduct(productId).forEach(t => {
    if (t.discountPercent > best) best = t.discountPercent;
  });
  if (best <= 0) return { discount: 0, final: basePrice, pct: 0 };
  const discount = basePrice * (best / 100);
  return { discount, final: Math.max(0, basePrice - discount), pct: best };
}

function renderEventBanner() {
  const el = document.getElementById('event-banner');
  if (!el) return;
  const active = getActiveEvents();
  if (!active.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  const ev = active[0];
  el.classList.remove('hidden');
  const couponBit = ev.couponCode
    ? `<span class="event-banner-coupon">Cupom <strong>${escapeHTML(ev.couponCode)}</strong>${ev.couponPercent ? ` · −${ev.couponPercent}%` : ''}</span>`
    : '';
  const discBit = ev.discountPercent
    ? `<span class="event-banner-ends">−${ev.discountPercent}% nos itens marcados</span>`
    : '';
  el.innerHTML = `
    <div class="event-banner-inner" style="--event-color:${escapeHTML(ev.tagColor || '#e11d48')}">
      <span class="event-banner-tag">${escapeHTML(ev.tagLabel || ev.name)}</span>
      <span class="event-banner-text">${escapeHTML(ev.bannerText || ev.description || ev.name)}</span>
      ${couponBit}
      ${discBit}
      ${ev.endsLabel ? `<span class="event-banner-ends">até ${escapeHTML(ev.endsLabel)}</span>` : (ev.useRealSchedule && ev.endsAt ? `<span class="event-banner-ends">até ${formatDate(ev.endsAt)}</span>` : '')}
      ${ev.couponCode ? `<button type="button" class="btn btn-ghost btn-sm" onclick="applyEventCoupon('${escapeHTML(ev.couponCode)}')">Aplicar cupom</button>` : ''}
    </div>
  `;
}

function renderAdminEvents() {
  const el = document.getElementById('admin-events-list');
  if (!el) return;
  const list = Object.entries(state.events || {})
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.startsAt || 0) - (a.startsAt || 0));

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">Nenhum evento. Crie a “Semana Nina Riders” ou similar.</div>';
    return;
  }

  const now = Date.now();
  el.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Evento</th><th>Tag</th><th>Período</th><th>Produtos</th><th>Desc.</th><th></th></tr></thead>
    <tbody>
      ${list.map(e => {
        const live = isEventFlagActive(e) && (!e.useRealSchedule || isEventInWindow(e, now));
        return `
          <tr>
            <td>
              <div class="admin-prod-name">${escapeHTML(e.name)}</div>
              <div class="admin-prod-desc">${live ? '● Ao vivo' : 'Inativo / fora da janela'}</div>
            </td>
            <td><span class="event-tag" style="--event-color:${escapeHTML(e.tagColor || '#e11d48')}">${escapeHTML(e.tagLabel || e.name)}</span></td>
            <td style="font-size:11px">${e.startsLabel || e.endsLabel
              ? escapeHTML([e.startsLabel, e.endsLabel].filter(Boolean).join(' → '))
              : (e.useRealSchedule
                ? `<span class="mono">${e.startsAt ? formatDate(e.startsAt) : '—'} → ${e.endsAt ? formatDate(e.endsAt) : '—'}</span>`
                : '<span class="text-muted">manual</span>')}</td>
            <td>${(e.productIds || []).length}</td>
            <td>${e.discountPercent ? e.discountPercent + '%' : '—'}</td>
            <td class="admin-actions-cell">
              ${!live ? `<button class="btn btn-primary btn-sm" onclick="adminActivateEventNow('${e.id}')">Ativar agora</button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="adminEditEvent('${e.id}')">Editar</button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="adminDeleteEvent('${e.id}')">Apagar</button>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody></table></div>`;
}

async function adminSaveEvent(e) {
  e.preventDefault();
  const id = document.getElementById('event-edit-id').value || generateId();
  const name = document.getElementById('event-name').value.trim();
  if (!name) {
    showToast('Nome obrigatório.', 'error');
    return;
  }
  const tagLabel = document.getElementById('event-tag').value.trim() || name;
  const tagColor = document.getElementById('event-color').value || '#e11d48';
  const bannerText = document.getElementById('event-banner-text').value.trim();
  const promoImage = document.getElementById('event-promo-image')?.value.trim() || '';
  const description = document.getElementById('event-desc').value.trim();
  const discountPercent = parseFloat(document.getElementById('event-discount').value) || 0;
  const startsRaw = document.getElementById('event-starts').value;
  const endsRaw = document.getElementById('event-ends').value;
  const productIdsRaw = document.getElementById('event-products').value.trim();
  const productIds = productIdsRaw
    ? productIdsRaw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    : [];
  const active = document.getElementById('event-active').value === 'true';
  const useRealSchedule = document.getElementById('event-use-real')?.value === 'true';
  const startsLabel = (document.getElementById('event-starts-label')?.value || '').trim();
  const endsLabel = (document.getElementById('event-ends-label')?.value || '').trim();
  const autoCoupon = document.getElementById('event-auto-coupon')?.value === 'true';
  let couponCode = (document.getElementById('event-coupon-code')?.value || '').trim().toUpperCase();
  const couponPercent = parseFloat(document.getElementById('event-coupon-percent')?.value) || discountPercent || 0;
  if (autoCoupon && !couponCode) {
    couponCode = (tagLabel || name).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() + String(Math.floor(Math.random()*90)+10);
  }

  let startsAt = null;
  let endsAt = null;
  if (useRealSchedule) {
    startsAt = startsRaw ? parseLocalDateTimeInput(startsRaw) : Date.now();
    endsAt = endsRaw ? parseLocalDateTimeInput(endsRaw) : (Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (!startsAt || isNaN(startsAt)) startsAt = Date.now();
    if (!endsAt || isNaN(endsAt)) endsAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (endsAt < startsAt) endsAt = startsAt + 7 * 24 * 60 * 60 * 1000;
  } else if (startsRaw) {
    startsAt = parseLocalDateTimeInput(startsRaw);
  } else if (endsRaw) {
    endsAt = parseLocalDateTimeInput(endsRaw);
  }

  const data = {
    name,
    tagLabel,
    tagColor,
    bannerText,
    promoImage: promoImage || null,
    description,
    discountPercent,
    productIds,
    active,
    useRealSchedule: !!useRealSchedule,
    startsLabel: startsLabel || null,
    endsLabel: endsLabel || null,
    autoCoupon,
    couponCode: autoCoupon ? couponCode : (couponCode || null),
    couponPercent: autoCoupon ? couponPercent : null,
    startsAt: startsAt || null,
    endsAt: endsAt || null,
    updatedAt: Date.now()
  };
  if (!document.getElementById('event-edit-id').value) {
    data.createdAt = Date.now();
  }

  try {
    await db.ref('events/' + id).update(data);
    if (autoCoupon && couponCode) {
      await db.ref('coupons/' + couponCode).update({
        type: 'percent',
        value: couponPercent || discountPercent || 10,
        expires: endsAt,
        eventId: id,
        label: name,
        maxUses: null,
        uses: (state.coupons?.[couponCode]?.uses) || 0,
        updatedAt: Date.now()
      });
    }
    showToast(autoCoupon && couponCode ? `Evento salvo · cupom ${couponCode}` : 'Evento salvo.');
    if (active) {
      const feedMsg = autoCoupon && couponCode
        ? `${bannerText || name} · use ${couponCode}`
        : (bannerText || `${name} está no ar.`);
      pushFeed(feedMsg, 'admin');
    }
    e.target.reset();
    document.getElementById('event-edit-id').value = '';
    document.getElementById('event-form-title').textContent = 'Novo evento';
    if (document.getElementById('event-auto-coupon')) document.getElementById('event-auto-coupon').value = 'false';
    if (document.getElementById('event-active')) document.getElementById('event-active').value = 'true';
    renderAdminEvents();
    if (typeof renderEventBanner === 'function') renderEventBanner();
    if (typeof renderMarketSidePanels === 'function') renderMarketSidePanels();
    if (state.currentView === 'market' && typeof renderProducts === 'function') renderProducts();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar evento.', 'error');
  }
}

function adminEditEvent(id) {
  const ev = state.events[id];
  if (!ev) return;
  document.getElementById('event-edit-id').value = id;
  document.getElementById('event-name').value = ev.name || '';
  document.getElementById('event-tag').value = ev.tagLabel || '';
  document.getElementById('event-color').value = ev.tagColor || '#e11d48';
  document.getElementById('event-banner-text').value = ev.bannerText || '';
  if (document.getElementById('event-promo-image')) document.getElementById('event-promo-image').value = ev.promoImage || '';
  document.getElementById('event-desc').value = ev.description || '';
  document.getElementById('event-discount').value = ev.discountPercent || 0;
  document.getElementById('event-products').value = (ev.productIds || []).join(', ');
  document.getElementById('event-active').value = ev.active === false ? 'false' : 'true';
  if (document.getElementById('event-use-real')) document.getElementById('event-use-real').value = ev.useRealSchedule ? 'true' : 'false';
  if (document.getElementById('event-starts-label')) document.getElementById('event-starts-label').value = ev.startsLabel || '';
  if (document.getElementById('event-ends-label')) document.getElementById('event-ends-label').value = ev.endsLabel || '';
  if (document.getElementById('event-auto-coupon')) document.getElementById('event-auto-coupon').value = ev.autoCoupon ? 'true' : 'false';
  if (document.getElementById('event-coupon-code')) document.getElementById('event-coupon-code').value = ev.couponCode || '';
  if (document.getElementById('event-coupon-percent')) document.getElementById('event-coupon-percent').value = ev.couponPercent || ev.discountPercent || 0;
  if (document.getElementById('event-starts')) {
    document.getElementById('event-starts').value = toLocalDateTimeInput(ev.startsAt);
  }
  if (document.getElementById('event-ends')) {
    document.getElementById('event-ends').value = toLocalDateTimeInput(ev.endsAt);
  }
  document.getElementById('event-form-title').textContent = 'Editar evento';
  document.getElementById('admin-tab-events')?.scrollIntoView({ behavior: 'smooth' });
}

async function adminActivateEventNow(id) {
  const ev = state.events?.[id];
  if (!ev) return;
  const now = Date.now();
  try {
    await db.ref('events/' + id).update({
      active: true,
      useRealSchedule: false,
      updatedAt: now
    });
    showToast('Evento ativado (controle manual da mesa).');
    if (typeof renderEventBanner === 'function') renderEventBanner();
    if (typeof renderMarketSidePanels === 'function') renderMarketSidePanels();
  } catch (e) {
    console.error(e);
    showToast('Erro ao ativar evento.', 'error');
  }
}

async function adminDeleteEvent(id) {
  const okEv = await gsConfirm({
    title: 'Apagar evento',
    body: 'Apagar este evento? Tags e descontos vinculados somem.',
    confirmLabel: 'Apagar',
    danger: true
  });
  if (!okEv) return;
  try {
    await db.ref('events/' + id).remove();
    showToast('Evento removido.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao apagar.', 'error');
  }
}


async function applyEventCoupon(code) {
  if (!code) return;
  const input = document.getElementById('cart-coupon-input');
  if (input) input.value = code;
  if (typeof applyCartCoupon === 'function') {
    if (!state.cartOpen && typeof openCart === 'function') openCart();
    await applyCartCoupon();
  } else {
    showToast('Abra o carrinho e aplique: ' + code);
  }
}

/* ========== VITRINES / VENDORS (NPC) ========== */

function getVendor(id) {
  if (!id) return null;
  const v = state.vendors?.[id];
  return v ? { id, ...v } : null;
}

function fillVendorSelects() {
  const selects = [
    document.getElementById('admin-product-vendor'),
    document.getElementById('vendor-filter')
  ].filter(Boolean);
  const list = Object.entries(state.vendors || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  selects.forEach(sel => {
    const isFilter = sel.id === 'vendor-filter';
    const cur = sel.value;
    if (isFilter) {
      sel.innerHTML = '<option value="">Todas as vitrines</option>' +
        list.map(v => `<option value="${v.id}">${escapeHTML(v.name)}</option>`).join('');
    } else {
      sel.innerHTML = '<option value="">Global Smith (padrão)</option>' +
        list.map(v => `<option value="${v.id}">${escapeHTML(v.name)}</option>`).join('');
    }
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
  });
}

function renderVendorChips() {
  const el = document.getElementById('vendor-chips');
  if (!el) return;
  const vendors = Object.entries(state.vendors || {}).map(([id, v]) => ({ id, ...v }));
  if (!vendors.length) {
    el.innerHTML = '';
    return;
  }
  const active = state.vendorFilter || '';
  let html = `<button type="button" class="cat-chip ${active === '' ? 'active' : ''}" onclick="selectVendor('')">Todas</button>`;
  vendors.forEach(v => {
    html += `<button type="button" class="cat-chip ${active === v.id ? 'active' : ''}" onclick="selectVendor('${v.id}')">${escapeHTML(v.name)}</button>`;
  });
  el.innerHTML = html;
}

function selectVendor(id) {
  state.vendorFilter = id || '';
  const sel = document.getElementById('vendor-filter');
  if (sel) sel.value = id || '';
  renderVendorChips();
  if (typeof renderProducts === 'function') renderProducts();
}

function renderAdminVendors() {
  const el = document.getElementById('admin-vendors-list');
  if (!el) return;
  const list = Object.entries(state.vendors || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma vitrine. Crie Smith, Courier, Nina Riders…</div>';
    return;
  }
  el.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Vitrine</th><th>Slug</th><th>Tom</th><th></th></tr></thead>
    <tbody>
      ${list.map(v => `
        <tr>
          <td>
            <div class="admin-prod-name">${escapeHTML(v.name)}</div>
            <div class="admin-prod-desc">${escapeHTML(v.tagline || '')}</div>
          </td>
          <td class="mono">${escapeHTML(v.slug || '')}</td>
          <td>${escapeHTML(v.tone || '—')}</td>
          <td class="admin-actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="adminEditVendor('${v.id}')">Editar</button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="adminDeleteVendor('${v.id}')">Apagar</button>
          </td>
        </tr>
      `).join('')}
    </tbody></table></div>`;
}

async function adminSaveVendor(e) {
  e.preventDefault();
  const id = document.getElementById('vendor-edit-id').value || generateId();
  const name = document.getElementById('vendor-name').value.trim();
  if (!name) {
    showToast('Nome obrigatório.', 'error');
    return;
  }
  let slug = (document.getElementById('vendor-slug').value || '').trim().toLowerCase();
  if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tagline = document.getElementById('vendor-tagline').value.trim();
  const tone = document.getElementById('vendor-tone').value.trim();
  const description = document.getElementById('vendor-desc').value.trim();
  const data = {
    name,
    slug,
    tagline,
    tone,
    description,
    updatedAt: Date.now()
  };
  if (!document.getElementById('vendor-edit-id').value) data.createdAt = Date.now();
  try {
    await db.ref('vendors/' + id).update(data);
    showToast('Vitrine salva.');
    e.target.reset();
    document.getElementById('vendor-edit-id').value = '';
    document.getElementById('vendor-form-title').textContent = 'Nova vitrine';
    renderAdminVendors();
    fillVendorSelects();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar vitrine.', 'error');
  }
}

function adminEditVendor(id) {
  const v = state.vendors[id];
  if (!v) return;
  document.getElementById('vendor-edit-id').value = id;
  document.getElementById('vendor-name').value = v.name || '';
  document.getElementById('vendor-slug').value = v.slug || '';
  document.getElementById('vendor-tagline').value = v.tagline || '';
  document.getElementById('vendor-tone').value = v.tone || '';
  document.getElementById('vendor-desc').value = v.description || '';
  document.getElementById('vendor-form-title').textContent = 'Editar vitrine';
}

async function adminDeleteVendor(id) {
  const okVend = await gsConfirm({
    title: 'Apagar vitrine',
    body: 'Apagar esta vitrine?<br><span class="text-muted">Produtos vinculados ficam sem vendedor.</span>',
    confirmLabel: 'Apagar',
    danger: true
  });
  if (!okVend) return;
  try {
    await db.ref('vendors/' + id).remove();
    showToast('Vitrine removida.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao apagar.', 'error');
  }
}

function generateVendorLocal() {
  const idea = (document.getElementById('vendor-ai-idea')?.value || '').trim();
  const tone = (document.getElementById('vendor-ai-tone')?.value || 'premium').trim() || 'premium';
  if (!idea) {
    showToast('Descreva a vitrine (ex: merch Nina Riders).', 'error');
    return;
  }
  const name = idea.replace(/^(loja|vitrine|npc|de|da|do)\s+/i, '').trim();
  const title = name.replace(/\b\w/g, c => c.toUpperCase()).slice(0, 48);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const taglines = {
    premium: 'Qualidade sob contrato GS.',
    underground: 'Longe dos holofotes.',
    show: 'Oficial da turnê.',
    courier: 'Rota rápida, sem perguntas.'
  };
  let tagline = taglines.premium;
  if (/subsolo|ilegal|shadow|negro/i.test(idea + tone)) tagline = taglines.underground;
  else if (/show|tourê|nina|merch|rider/i.test(idea + tone)) tagline = taglines.show;
  else if (/courier|entrega|porto/i.test(idea + tone)) tagline = taglines.courier;
  else if (tone) tagline = `Vitrine ${tone}.`;

  document.getElementById('vendor-name').value = title || 'Nova Vitrine';
  document.getElementById('vendor-slug').value = slug || 'vitrine';
  document.getElementById('vendor-tagline').value = tagline;
  document.getElementById('vendor-tone').value = tone;
  document.getElementById('vendor-desc').value = `${title} opera sob o guarda-chuva Global Smith. ${tagline}`;
  showToast('Vitrine gerada localmente — revise e salve.');
}

async function generateVendorWithAI() {
  const idea = (document.getElementById('vendor-ai-idea')?.value || '').trim();
  const tone = (document.getElementById('vendor-ai-tone')?.value || '').trim() || 'premium corporativo';
  if (!idea) {
    showToast('Descreva a vitrine.', 'error');
    return;
  }
  // Reuse local if no AI module; try window helper from firebase-ai
  if (typeof window.generateVendorWithFirebaseAI === 'function') {
    return window.generateVendorWithFirebaseAI(idea, tone);
  }
  generateVendorLocal();
  showToast('IA de vitrine indisponível — usei gerador local.');
}
