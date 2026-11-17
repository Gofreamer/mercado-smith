const adminMaintenancePaths = {archive:'orders', orphanOrders:'orders', feed:'marketFeed', logs:'adminLog'};
let adminMaintenancePreview = null;

function adminMaintenanceCandidates(kind, rows, cutoff, users = {}, retained = new Set()) {
  return rows.filter(row => {
    if (retained.has(row.id)) return false;
    if (kind === 'archive') {
      const closed = Number(row.deliveredAt || row.refundedAt || row.updatedAt || row.createdAt);
      return adminIsFinishedOrder(row) && !row.adminArchivedAt && closed > 0 && closed < cutoff;
    }
    if (kind === 'orphanOrders') return adminIsFinishedOrder(row) && Number(row.adminArchivedAt) > 0 && Number(row.adminArchivedAt) < cutoff
      && (!row.userId || !Object.hasOwn(users, row.userId));
    return Number(row.createdAt) > 0 && Number(row.createdAt) < cutoff;
  });
}

function adminDownloadJSON(label, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mercado-smith-${label}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function adminResetMaintenance() {
  adminMaintenancePreview = null;
  document.getElementById('maintenance-preview').textContent = 'Confira os registros antes de aplicar.';
  document.getElementById('maintenance-export').disabled = true;
  document.getElementById('maintenance-apply').disabled = true;
}

async function adminPreviewMaintenance(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const kind = form.elements.datasetKind.value;
  const days = Number(form.elements.days.value);
  if (!Number.isInteger(days) || days < 1) return;
  const cutoff = Date.now() - days * 86400000;
  const ref = db.ref(adminMaintenancePaths[kind]);
  const preview = document.getElementById('maintenance-preview');
  const selection = JSON.stringify([kind, days]);
  const button = form.querySelector('button[type=submit]');
  adminResetMaintenance();
  button.disabled = true;
  preview.textContent = 'Consultando registros…';
  try {
    const keep = kind === 'feed' ? 20 : kind === 'logs' ? 100 : 0;
    const key = kind === 'orphanOrders' ? 'adminArchivedAt' : 'createdAt';
    const snapshots = await Promise.all([
      ref.orderByChild(key).startAt(1).endAt(cutoff).once('value'),
      keep ? ref.orderByKey().limitToLast(keep).once('value') : null,
      kind === 'orphanOrders' ? db.ref('users').once('value') : null
    ]);
    if (selection !== JSON.stringify([form.elements.datasetKind.value, Number(form.elements.days.value)])) return;
    const rows = adminMaintenanceCandidates(kind, adminOrdersFromSnapshot(snapshots[0]), cutoff, snapshots[2]?.val() || {},
      new Set(snapshots[1] ? adminOrdersFromSnapshot(snapshots[1]).map(row => row.id) : []));
    adminMaintenancePreview = {kind, rows, cutoff};
    preview.innerHTML = `<p><strong>${rows.length} registro(s)</strong>${rows.length > 20 ? ' · exibindo os 20 primeiros; o JSON contém todos.' : ''}</p>
      ${rows.length ? `<ul class="admin-batch-preview">${rows.slice(0,20).map(row => `<li><span>${escapeHTML(row.productName || row.text || row.type || row.id)}</span><span>${formatDateTime(row.adminArchivedAt || row.createdAt)}</span></li>`).join('')}</ul>` : ''}`;
    document.getElementById('maintenance-export').disabled = !rows.length;
    const action = document.getElementById('maintenance-apply');
    action.textContent = kind === 'archive' ? 'Arquivar pedidos' : 'Exportar e apagar';
    action.disabled = !rows.length;
  } catch (error) {
    preview.textContent = 'Não foi possível consultar os registros.';
  } finally { button.disabled = false; }
}

function adminExportMaintenance() {
  const preview = adminMaintenancePreview;
  if (preview?.rows.length) adminDownloadJSON(preview.kind, preview);
}

async function adminApplyMaintenance() {
  const preview = adminMaintenancePreview;
  if (!preview?.rows.length) return;
  const {kind, rows, cutoff} = preview;
  const deleting = kind !== 'archive';
  const ok = await gsConfirm({title:deleting ? 'Exportar e apagar registros antigos' : 'Arquivar pedidos concluídos',
    body:`Aplicar a operação a até <strong>${rows.length}</strong> registros conferidos?`, confirmLabel:deleting ? 'Exportar e apagar' : 'Arquivar', danger:deleting});
  if (!ok || adminMaintenancePreview !== preview) return;
  const button = document.getElementById('maintenance-apply');
  button.disabled = true;
  const stamp = Date.now();
  const counts = {changed:0, skipped:0, failed:0};
  const backup = [];
  const refs = new Map();
  try {
    const keep = kind === 'feed' ? 20 : kind === 'logs' ? 100 : 0;
    const retained = new Set(keep ? adminOrdersFromSnapshot(await db.ref(adminMaintenancePaths[kind]).orderByKey().limitToLast(keep).once('value')).map(row => row.id) : []);
    for (const row of rows) {
      const ref = db.ref(`${adminMaintenancePaths[kind]}/${row.id}`);
      try {
        const current = (await ref.once('value')).val();
        const users = {};
        if (kind === 'orphanOrders' && current?.userId && (await db.ref('users/' + current.userId).once('value')).exists()) users[current.userId] = true;
        if (!current || !adminMaintenanceCandidates(kind, [{...current,id:row.id}], cutoff, users, retained).length) { counts.skipped++; continue; }
        refs.set(row.id, ref);
        backup.push({id:row.id, current});
      } catch (error) { counts.failed++; }
    }
    if (deleting && backup.length) adminDownloadJSON(kind, { cutoff, records:backup });
    for (const row of backup) {
      try {
        const original = JSON.stringify(row.current);
        const result = await refs.get(row.id).transaction(current => {
          if (!current || JSON.stringify(current) !== original) return;
          return deleting ? null : { ...current, adminArchivedAt:stamp };
        }, undefined, false);
        counts[result.committed ? 'changed' : 'skipped']++;
      } catch (error) { counts.failed++; }
    }
    showToast(`${counts.changed} alterado(s) · ${counts.skipped} ignorado(s) · ${counts.failed} falha(s).`, counts.failed ? 'error' : 'success');
  } catch (error) { showToast('Não foi possível iniciar a manutenção.', 'error'); }
  finally {
    adminResetMaintenance();
    if (['history','archived'].includes(state._adminOrderFilter)) adminOrderMode(state._adminOrderFilter);
  }
}
