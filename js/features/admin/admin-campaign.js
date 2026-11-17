function readAdminProductIds(value) {
  return [...new Set(String(value || '').split(/[\s,]+/).filter(Boolean))];
}

function renderAdminProductPicker(kind) {
  const root = document.getElementById(`${kind}-product-picker`);
  const field = document.getElementById(`${kind}-products`);
  if (!root || !field) return;
  if (!root.dataset.ready) {
    root.dataset.ready = 'true';
    root.innerHTML = `<label>Buscar no catálogo<input type="search" class="search-input" placeholder="Nome ou ID"></label><div data-picker-rows></div>`;
    root.querySelector('input').addEventListener('input', () => renderAdminProductPicker(kind));
    root.addEventListener('change', event => {
      const input = event.target;
      if (!input.matches('input[data-choice]')) return;
      const selected = new Set(readAdminProductIds(field.value));
      if (input.checked) selected.add(input.value); else selected.delete(input.value);
      field.value = [...selected].join(', ');
      if (kind === 'event') renderAdminEventPreview();
      if (kind === 'vendor') renderAdminVendorPreview();
      root.querySelector('[data-picker-count]').textContent = `${selected.size} selecionado(s)`;
    });
  }
  const selected = new Set(readAdminProductIds(field.value));
  const q = root.querySelector('input').value.trim().toLocaleLowerCase('pt-BR');
  const list = Object.entries(state.products || {}).filter(([id,p]) => `${p.name || ''} ${id}`.toLocaleLowerCase('pt-BR').includes(q));
  root.querySelector('[data-picker-rows]').innerHTML = `<p class="text-muted" data-picker-count>${selected.size} selecionado(s)</p><div class="admin-campaign-picker-list">${list.map(([id,p]) => `<label class="admin-campaign-choice"><input type="checkbox" data-choice value="${escapeHTML(id)}" ${selected.has(id) ? 'checked' : ''}><span class="admin-catalog-thumb">${p.image ? `<img src="${escapeHTML(p.image)}" alt="" loading="lazy">` : ''}</span><span>${escapeHTML(p.name || id)}</span></label>`).join('') || '<p class="text-muted">Nenhum produto.</p>'}</div>`;
}

function renderAdminEventPreview() {
  const panel = document.getElementById('admin-event-preview');
  if (!panel) return;
  const value = id => document.getElementById('event-' + id)?.value || '';
  const name = value('name') || 'Nome do evento';
  const tag = value('tag') || name;
  const color = /^#[a-f\d]{6}$/i.test(value('color')) ? value('color') : '#e11d48';
  const percent = Math.max(0, Math.min(100, Number(value('discount')) || 0));
  const clock = value('use-real') === 'true';
  const starts = value('starts'), ends = value('ends');
  const timing = clock ? [starts ? formatDateTime(parseLocalDateTimeInput(starts)) : 'Ao salvar', ends ? formatDateTime(parseLocalDateTimeInput(ends)) : '7 dias após salvar'].join(' → ')
    : [value('starts-label'), value('ends-label')].filter(Boolean).join(' → ') || 'Ativação manual';
  const ids = readAdminProductIds(value('products'));
  const existing = state.events?.[value('edit-id')];
  const global = existing?.allProducts && !ids.length;
  const chosen = (global ? Object.keys(state.products || {}) : ids).map(id => state.products?.[id]).filter(Boolean);
  panel.innerHTML = `<span class="event-tag" style="--event-color:${color}">${escapeHTML(tag)}</span><p><strong>${escapeHTML(timing)}</strong>${value('active') === 'false' ? ' · Inativo' : ''}</p>
    <p class="text-muted">${percent}% de desconto · ${global ? 'Loja inteira' : `${chosen.length} produto(s) no evento`}</p>
    ${chosen.slice(0,4).map(product => `<p>${escapeHTML(product.name)} · ${formatMoney(product.price)} → ${formatMoney((Number(product.price) || 0) * (1 - percent/100))}</p>`).join('')}`;
}

function adminCouponStatus(coupon, now = Date.now()) {
  if (coupon.expires && Number(coupon.expires) < now) return 'expired';
  if (coupon.startsAt && Number(coupon.startsAt) > now) return 'scheduled';
  if (coupon.maxUses != null && (Number(coupon.uses) || 0) >= Number(coupon.maxUses)) return 'used';
  return 'active';
}

