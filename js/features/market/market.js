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

  // Ordem preferencial
  const order = Object.keys(CATEGORY_LABELS);
  order.forEach(key => {
    if (!counts[key]) return;
    html += `
      <button class="cat-chip ${active === key ? 'active' : ''}" data-cat="${key}" onclick="selectCategory('${key}')">
        ${CATEGORY_LABELS[key]} <span class="cat-count">${counts[key]}</span>
      </button>
    `;
  });

  // Categorias extras não listadas
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

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const category = document.getElementById('category-filter')?.value || '';

  // Popula filtro de categorias (select hidden/fallback)
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

  // Ordena: disponíveis primeiro, depois por nome
  products.sort((a, b) => {
    const aOut = (a.stock !== null && a.stock !== undefined && a.stock <= 0) ? 1 : 0;
    const bOut = (b.stock !== null && b.stock !== undefined && b.stock <= 0) ? 1 : 0;
    if (aOut !== bOut) return aOut - bOut;
    return (a.name || '').localeCompare(b.name || '');
  });

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">📦</div>
        <h3>Nenhum produto encontrado</h3>
        <p>${search || category ? 'Tente ajustar a busca ou categoria.' : 'O mercado ainda está vazio. Volte em breve.'}</p>
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

    return `
      <div class="product-card ${isOut ? 'out-of-stock' : ''}">
        ${isOut ? '<div class="stock-badge out">Esgotado</div>' : ''}
        ${!isOut && p.stock !== null && p.stock !== undefined && p.stock <= 5 ? `<div class="stock-badge low">Só ${p.stock}</div>` : ''}
        ${imgHtml}
        <div class="product-body">
          <div class="product-category">${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</div>
          <div class="product-name">${escapeHTML(p.name)}</div>
          <div class="product-desc">${escapeHTML(p.description || '')}</div>
          <div class="product-footer">
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
