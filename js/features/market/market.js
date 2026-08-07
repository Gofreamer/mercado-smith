/* Global Smith — Market */

function isPublicProduct(p) {
  if (!p) return false;
  if (p.category === 'ilegais') return false;
  if (p.secretRank && !canSeeSecret(p)) return false;
  return true;
}

function renderCategoryChips() {
  const container = document.getElementById('category-chips');
  if (!container) return;

  const counts = {};
  let total = 0;
  Object.values(state.products).forEach(p => {
    if (!isPublicProduct(p)) return;
    const cat = p.category || 'outros';
    counts[cat] = (counts[cat] || 0) + 1;
    total++;
  });

  const active = document.getElementById('category-filter')?.value || '';

  let html = `
    <button class="cat-chip ${active === '' ? 'active' : ''}" data-cat="" onclick="selectCategory('')">
      Todos <span class="cat-count">${total}</span>
    </button>
  `;

  PUBLIC_CATEGORIES.forEach(key => {
    if (!counts[key]) return;
    html += `
      <button class="cat-chip ${active === key ? 'active' : ''}" data-cat="${key}" onclick="selectCategory('${key}')">
        ${CATEGORY_LABELS[key]} <span class="cat-count">${counts[key]}</span>
      </button>
    `;
  });

  Object.keys(counts).forEach(key => {
    if (CATEGORY_LABELS[key] || key === 'ilegais') return;
    html += `
      <button class="cat-chip ${active === key ? 'active' : ''}" data-cat="${key}" onclick="selectCategory('${key}')">
        ${escapeHTML(key)} <span class="cat-count">${counts[key]}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectCategory(cat) {
  const select = document.getElementById('category-filter');
  if (select) select.value = cat;
  renderProducts();
  renderCategoryChips();
}

function setSort(value) {
  state.sortBy = value;
  renderProducts();
}

function getFilteredProducts(opts = {}) {
  const search = (document.getElementById(opts.searchId || 'search-input')?.value || '').toLowerCase();
  const category = document.getElementById(opts.categoryId || 'category-filter')?.value || '';
  const blackOnly = !!opts.blackOnly;

  let products = Object.entries(state.products).map(([id, p]) => ({ id, ...p }));

  if (blackOnly) {
    products = products.filter(p => p.category === 'ilegais');
  } else {
    products = products.filter(p => isPublicProduct(p));
  }

  if (search) {
    products = products.filter(p =>
      (p.name || '').toLowerCase().includes(search) ||
      (p.description || '').toLowerCase().includes(search)
    );
  }
  if (category && !blackOnly) {
    products = products.filter(p => p.category === category);
  }

  products.sort((a, b) => {
    const aOut = (a.stock !== null && a.stock !== undefined && a.stock <= 0) ? 1 : 0;
    const bOut = (b.stock !== null && b.stock !== undefined && b.stock <= 0) ? 1 : 0;
    if (aOut !== bOut) return aOut - bOut;

    switch (state.sortBy) {
      case 'price-asc': return (a.price || 0) - (b.price || 0);
      case 'price-desc': return (b.price || 0) - (a.price || 0);
      case 'newest': return (b.createdAt || 0) - (a.createdAt || 0);
      default: return (a.name || '').localeCompare(b.name || '');
    }
  });

  return products;
}

function productCardHTML(p, opts = {}) {
  const isOut = (p.stock !== null && p.stock !== undefined && p.stock <= 0);
  const stockText = (p.stock === null || p.stock === undefined)
    ? 'Ilimitado'
    : (p.stock > 0 ? `${p.stock} em estoque` : 'Esgotado');

  const imgHtml = p.image
    ? `<img class="product-image" src="${escapeHTML(p.image)}" alt="" loading="lazy"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
       <div class="product-image-placeholder" style="display:none">Sem imagem</div>`
    : `<div class="product-image-placeholder">Sem imagem</div>`;

  const inCart = state.cart[p.id]?.qty || 0;
  const deliveryText = p.deliveryDays > 0
    ? `Chega em ~${p.deliveryDays}d`
    : 'Entrega imediata';

  const wished = !!(state.wishlist && state.wishlist[p.id]);
  const secretBadge = p.secretRank
    ? `<div class="stock-badge secret">Secreto · ${RANK_THRESHOLDS.find(r => r.id === p.secretRank)?.label || p.secretRank}</div>`
    : '';
  const illegalBadge = p.category === 'ilegais'
    ? `<div class="stock-badge illegal">Irregular</div>`
    : '';

  const cardClass = [
    'product-card',
    isOut ? 'out-of-stock' : '',
    opts.dark ? 'product-card-dark' : '',
    p.secretRank ? 'product-card-secret' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="${cardClass}" onclick="openProductModal('${p.id}')">
      ${isOut ? '<div class="stock-badge out">Esgotado</div>' : ''}
      ${!isOut && p.stock !== null && p.stock !== undefined && p.stock <= 5 ? `<div class="stock-badge low">Só ${p.stock}</div>` : ''}
      ${secretBadge}${illegalBadge}
      ${imgHtml}
      <div class="product-body">
        <div class="product-category">${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</div>
        <div class="product-name">${escapeHTML(p.name)}</div>
        <div class="product-desc">${escapeHTML(p.description || '')}</div>
        <div class="product-delivery">${deliveryText}</div>
        <div class="product-footer" onclick="event.stopPropagation()">
          <div>
            <div class="product-price">${formatMoney(p.price)}</div>
            <div class="product-stock ${isOut ? 'text-danger' : ''}">${stockText}</div>
          </div>
          <div class="product-actions">
            <button class="btn btn-ghost btn-sm btn-icon ${wished ? 'wished' : ''}" onclick="toggleWishlist('${p.id}')" title="Lista de desejos">
              ${wished ? '★' : '☆'}
            </button>
            ${isOut
              ? `<button class="btn btn-secondary btn-sm" disabled>Esgotado</button>`
              : `
                <button class="btn btn-ghost btn-sm btn-icon" onclick="addToCart('${p.id}')" title="Adicionar ao carrinho">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  ${inCart > 0 ? `<span class="in-cart-dot">${inCart}</span>` : ''}
                </button>
                <button class="btn btn-primary btn-sm" onclick="buyProduct('${p.id}')">Comprar</button>
              `
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const select = document.getElementById('category-filter');
  if (select && select.options.length <= 1) {
    PUBLIC_CATEGORIES.forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = CATEGORY_LABELS[key];
      select.appendChild(opt);
    });
  }

  renderCategoryChips();
  renderMarketFeed();

  const products = getFilteredProducts();

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">📦</div>
        <h3>Nenhum produto encontrado</h3>
        <p>Tente ajustar a busca, categoria ou ordenação.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(p => productCardHTML(p)).join('');
}

function filterProducts() {
  renderProducts();
}

function renderMarketFeed() {
  const el = document.getElementById('market-feed');
  if (!el) return;
  const items = (state.feed || []).slice(0, 6);
  if (!items.length) {
    el.innerHTML = `<div class="feed-empty">Mercado em silêncio... por enquanto.</div>`;
    return;
  }
  el.innerHTML = items.map(e => `
    <div class="feed-item feed-${escapeHTML(e.type || 'info')}">
      <span class="feed-time">${timeAgo(e.createdAt)}</span>
      <span class="feed-text">${escapeHTML(e.text)}</span>
    </div>
  `).join('');
}

/* ========== PRODUCT MODAL ========== */

function openProductModal(productId) {
  const p = state.products[productId];
  if (!p) return;

  if (p.category === 'ilegais' && !hasBlackMarketAccess()) {
    showToast('Acesso ao Subsolo negado.', 'error');
    return;
  }
  if (p.secretRank && !canSeeSecret(p) && !state.profile?.isAdmin) {
    showToast('Item secreto — rank insuficiente.', 'error');
    return;
  }

  const modal = document.getElementById('product-modal');
  const body = document.getElementById('product-modal-body');
  if (!modal || !body) return;

  const isOut = (p.stock !== null && p.stock !== undefined && p.stock <= 0);
  const stockText = (p.stock === null || p.stock === undefined)
    ? 'Estoque ilimitado'
    : (p.stock > 0 ? `${p.stock} em estoque` : 'Esgotado');

  const deliveryText = p.deliveryDays > 0
    ? `Previsão de entrega: ~${p.deliveryDays} dia(s)`
    : 'Entrega imediata após a compra';

  const img = p.image
    ? `<img class="modal-product-img" src="${escapeHTML(p.image)}" alt="" onerror="this.style.display='none'"/>`
    : `<div class="modal-product-img placeholder">Sem imagem</div>`;

  const wished = !!(state.wishlist && state.wishlist[p.id]);
  const canOffer = canNegotiate() && !isOut && Number(p.price) >= 10000;

  body.innerHTML = `
    <div class="modal-product-layout">
      <div class="modal-product-media">${img}</div>
      <div class="modal-product-info">
        <div class="product-category">${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</div>
        <h2 class="modal-product-name">${escapeHTML(p.name)}</h2>
        <div class="modal-product-price">${formatMoney(p.price)}</div>
        <p class="modal-product-desc">${escapeHTML(p.description || 'Sem descrição.')}</p>
        ${p.secretRank ? `<p class="modal-secret">🔒 Rank mínimo: ${RANK_THRESHOLDS.find(r => r.id === p.secretRank)?.label || p.secretRank}</p>` : ''}
        ${p.category === 'ilegais' ? `<p class="modal-illegal">⚠ Aquisição irregular — sem suporte oficial.</p>` : ''}
        <div class="modal-meta">
          <span>${stockText}</span>
          <span>${deliveryText}</span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="toggleWishlist('${p.id}'); openProductModal('${p.id}')">${wished ? '★ Nos desejos' : '☆ Desejar'}</button>
          ${isOut
            ? `<button class="btn btn-secondary" disabled>Esgotado</button>`
            : `
              <button class="btn btn-ghost" onclick="addToCart('${p.id}'); closeProductModal();">Adicionar ao carrinho</button>
              <button class="btn btn-primary" onclick="buyProduct('${p.id}'); closeProductModal();">Comprar agora</button>
            `
          }
          ${canOffer ? `<button class="btn btn-ghost" onclick="submitOffer('${p.id}')">Fazer oferta</button>` : ''}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  document.getElementById('product-modal')?.classList.remove('open');
  if (!state.cartOpen) document.body.style.overflow = '';
}

/* ========== BLACK MARKET ========== */

function renderBlackMarket() {
  const grid = document.getElementById('bm-products-grid');
  if (!grid) return;

  if (!hasBlackMarketAccess()) {
    grid.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">🔒</div>
        <h3>Acesso negado</h3>
        <p>Este setor não existe nos registros oficiais.</p>
      </div>
    `;
    return;
  }

  const products = getFilteredProducts({
    blackOnly: true,
    searchId: 'bm-search-input'
  });

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">🌑</div>
        <h3>Nada em estoque no subsolo</h3>
        <p>Volte mais tarde. Ou não.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(p => productCardHTML(p, { dark: true })).join('');
}

function filterBlackMarket() {
  renderBlackMarket();
}