function renderAdminCoupons() {
  const panel = document.getElementById('admin-coupons-list');
  if (!panel) return;
  renderAdminProductPicker('coupon');
  const labels = {active:'Ativo',scheduled:'Agendado',expired:'Expirado',used:'Esgotado'};
  const mode = state._adminCouponFilter || '';
  const now = Date.now();
  const rows = Object.entries(state.coupons || {}).map(([code,coupon]) => ({...coupon,code,status:adminCouponStatus(coupon, now)}))
    .filter(coupon => !mode || coupon.status === mode);
  panel.innerHTML = `<div class="admin-queue-filter"><label>Mostrar <select class="select" onchange="state._adminCouponFilter=this.value;renderAdminCoupons()"><option value="">Todos</option>${Object.entries(labels).map(([id,label]) => `<option value="${id}" ${id === mode ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
    ${rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Código</th><th>Status</th><th>Desconto</th><th>Usos restantes</th><th>Produtos</th><th></th></tr></thead><tbody>
      ${rows.map(coupon => {
        const ids = coupon.productIds || [];
        const names = ids.map(id => state.products?.[id]?.name || id);
        const remaining = coupon.maxUses == null ? 'Ilimitado' : Math.max(0, Number(coupon.maxUses) - (Number(coupon.uses) || 0));
        return `<tr><td><strong>${escapeHTML(coupon.code)}</strong><small>${coupon.minRank ? ` · ${escapeHTML(coupon.minRank)}+` : ''}</small></td>
          <td>${labels[coupon.status]}${coupon.startsAt ? `<br><small>Desde ${formatDateTime(coupon.startsAt)}</small>` : ''}${coupon.expires ? `<br><small>Até ${formatDateTime(coupon.expires)}</small>` : ''}</td>
          <td>${coupon.type === 'percent' ? `${Number(coupon.value) || 0}%` : formatMoney(coupon.value)}</td><td>${remaining}</td>
          <td>${ids.length ? `<details><summary>${ids.length} produto(s)</summary>${names.map(name => `<div>${escapeHTML(name)}</div>`).join('')}</details>` : 'Loja inteira'}</td>
          <td><button type="button" class="btn btn-ghost btn-sm text-danger" data-code="${escapeHTML(coupon.code)}" onclick="adminDeleteCoupon(this.dataset.code)">Apagar</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="empty-state">Nenhum cupom neste filtro.</p>'}`;
}

function renderAdminVendorPreview() {
  const panel = document.getElementById('admin-vendor-preview');
  if (!panel) return;
  const value = key => document.getElementById('vendor-' + key).value.trim();
  const id = value('edit-id');
  const count = id ? readAdminProductIds(value('products')).length : 0;
  panel.innerHTML = `<strong>${escapeHTML(value('name') || 'Nome da vitrine')}</strong><p>${escapeHTML(value('tagline'))}</p><small class="text-muted">${count} produto(s) na seleção</small>`;
}

function adminLoadVendorProducts(id, products = state.products) {
  const editor = document.getElementById('vendor-product-controls');
  const field = document.getElementById('vendor-products');
  editor.hidden = !id;
  field.baseline = new Set(id ? Object.entries(products || {}).filter(([,p]) => p.vendorId === id).map(([key]) => key) : []);
  field.value = [...field.baseline].join(', ');
  if (id) renderAdminProductPicker('vendor');
  renderAdminVendorPreview();
}

async function adminApplyVendorProducts() {
  const field = document.getElementById('vendor-products');
  const vendor = document.getElementById('vendor-edit-id');
  const id = vendor.value;
  if (!id || !field.baseline || !state.vendors?.[id]) return;
  const selected = new Set(readAdminProductIds(field.value));
  const add = [...selected].filter(key => !field.baseline.has(key) && state.products?.[key]).map(key => ({key, before:state.products[key].vendorId || null}));
  const remove = [...field.baseline].filter(key => !selected.has(key));
  if (!add.length && !remove.length) return showToast('Nenhum vínculo para alterar.', 'info');
  const moved = add.filter(row => row.before && row.before !== id).length;
  const ok = await gsConfirm({title:'Atualizar produtos da vitrine', body:`Vincular <strong>${add.length}</strong> e retirar <strong>${remove.length}</strong> produto(s).${moved ? `<br>${moved} produto(s) serão movidos de outra vitrine.` : ''}`, confirmLabel:'Aplicar vínculos'});
  if (!ok || id !== vendor.value) return;
  const button = document.getElementById('vendor-products-apply');
  button.disabled = true;
  try {
    const ref = db.ref('products'), stamp = Date.now();
    await ref.once('value');
    const result = await ref.transaction(current => {
      if (!current || add.some(row => !current[row.key] || (current[row.key].vendorId || null) !== row.before)
        || remove.some(key => current[key]?.vendorId !== id)) return;
      const next = {...current};
      for (const {key} of add) next[key] = {...current[key], vendorId:id, updatedAt:stamp};
      for (const key of remove) next[key] = {...current[key], vendorId:null, updatedAt:stamp};
      return next;
    }, undefined, false);
    if (result.committed && id === vendor.value) adminLoadVendorProducts(id, result.snapshot.val());
    showToast(result.committed ? 'Vitrine atualizada.' : 'Houve mudanças no catálogo. Reabra a vitrine e confira os produtos.');
  } catch (error) { showToast('Não foi possível atualizar os vínculos.', 'error'); }
  finally { button.disabled = false; }
}

function adminViewVendorCatalog(id) {
  Object.assign(adminProductFilters, {query:'', category:'', vendor:id, stock:''});
  switchAdminTab('products');
}
