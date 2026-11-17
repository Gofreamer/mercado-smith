const adminOrderModes = {open:'Em aberto', overdue:'Atrasados', in_transit:'Em trânsito', held_customs:'Retidos', resent:'Reenviados', lost:'Extraviados', history:'Histórico', archived:'Arquivados'};
const adminOpenStatuses = ['in_transit','held_customs','resent','lost','pending'];
const adminOrderPageSize = 25;
const adminHistory = { rows:[], cursor:null, next:false, busy:false, token:0 };
const adminActiveOrderStreams = new Map();
let adminOrderDetailId = null;

function adminOrdersFromSnapshot(snapshot) {
  const rows = [];
  snapshot.forEach(child => { rows.push({ ...child.val(), id:child.key }); });
  return rows;
}

function listenAdminOpenOrders() {
  if (adminActiveOrderStreams.size) return;
  for (const status of adminOpenStatuses) {
    const query = db.ref('orders').orderByChild('status').equalTo(status);
    const stream = { query, rows:[] };
    adminActiveOrderStreams.set(status, stream);
    stream.callback = query.on('value', snap => {
      stream.rows = adminOrdersFromSnapshot(snap);
      state.allOrders = [...adminActiveOrderStreams.values()].flatMap(s => s.rows)
        .sort((a,b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      if (state.currentView === 'admin') renderAdminOrders();
      adminRefreshMesaIfVisible();
    }, () => showToast('Não foi possível carregar a fila de pedidos.', 'error'));
  }
}

function stopAdminOpenOrders() {
  for (const stream of adminActiveOrderStreams.values()) stream.query.off('value', stream.callback);
  adminActiveOrderStreams.clear();
  state.allOrders = [];
  Object.assign(adminHistory, {rows:[],cursor:null,next:false,busy:false,token:adminHistory.token+1});
  adminOrderDetailId = null;
  document.getElementById('admin-order-detail').hidden = true;
}

function adminIsFinishedOrder(order) {
  return ['delivered','refunded','cancelled','canceled'].includes(order.status || 'delivered');
}

function adminOrderMode(value) {
  state._adminOrderFilter = value || 'open';
  Object.assign(adminHistory, {rows:[],cursor:null,next:false,busy:false,token:adminHistory.token+1});
  if (['history','archived'].includes(value)) adminLoadOrderHistory();
  else renderAdminOrders();
}

async function adminLoadOrderHistory() {
  if (adminHistory.busy) return;
  const token = ++adminHistory.token;
  adminHistory.busy = true;
  renderAdminOrders();
  try {
    let cursor = adminHistory.cursor, hasMore = true;
    const matches = [];
    // Scan at most four indexed key pages per click, including sparse archived history.
    for (let page = 0; page < 4 && hasMore && matches.length < adminOrderPageSize; page++) {
      let query = db.ref('orders').orderByKey();
      if (cursor) query = query.endBefore(cursor);
      const rows = adminOrdersFromSnapshot(await query.limitToLast(50).once('value')).reverse();
      hasMore = rows.length === 50;
      for (const [index, order] of rows.entries()) {
        cursor = order.id;
        const archived = state._adminOrderFilter === 'archived';
        if (adminIsFinishedOrder(order) && !!order.adminArchivedAt === archived) matches.push(order);
        if (matches.length < adminOrderPageSize) continue;
        hasMore ||= index < rows.length - 1;
        break;
      }
    }
    if (token !== adminHistory.token) return;
    Object.assign(adminHistory, {rows:matches,cursor,next:hasMore});
  } catch (error) {
    if (token === adminHistory.token) showToast('Não foi possível consultar o histórico.', 'error');
  } finally {
    if (token === adminHistory.token) {
      adminHistory.busy = false;
      renderAdminOrders();
    }
  }
}

function renderAdminOrders() {
  const panel = document.getElementById('admin-orders-list');
  if (!panel) return;
  const mode = state._adminOrderFilter || 'open';
  const history = mode === 'history' || mode === 'archived';
  const rows = history ? adminHistory.rows : (state.allOrders || []).filter(order =>
    mode === 'open' || (mode === 'overdue' ? adminIsOverdue(order) : order.status === mode));
  panel.innerHTML = `<div class="admin-queue-filter"><label>Fila de pedidos <select class="select" onchange="adminOrderMode(this.value)">${Object.entries(adminOrderModes).map(([id,label]) => `<option value="${id}" ${mode === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <span class="text-muted">${adminHistory.busy ? 'Consultando…' : `${rows.length} pedido(s)`}</span></div>
    ${rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Pedido</th><th>Jogador</th><th>Status</th><th>Prazo</th><th></th></tr></thead><tbody>
    ${rows.map(order => `<tr><td>${escapeHTML(order.productName || 'Pedido')} <small>×${Number(order.quantity) || 1}</small></td><td>${escapeHTML(order.userName || order.userId || '—')}</td>
      <td><span class="status-pill ${statusClass(order.status)}">${escapeHTML(STATUS_LABELS[order.status || 'delivered'] || order.status)}${adminIsOverdue(order) ? ' · atrasado' : ''}</span></td>
      <td>${order.estimatedDelivery ? formatDateTime(order.estimatedDelivery) : '—'}</td><td><button type="button" class="btn btn-ghost btn-sm" data-order="${escapeHTML(order.id)}" onclick="adminOpenOrder(this.dataset.order)">Ver pedido</button></td></tr>`).join('')}
    </tbody></table></div>` : `<p class="empty-state">${adminHistory.busy ? 'Carregando pedidos…' : 'Nenhum pedido nesta página.'}</p>`}
    ${history ? `<div class="admin-queue-filter"><button class="btn btn-ghost btn-sm" type="button" onclick="adminOrderMode('${mode}')" ${adminHistory.busy ? 'disabled' : ''}>Primeira página</button><button class="btn btn-primary btn-sm" type="button" onclick="adminLoadOrderHistory()" ${adminHistory.next && !adminHistory.busy ? '' : 'disabled'}>Mais antigos</button><button class="btn btn-ghost btn-sm" type="button" onclick="switchAdminTab('maintenance')">Arquivar ou exportar</button></div>` : ''}`;
}

async function adminReadOrder(id) {
  const snap = await db.ref('orders/' + id).once('value');
  return snap.exists() ? { ...snap.val(), id } : null;
}

async function adminOpenOrder(id) {
  const panel = document.getElementById('admin-order-detail');
  adminOrderDetailId = id;
  panel.hidden = false;
  panel.textContent = 'Carregando pedido…';
  try {
    const order = await adminReadOrder(id);
    if (adminOrderDetailId !== id) return;
    if (!order) { panel.textContent = 'Pedido indisponível.'; return; }
    const safe = escapeHTML(id);
    panel.innerHTML = `<div class="admin-catalog-heading"><h3>${escapeHTML(order.productName || 'Pedido')}</h3><button class="btn btn-ghost btn-sm" onclick="adminOrderDetailId=null;this.closest('#admin-order-detail').hidden=true">Fechar</button></div>
      <p>${escapeHTML(order.userName || order.userId || '—')} · ${formatMoney(order.price)} · ${escapeHTML(STATUS_LABELS[order.status || 'delivered'] || order.status)}</p>
      <p class="text-muted">Criado em ${formatDateTime(order.createdAt)}${order.estimatedDelivery ? ` · prazo ${formatDateTime(order.estimatedDelivery)}` : ''}${order.deliveredAt ? ` · entregue ${formatDateTime(order.deliveredAt)}` : ''}${order.adminArchivedAt ? ` · arquivado ${formatDateTime(order.adminArchivedAt)}` : ''}</p>
      ${order.adminArchivedAt ? '' : `<div class="admin-queue-filter">${adminIsFinishedOrder(order) ? '' : `<button type="button" class="btn btn-primary btn-sm" data-order="${safe}" onclick="adminOrderAction(this,'delivered')">Entregar</button>`}
      <button type="button" class="btn btn-ghost btn-sm" data-order="${safe}" onclick="adminOrderAction(this,'date')">Alterar prazo</button>
      <label>Status <select class="select" data-order="${safe}" onchange="adminOrderAction(this,this.value)">${Object.entries(STATUS_LABELS).map(([key,label]) => `<option value="${key}" ${(order.status || 'delivered') === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>`}
      <h4>Movimentações</h4><div data-order-log>Consultando…</div>`;
    try {
      const log = adminOrdersFromSnapshot(await db.ref('adminLog').orderByChild('orderId').equalTo(id).limitToLast(15).once('value')).reverse();
      if (adminOrderDetailId === id) panel.querySelector('[data-order-log]').innerHTML = log.length
        ? `<ul class="mesa-list">${log.map(entry => `<li>${formatDateTime(entry.createdAt)} · ${escapeHTML([entry.type,entry.from,entry.to].filter(Boolean).join(' · '))}</li>`).join('')}</ul>`
        : '<p class="text-muted">Sem movimentações registradas.</p>';
    } catch (error) {
      if (adminOrderDetailId === id) panel.querySelector('[data-order-log]').textContent = 'Histórico de ações indisponível.';
    }
  } catch (error) {
    if (adminOrderDetailId === id) panel.textContent = 'Não foi possível consultar o pedido.';
  }
}

async function adminOrderAction(control, action) {
  const id = control.dataset.order;
  const panel = document.getElementById('admin-order-detail');
  const controls = [...panel.querySelectorAll('button,select')];
  controls.forEach(element => { element.disabled = true; });
  try {
    if (action === 'date') await adminEditOrderDelivery(id);
    else if (await gsConfirm({title:'Atualizar pedido', body:`Alterar status para <strong>${escapeHTML(STATUS_LABELS[action] || action)}</strong>?`, confirmLabel:'Confirmar'})) {
      await adminSetOrderStatus(id, action);
    }
  } catch (error) { showToast('Não foi possível atualizar o pedido.', 'error'); }
  finally { if (adminOrderDetailId === id) await adminOpenOrder(id); }
}
