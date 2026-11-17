let adminPlayerSheetId = null;
let adminLogSelection = null;

async function adminOpenPlayerSheet(uid) {
  const panel = document.getElementById('admin-player-detail');
  const player = state.allUsers?.[uid];
  if (!panel || !player) return;
  adminPlayerSheetId = uid;
  panel.classList.remove('hidden');
  const loans = Object.values(player.loans || {});
  const active = loans.filter(loan => loan.status === 'active' || loan.status === 'pending');
  const card = player.card?.status || 'active';
  panel.innerHTML = `<div class="admin-card"><div class="admin-catalog-heading"><h3>${escapeHTML(player.name || uid)}</h3><button type="button" class="btn btn-ghost btn-sm" onclick="adminPlayerSheetId=null;this.closest('#admin-player-detail').classList.add('hidden')">Fechar</button></div>
    <div class="mesa-queues"><div><small>Saldo</small><p><strong>${formatMoney(player.balance)}</strong></p></div><div><small>Cartão</small><p>${escapeHTML(typeof cardStatusLabel === 'function' ? cardStatusLabel(card) : card)}</p></div><div><small>Itens no inventário</small><p>${Object.keys(player.inventory || {}).length}</p></div></div>
    <p class="text-muted" data-player-rank></p><h4>Empréstimos em aberto</h4>${active.length ? `<ul class="mesa-list">${active.map(loan => `<li>${loan.status === 'pending' ? 'Em análise' : 'Ativo'} · ${formatMoney(loan.remaining ?? loan.amount)}</li>`).join('')}</ul>` : '<p class="text-muted">Nenhum empréstimo em aberto.</p>'}
    <h4>Pedidos recentes</h4><div data-player-sheet-orders>Consultando…</div></div>`;
  panel.scrollIntoView({block:'nearest'});
  try {
    const snap = await db.ref('orders').orderByChild('userId').equalTo(uid).once('value');
    if (adminPlayerSheetId !== uid || !panel.querySelector('[data-player-sheet-orders]')) return;
    const orders = adminOrdersFromSnapshot(snap).reverse();
    const stats = getRepStats(player, orders);
    panel.querySelector('[data-player-rank]').textContent = `${getUserRank(player, orders).label} · ${stats.orders} compras na reputação · ${formatMoney(stats.spent)}`;
    const recent = orders.slice(0,20);
    panel.querySelector('[data-player-sheet-orders]').innerHTML = recent.length ? `<ul class="mesa-list">${recent.map(order => `<li>${escapeHTML(order.productName || 'Pedido')} · ${escapeHTML(STATUS_LABELS[order.status || 'delivered'] || order.status)} · ${formatDateTime(order.createdAt)}</li>`).join('')}</ul>` : '<p class="text-muted">Nenhum pedido encontrado.</p>';
  } catch (error) {
    if (adminPlayerSheetId === uid && panel.querySelector('[data-player-sheet-orders]')) panel.querySelector('[data-player-sheet-orders]').textContent = 'Não foi possível consultar os pedidos.';
  }
}

function adminMatchingLogs(rows, {player, type, after, before}) {
  const q = player.trim().toLowerCase();
  return rows.filter(entry => {
    const date = Number(entry.createdAt);
    const target = `${entry.userName || ''} ${entry.userId || ''} ${entry.uid || ''}`.toLowerCase();
    return (!q || target.includes(q)) && (!type || entry.type === type) && (!after || date >= after) && (!before || date <= before);
  });
}

function adminCurrentLogFilters() {
  const fields = document.getElementById('admin-log-filters').elements;
  return { player:fields.player.value, type:fields.action.value,
    after:fields.from.value ? new Date(fields.from.value + 'T00:00:00').getTime() : null,
    before:fields.to.value ? new Date(fields.to.value + 'T23:59:59.999').getTime() : null };
}

function renderAdminLog() {
  const panel = document.getElementById('admin-log-list');
  if (!panel) return;
  const rows = adminMatchingLogs(adminLogSelection || state.adminLog || [], adminCurrentLogFilters());
  panel.innerHTML = `<p class="text-muted">${rows.length} registro(s) · ${adminLogSelection ? 'consulta do período' : 'até 100 registros recentes'}</p>` + (rows.length ? rows.map(entry => `
    <div class="log-row"><span class="log-time">${formatDateTime(entry.createdAt)}</span><span class="log-type">${escapeHTML(entry.type || '')}</span><span class="log-body">${escapeHTML([entry.userName || entry.userId, entry.productName, entry.label, entry.from && `${entry.from} → ${entry.to}`].filter(Boolean).join(' · '))} ${entry.amount != null ? formatMoney(entry.amount) : entry.total != null ? formatMoney(entry.total) : ''}</span></div>`).join('') : '<div class="empty-state">Nenhum registro neste filtro.</div>');
}

async function adminLoadLogs(event) {
  event.preventDefault();
  const filters = adminCurrentLogFilters();
  if (filters.after && filters.before && filters.after > filters.before) return showToast('Informe um período válido.', 'error');
  if (!filters.after && !filters.before) { adminLogSelection = null; renderAdminLog(); return; }
  const button = event.currentTarget.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    let query = db.ref('adminLog').orderByChild('createdAt');
    if (filters.after) query = query.startAt(filters.after);
    if (filters.before) query = query.endAt(filters.before);
    adminLogSelection = adminOrdersFromSnapshot(await query.once('value')).reverse();
    renderAdminLog();
  } catch (error) { showToast('Não foi possível consultar o log.', 'error'); }
  finally { button.disabled = false; }
}

function adminExportLog() {
  const rows = adminMatchingLogs(adminLogSelection || state.adminLog || [], adminCurrentLogFilters());
  if (rows.length) adminDownloadJSON('log', rows);
  else showToast('Nenhum registro para exportar.', 'info');
}
