const adminCheckedProducts = new Set();
const adminProductFilters = { query: '', category: '', vendor: '', stock: '' };
const adminPendingStatuses = new Set(['in_transit', 'held_customs', 'resent', 'pending']);
const adminEventDeadline = 48 * 60 * 60 * 1000;

function adminIsLowStock(product) {
  return product.stock != null && Number(product.stock) <= 3;
}

function adminIsOverdue(order, now = Date.now()) {
  const due = Number(order.estimatedDelivery);
  return adminPendingStatuses.has(order.status) && due > 0 && due < now;
}

function adminIsEndingSoon(event, now = Date.now()) {
  const remaining = Number(event.endsAt) - now;
  return event.useRealSchedule && isEventFlagActive(event) && isEventInWindow(event, now)
    && remaining > 0 && remaining <= adminEventDeadline;
}

function adminFilterProducts(products, filters) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const query = normalize(filters.query.trim());
  return products.filter(product => {
    const vendor = product.vendorId || '__global';
    const stock = product.stock;
    const matchesStock = !filters.stock || (filters.stock === 'low' && adminIsLowStock(product))
      || (filters.stock === 'out' && stock != null && Number(stock) === 0)
      || (filters.stock === 'unlimited' && stock == null);
    return (!query || normalize([product.name, product.id, product.description].join(' ')).includes(query))
      && (!filters.category || product.category === filters.category) && (!filters.vendor || vendor === filters.vendor) && matchesStock;
  });
}

