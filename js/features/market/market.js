/* Global Smith — Market */

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const category = document.getElementById('category-filter')?.value || '';

  // Popula filtro de categorias
  const select = document.getElementById('category-filter');
  if (select && select.options.length <= 1) {
    Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      select.appendChild(opt);
    });
  }

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

  // Ordena por nome
  products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state">Nenhum produto encontrado.</div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const stockText = (p.stock === null || p.stock === undefined)
      ? 'Ilimitado'
      : (p.stock > 0 ? `${p.stock} em estoque` : 'Esgotado');

    const imgHtml = p.image
      ? `<img class="product-image" src="${escapeHTML(p.image)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
         <div class="product-image-placeholder" style="display:none">Sem imagem</div>`
      : `<div class="product-image-placeholder">Sem imagem</div>`;

    const canBuy = (p.stock === null || p.stock === undefined || p.stock > 0);

    return `
      <div class="product-card">
        ${imgHtml}
        <div class="product-body">
          <div class="product-category">${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</div>
          <div class="product-name">${escapeHTML(p.name)}</div>
          <div class="product-desc">${escapeHTML(p.description || '')}</div>
          <div class="product-footer">
            <div>
              <div class="product-price">${formatMoney(p.price)}</div>
              <div class="product-stock">${stockText}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="buyProduct('${p.id}')" ${canBuy ? '' : 'disabled'}>
              Comprar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterProducts() {
  renderProducts();
}
