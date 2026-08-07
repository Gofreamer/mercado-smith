/* Global Smith — Market */

function renderCategoryChips() {
  const container = document.getElementById('category-chips');
  if (!container) return;

  const counts = {};
  let total = 0;
  Object.values(state.products).forEach(p => {
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

  Object.keys(CATEGORY_LABELS).forEach(key => {
    if (!counts[key]) return;
    html += `
      <button class="cat-chip ${active === key ? 'active' : ''}" data-cat="${key}" onclick="selectCategory('${key}')">
        ${CATEGORY_LABELS[key]} <span class="cat-count">${counts[key]}</span>
      </button>
    `;
  });

  Object.keys(counts).forEach(key => {
    if (CATEGORY_LABELS[key]) return;
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

function getFilteredProducts() {
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const category = document.getElementById('category-filter')?.value || '';

  let products = Object.entries(state.products).map(([id, p]) => ({ id, ...p }));

  if (search) {
    products = products.filter(p =>
      (p.name || '').toLowerCase().includes(search) ||
      (p.description || '').toLowerCase().includes(search)
    );
  }
  if (category) {
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

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const select = document.getElementById('category-filter');
  if (select && select.options.length <= 1) {
    Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      select.appendChild(opt);
    });
  }

  renderCategoryChips();

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

  grid.innerHTML = products.map(p => {
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

    return `
      <div class="product-card ${isOut ? 'out-of-stock' : ''}" onclick="openProductModal('${p.id}')">
        ${isOut ? '<div class="stock-badge out">Esgotado</div>' : ''}
        ${!isOut && p.stock !== null && p.stock !== undefined && p.stock <= 5 ? `<div class="stock-badge low">Só ${p.stock}</div>` : ''}
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
  }).join('');
}

function filterProducts() {
  renderProducts();
}

/* ========== PRODUCT MODAL ========== */

function openProductModal(productId) {
  const p = state.products[productId];
  if (!p) return;

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

  body.innerHTML = `
    <div class="modal-product-layout">
      <div class="modal-product-media">${img}</div>
      <div class="modal-product-info">
        <div class="product-category">${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</div>
        <h2 class="modal-product-name">${escapeHTML(p.name)}</h2>
        <div class="modal-product-price">${formatMoney(p.price)}</div>
        <p class="modal-product-desc">${escapeHTML(p.description || 'Sem descrição.')}</p>
        <div class="modal-meta">
          <span>${stockText}</span>
          <span>${deliveryText}</span>
        </div>
        <div class="modal-actions">
          ${isOut
            ? `<button class="btn btn-secondary" disabled>Esgotado</button>`
            : `
              <button class="btn btn-ghost" onclick="addToCart('${p.id}'); closeProductModal();">Adicionar ao carrinho</button>
              <button class="btn btn-primary" onclick="buyProduct('${p.id}'); closeProductModal();">Comprar agora</button>
            `
          }
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