function renderAdminProducts() {
  const list = document.getElementById('admin-products-list');
  if (!list) return;
  const products = Object.entries(state.products || {}).map(([id, product]) => ({ ...product, id }));
  for (const id of adminCheckedProducts) if (!state.products?.[id]) adminCheckedProducts.delete(id);
  const filters = document.getElementById('admin-catalog-filters');
  if (!filters.dataset.ready) {
    document.getElementById('admin-product-form').originalProduct = adminProductDraft();
    filters.dataset.ready = 'true';
    filters.elements.category.insertAdjacentHTML('beforeend', getCategoryOptions(''));
    filters.addEventListener('submit', event => event.preventDefault());
    filters.addEventListener('input', event => {
      if (!(event.target.name in adminProductFilters)) return;
      adminProductFilters[event.target.name] = event.target.value;
      renderAdminProducts();
    });
    list.addEventListener('change', event => {
      if (!event.target.matches('.admin-product-check')) return;
      if (event.target.checked) adminCheckedProducts.add(event.target.value);
      else adminCheckedProducts.delete(event.target.value);
      adminUpdateSelectedHint();
    });
  }
  const vendorOptions = '<option value="">Todas as vitrines</option><option value="__global">Global Smith</option>' +
    Object.entries(state.vendors || {}).sort(([,a],[,b]) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
      .map(([id, vendor]) => `<option value="${escapeHTML(id)}">${escapeHTML(vendor.name || id)}</option>`).join('');
  const vendorField = filters.elements.vendor;
  if (vendorField.dataset.options !== vendorOptions) {
    vendorField.innerHTML = vendorOptions;
    vendorField.dataset.options = vendorOptions;
    if (![...vendorField.options].some(option => option.value === adminProductFilters.vendor)) adminProductFilters.vendor = '';
  }
  for (const [name, value] of Object.entries(adminProductFilters)) {
    if (filters.elements[name].value !== value) filters.elements[name].value = value;
  }
  const shown = adminFilterProducts(products, adminProductFilters)
    .sort((a,b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  document.getElementById('admin-catalog-count').textContent = `${shown.length} de ${products.length} produtos`;
  list.innerHTML = shown.map(product => {
    const id = escapeHTML(product.id);
    const name = escapeHTML(product.name || product.id);
    const stock = product.stock == null ? 'Ilimitado' : `Estoque: ${escapeHTML(product.stock)}`;
    const vendor = state.vendors?.[product.vendorId]?.name || 'Global Smith';
    return `<div class="admin-catalog-row">
      <input type="checkbox" class="admin-product-check" value="${id}" aria-label="Selecionar ${name}" ${adminCheckedProducts.has(product.id) ? 'checked' : ''}>
      <button type="button" class="admin-catalog-product" data-product="${id}" aria-pressed="${state.editingProductId === product.id}" onclick="adminEditProduct(this.dataset.product)">
        <span class="admin-catalog-thumb">${product.image ? `<img src="${escapeHTML(product.image)}" alt="" loading="lazy">` : ''}</span>
        <span><strong>${name}</strong><small>${escapeHTML(CATEGORY_LABELS[product.category] || product.category || '')} · ${escapeHTML(vendor)}</small><small>${formatMoney(product.price)} · ${stock}</small></span>
      </button>
    </div>`;
  }).join('') || '<p class="empty-state">Nenhum produto encontrado.</p>';
  adminUpdateSelectedHint();
  adminRenderProductPreview();
}

function adminGetSelectedProductIds() {
  return [...adminCheckedProducts].filter(id => state.products?.[id]);
}

function adminToggleAllProductChecks(checked) {
  for (const input of document.querySelectorAll('.admin-product-check')) {
    input.checked = checked;
    if (checked) adminCheckedProducts.add(input.value);
    else adminCheckedProducts.delete(input.value);
  }
  adminUpdateSelectedHint();
}

function adminClearProductSelection() {
  adminCheckedProducts.clear();
  adminToggleAllProductChecks(false);
}

function adminUpdateSelectedHint() {
  const count = adminGetSelectedProductIds().length;
  const master = document.getElementById('admin-products-check-all');
  const visible = [...document.querySelectorAll('.admin-product-check')];
  const checked = visible.filter(input => input.checked).length;
  master.disabled = !visible.length;
  master.checked = !!visible.length && checked === visible.length;
  master.indeterminate = checked > 0 && checked < visible.length;
  document.getElementById('admin-products-selected-hint').textContent = `${count} selecionado(s)`;
  document.getElementById('admin-product-batch').disabled = !count;
}

function adminProductDraft() {
  const value = name => document.getElementById('admin-product-' + name).value.trim();
  return { name:value('name'), description:value('desc'), price:parseFloat(value('price')), category:value('category'), image:value('image'),
    stock:value('stock') === '' ? null : parseInt(value('stock'), 10), deliveryDays:Math.max(0, parseInt(value('delivery'), 10) || 0),
    secretRank:value('secret') || null, vendorId:value('vendor') || null };
}

function adminRenderProductPreview() {
  const panel = document.getElementById('admin-product-preview');
  if (!panel) return;
  const draft = adminProductDraft();
  const product = { ...draft, id:state.editingProductId || '', name:draft.name || 'Nome do produto',
    price:Number.isFinite(draft.price) ? draft.price : 0 };
  const mark = JSON.stringify([product, state.vendors?.[product.vendorId]?.name]);
  if (panel.previewMark === mark && panel.previewEvents === state.events) return;
  panel.previewMark = mark;
  panel.previewEvents = state.events;
  panel.innerHTML = productCardHTML(product, {dark:product.category === 'ilegais'});
  panel.querySelector('.product-card').removeAttribute('onclick');
  panel.querySelector('.product-footer').removeAttribute('onclick');
  for (const button of panel.querySelectorAll('button')) {
    button.removeAttribute('onclick');
    button.disabled = true;
  }
}

function adminUpdateProductActions() {
  const actions = document.getElementById('admin-current-product-actions');
  actions.hidden = !state.editingProductId;
  actions.querySelector('code').textContent = state.editingProductId || '';
  for (const row of document.querySelectorAll('.admin-catalog-product')) row.setAttribute('aria-pressed', String(row.dataset.product === state.editingProductId));
  adminRenderProductPreview();
}

function adminOpenQueue(tab, filter) {
  if (tab === 'products') Object.assign(adminProductFilters, {query:'', category:'', vendor:'', stock:filter});
  if (tab === 'orders') state._adminOrderFilter = filter;
  if (tab === 'events') state._adminEventFilter = filter;
  switchAdminTab(tab);
}

function adminRenderQueues() {
  const panel = document.getElementById('mesa-queues');
  if (!panel) return;
  const now = Date.now();
  const queues = [
    ['orders', 'overdue', 'Entregas atrasadas', (state.allOrders || []).filter(order => adminIsOverdue(order, now)).length],
    ['products', 'low', 'Estoque baixo ou zerado', Object.values(state.products || {}).filter(adminIsLowStock).length],
    ['events', 'ending', 'Eventos acabam em até 48 h', Object.values(state.events || {}).filter(event => adminIsEndingSoon(event, now)).length]
  ];
  panel.innerHTML = queues.map(([tab, filter, title, count]) => `<button type="button" class="mesa-queue" onclick="adminOpenQueue('${tab}','${filter}')"><strong>${count}</strong><span>${title}</span></button>`).join('');
}

function adminRefreshMesaIfVisible() {
  const mesa = document.getElementById('admin-tab-mesa');
  if (state.currentView === 'admin' && mesa && !mesa.classList.contains('hidden')) renderAdminMesa();
}

function adminBuildBatchRows(ids, products, kind, value, event) {
  return ids.filter(id => products[id]).map(id => {
    const product = products[id];
    if (kind === 'stock') {
      const before = product.stock == null ? null : Number(product.stock);
      return {id, product, before, after:before == null ? null : before + Number(value), changed:value > 0 && before != null && Number.isFinite(before)};
    }
    if (kind === 'category') return {id, product, before:product.category, after:value, changed:!!value && product.category !== value};
    const attached = !!event && ((event.productIds || []).includes(id) || (event.allProducts && !(event.productIds || []).length));
    return {id, product, attached, changed:!!event && !attached};
  });
}

function adminOpenProductBatch() {
  const ids = adminGetSelectedProductIds();
  if (!ids.length) return;
  const dialog = document.getElementById('admin-batch-dialog');
  const form = dialog.querySelector('form');
  const fields = form.elements;
  const kind = fields.operation;
  form.reset();
  fields.category.innerHTML = '<option value="">Selecione</option>' + getCategoryOptions('');
  fields.event.innerHTML = '<option value="">Selecione</option>' + Object.entries(state.events || {})
    .map(([id, event]) => `<option value="${escapeHTML(id)}">${escapeHTML(event.name || id)}</option>`).join('');
  const getValue = () => ({stock:Number(fields.amount.value), category:fields.category.value, event:fields.event.value})[kind.value];
  let applying = false;
  const reveal = () => {
    const value = getValue();
    const event = state.events?.[value];
    const rows = adminBuildBatchRows(ids, state.products, kind.value, value, event);
    for (const field of dialog.querySelectorAll('[data-batch-field]')) field.hidden = field.dataset.batchField !== kind.value;
    const impacts = rows.filter(row => row.changed).length;
    dialog.querySelector('#admin-batch-summary').textContent = `${impacts} produto(s) serão alterados de ${ids.length} selecionados.`;
    dialog.querySelector('#admin-batch-preview').innerHTML = rows.map(row => {
      const category = name => escapeHTML(CATEGORY_LABELS[name] || name || 'Sem categoria');
      const impact = kind.value === 'stock' ? (row.before == null ? 'Estoque ilimitado · sem alteração' : `${row.before} → ${row.after}`)
        : kind.value === 'category' ? `${category(row.before)} → ${row.after ? category(row.after) : '—'}`
        : row.attached ? 'Já está no evento' : event ? `Vincular a ${escapeHTML(event.name || value)}` : 'Selecione um evento';
      return `<li><span>${escapeHTML(row.product.name || row.id)}</span><span>${impact}</span></li>`;
    }).join('');
    const valid = kind.value !== 'stock' || (Number.isSafeInteger(value) && value > 0 && value <= 999999);
    fields.apply.disabled = applying || !valid || !impacts;
  };
  form.oninput = reveal;
  dialog.oncancel = event => { if (applying) event.preventDefault(); };
  fields.closeBatch.onclick = () => dialog.close();
  form.onsubmit = async event => {
    event.preventDefault();
    if (applying || fields.apply.disabled) return;
    const operation = kind.value, value = getValue(), stamp = Date.now();
    applying = true;
    for (const element of form.elements) element.disabled = true;
    try {
      let result;
      if (operation === 'event') {
        const products = (await db.ref('products').once('value')).val() || {};
        const availableIds = ids.filter(id => products[id]);
        const ref = db.ref('events/' + value);
        await ref.once('value');
        result = await ref.transaction(current => {
          if (!current) return;
          const saved = current.productIds || [];
          if (current.allProducts && !saved.length) return;
          const merged = [...new Set([...saved, ...availableIds])];
          if (merged.length === saved.length) return;
          return { ...current, productIds:merged, updatedAt:stamp };
        }, undefined, false);
      } else {
        const ref = db.ref('products');
        await ref.once('value');
        result = await ref.transaction(current => {
          if (!current) return;
          const changed = adminBuildBatchRows(ids, current, operation, value).filter(row => row.changed);
          if (!changed.length) return;
          const next = { ...current };
          for (const row of changed) next[row.id] = { ...row.product, [operation]:row.after, updatedAt:stamp };
          return next;
        }, undefined, false);
      }
      if (!result.committed) {
        showToast('Nenhum produto foi alterado. Confira a seleção e tente novamente.', 'info');
        return;
      }
      dialog.close();
      adminClearProductSelection();
      showToast('Alterações em lote aplicadas.');
    } catch (error) {
      console.error(error);
      showToast('Erro ao aplicar alterações em lote.', 'error');
    } finally {
      applying = false;
      for (const element of form.elements) element.disabled = false;
      reveal();
    }
  };
  reveal();
  dialog.showModal();
}
