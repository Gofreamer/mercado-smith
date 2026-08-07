/* Global Smith — Banco + Cartão RP + Extrato + Empréstimo */

function getCardNumber(uid) {
  if (!uid) return '•••• •••• •••• ••••';
  // determinístico a partir do uid
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0;
  const n = Math.abs(h).toString().padStart(16, '7').slice(0, 16);
  return n.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function getCardExpiry(profile) {
  const created = profile?.createdAt || Date.now();
  const d = new Date(created);
  d.setFullYear(d.getFullYear() + 4);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

/** Registra linha no extrato do usuário */
async function pushLedgerEntry(uid, entry) {
  if (!uid) return;
  try {
    const key = generateId();
    await db.ref(`users/${uid}/ledger/${key}`).set({
      type: entry.type || 'adjust',
      amount: Number(entry.amount) || 0,
      balanceAfter: entry.balanceAfter != null ? Number(entry.balanceAfter) : null,
      label: entry.label || '',
      refId: entry.refId || null,
      createdAt: entry.createdAt || Date.now()
    });
  } catch (e) {
    console.warn('ledger', e);
  }
}

function getLedgerEntries() {
  const ledger = state.profile?.ledger || {};
  return Object.entries(ledger)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function getLoans() {
  const loans = state.profile?.loans || {};
  return Object.entries(loans)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function ledgerTypeLabel(type) {
  const map = {
    purchase: 'Compra',
    refund: 'Reembolso',
    deposit: 'Crédito GS',
    withdraw: 'Débito GS',
    adjust: 'Ajuste do núcleo',
    loan: 'Empréstimo liberado',
    loan_payment: 'Pagamento de empréstimo',
    offer: 'Negociação fechada',
    transfer_in: 'Transferência recebida',
    transfer_out: 'Transferência enviada'
  };
  return map[type] || type || 'Movimento';
}

function renderBank() {
  const root = document.getElementById('bank-root');
  if (!root) return;

  if (!state.profile || !state.user) {
    root.innerHTML = `
      <div class="empty-state empty-state-lg">
        <div class="empty-icon">🏦</div>
        <h3>Carregando conta GS…</h3>
        <p>Sincronizando com o núcleo financeiro.</p>
      </div>`;
    return;
  }

  const rank = getUserRank(state.profile, state.orders);
  const balance = Number(state.profile.balance) || 0;
  const cardNo = getCardNumber(state.user.uid);
  const expiry = getCardExpiry(state.profile);
  const ledger = getLedgerEntries().slice(0, 40);
  const loans = getLoans();
  const activeLoan = loans.find(l => l.status === 'active');
  const pendingLoan = loans.find(l => l.status === 'pending');
  const debt = activeLoan ? Number(activeLoan.remaining || activeLoan.amount) || 0 : 0;

  root.innerHTML = `
    <div class="bank-layout">
      <div class="bank-main">
        <div class="gs-card" style="--rank-color:${rank.color}">
          <div class="gs-card-top">
            <span class="gs-card-brand">GLOBAL SMITH</span>
            <span class="gs-card-chip"></span>
          </div>
          <div class="gs-card-number">${cardNo}</div>
          <div class="gs-card-bottom">
            <div>
              <div class="gs-card-label">Titular</div>
              <div class="gs-card-name">${escapeHTML(state.profile.name || '—')}</div>
            </div>
            <div>
              <div class="gs-card-label">Validade</div>
              <div class="gs-card-name">${expiry}</div>
            </div>
            <div>
              <div class="gs-card-label">Rank</div>
              <div class="gs-card-name" style="color:${rank.color}">${rank.label}</div>
            </div>
          </div>
        </div>

        <div class="bank-stats">
          <div class="bank-stat">
            <div class="bank-stat-label">Saldo disponível</div>
            <div class="bank-stat-value success">${formatMoney(balance)}</div>
          </div>
          <div class="bank-stat">
            <div class="bank-stat-label">Em dívida</div>
            <div class="bank-stat-value ${debt > 0 ? 'warning' : ''}">${formatMoney(debt)}</div>
          </div>
          <div class="bank-stat">
            <div class="bank-stat-label">Movimentos</div>
            <div class="bank-stat-value">${ledger.length}${getLedgerEntries().length > 40 ? '+' : ''}</div>
          </div>
        </div>

        <div class="bank-section">
          <h3>Extrato</h3>
          ${ledger.length === 0 ? `
            <div class="empty-state" style="padding:20px 0">
              <p>Nenhum movimento ainda. Compras, reembolsos e créditos do núcleo aparecem aqui.</p>
            </div>
          ` : `
            <div class="ledger-list">
              ${ledger.map(e => {
                const amt = Number(e.amount) || 0;
                const pos = amt >= 0;
                return `
                  <div class="ledger-row">
                    <div class="ledger-info">
                      <div class="ledger-label">${escapeHTML(e.label || ledgerTypeLabel(e.type))}</div>
                      <div class="ledger-meta">${formatDateTime(e.createdAt)} · ${escapeHTML(ledgerTypeLabel(e.type))}</div>
                    </div>
                    <div class="ledger-amount ${pos ? 'success' : 'text-danger'}">${pos ? '+' : ''}${formatMoney(amt)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>

      <div class="bank-side">
        <div class="bank-panel">
          <h3>Empréstimo / crédito</h3>
          <p class="text-muted bank-hint">O núcleo GS avalia pedidos. Rank mais alto facilita liberação pela mesa.</p>
          ${activeLoan ? `
            <div class="loan-active">
              <div class="loan-active-label">Empréstimo ativo</div>
              <div class="loan-active-value">${formatMoney(debt)} restantes</div>
              <p class="text-muted" style="font-size:12px;margin:6px 0 10px">Original: ${formatMoney(activeLoan.amount)}</p>
              <div class="form-group">
                <label>Pagar (do saldo)</label>
                <input type="number" id="loan-pay-amount" class="search-input" min="1" step="0.01" max="${debt}" value="${Math.min(debt, balance)}"/>
              </div>
              <button class="btn btn-primary btn-sm" onclick="payLoan('${activeLoan.id}')">Quitar parcial / total</button>
            </div>
          ` : pendingLoan ? `
            <div class="loan-pending">
              <p>Pedido em análise: <strong>${formatMoney(pendingLoan.amount)}</strong></p>
              <p class="text-muted" style="font-size:12px">${escapeHTML(pendingLoan.reason || '')}</p>
              <button class="btn btn-ghost btn-sm" onclick="cancelLoanRequest('${pendingLoan.id}')">Cancelar pedido</button>
            </div>
          ` : `
            <form onsubmit="requestLoan(event)">
              <div class="form-group">
                <label>Valor solicitado ($)</label>
                <input type="number" id="loan-amount" required min="100" step="100" placeholder="Ex: 5000"/>
              </div>
              <div class="form-group">
                <label>Motivo (in-world)</label>
                <input type="text" id="loan-reason" maxlength="120" placeholder="Operação, equipamento, favor…"/>
              </div>
              <button type="submit" class="btn btn-primary btn-full">Solicitar ao núcleo</button>
            </form>
          `}
        </div>

        <div class="bank-panel">
          <h3>Histórico de crédito</h3>
          ${loans.length === 0 ? `<p class="text-muted" style="font-size:13px">Nenhum empréstimo registrado.</p>` : `
            <div class="loan-history">
              ${loans.slice(0, 8).map(l => `
                <div class="loan-hist-row">
                  <span>${formatMoney(l.amount)}</span>
                  <span class="status-pill ${l.status === 'active' ? 'status-transit' : l.status === 'paid' ? 'status-delivered' : l.status === 'rejected' ? 'status-lost' : 'status-held'}">${escapeHTML(l.status)}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="bank-panel bank-panel-muted">
          <p class="bank-footnote">Cartão RP · sem validade real · saldo é a moeda da mesa Global Smith. Empréstimos são aprovados pelo admin (mestre).</p>
        </div>
      </div>
    </div>
  `;
}

async function requestLoan(e) {
  e.preventDefault();
  if (!state.user || !state.profile) return;
  if (getLoans().some(l => l.status === 'pending' || l.status === 'active')) {
    showToast('Já existe crédito pendente ou ativo.', 'error');
    return;
  }
  const amount = parseFloat(document.getElementById('loan-amount')?.value);
  const reason = (document.getElementById('loan-reason')?.value || '').trim().slice(0, 120);
  if (isNaN(amount) || amount < 100) {
    showToast('Valor mínimo: $ 100.', 'error');
    return;
  }
  try {
    const id = generateId();
    await db.ref(`users/${state.user.uid}/loans/${id}`).set({
      amount,
      remaining: amount,
      status: 'pending',
      reason,
      userName: state.profile.name,
      userId: state.user.uid,
      createdAt: Date.now()
    });
    // espelho para admin listar fácil
    await db.ref(`loanRequests/${id}`).set({
      userId: state.user.uid,
      userName: state.profile.name,
      amount,
      reason,
      status: 'pending',
      createdAt: Date.now()
    });
    pushAdminLog({ type: 'loan_request', userId: state.user.uid, userName: state.profile.name, amount });
    showToast('Pedido enviado ao núcleo GS.');
    renderBank();
  } catch (err) {
    console.error(err);
    showToast('Erro ao solicitar.', 'error');
  }
}

async function cancelLoanRequest(loanId) {
  if (!state.user || !confirm('Cancelar pedido de empréstimo?')) return;
  try {
    await db.ref(`users/${state.user.uid}/loans/${loanId}`).update({ status: 'cancelled', resolvedAt: Date.now() });
    await db.ref(`loanRequests/${loanId}`).update({ status: 'cancelled' });
    showToast('Pedido cancelado.');
    renderBank();
  } catch (e) {
    console.error(e);
    showToast('Erro ao cancelar.', 'error');
  }
}

async function payLoan(loanId) {
  if (!state.user || !state.profile) return;
  const loan = getLoans().find(l => l.id === loanId);
  if (!loan || loan.status !== 'active') return;
  const raw = document.getElementById('loan-pay-amount')?.value;
  const amount = parseFloat(raw);
  const debt = Number(loan.remaining || loan.amount) || 0;
  const bal = Number(state.profile.balance) || 0;
  if (isNaN(amount) || amount <= 0) {
    showToast('Valor inválido.', 'error');
    return;
  }
  if (amount > debt) {
    showToast('Valor maior que a dívida.', 'error');
    return;
  }
  if (amount > bal) {
    showToast('Saldo insuficiente.', 'error');
    return;
  }
  const newBal = bal - amount;
  const newDebt = debt - amount;
  const paid = newDebt <= 0.001;
  try {
    const updates = {};
    updates[`users/${state.user.uid}/balance`] = newBal;
    updates[`users/${state.user.uid}/loans/${loanId}/remaining`] = Math.max(0, newDebt);
    if (paid) {
      updates[`users/${state.user.uid}/loans/${loanId}/status`] = 'paid';
      updates[`users/${state.user.uid}/loans/${loanId}/paidAt`] = Date.now();
      updates[`loanRequests/${loanId}/status`] = 'paid';
    }
    await db.ref().update(updates);
    await pushLedgerEntry(state.user.uid, {
      type: 'loan_payment',
      amount: -amount,
      balanceAfter: newBal,
      label: paid ? 'Empréstimo quitado' : `Pagamento parcial de empréstimo (−${formatMoney(amount)})`,
      refId: loanId
    });
    showToast(paid ? 'Empréstimo quitado.' : `Pago ${formatMoney(amount)}. Restam ${formatMoney(newDebt)}.`);
  } catch (e) {
    console.error(e);
    showToast('Erro no pagamento.', 'error');
  }
}

/* ---------- ADMIN: empréstimos ---------- */

function renderAdminLoans() {
  const el = document.getElementById('admin-loans-list');
  if (!el) return;
  const list = (state.loanRequests || []).filter(l => l.status === 'pending' || l.status === 'active');
  const all = state.loanRequests || [];
  if (!all.length) {
    el.innerHTML = '<div class="empty-state">Nenhum pedido de crédito.</div>';
    return;
  }
  el.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Jogador</th><th>Valor</th><th>Motivo</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${all.slice(0, 30).map(l => `
        <tr>
          <td>${escapeHTML(l.userName || '')}</td>
          <td class="mono">${formatMoney(l.amount)}</td>
          <td style="font-size:12px;max-width:180px">${escapeHTML(l.reason || '—')}</td>
          <td>${escapeHTML(l.status)}</td>
          <td class="admin-actions-cell">
            ${l.status === 'pending' ? `
              <button class="btn btn-primary btn-sm" onclick="adminResolveLoan('${l.id}','approve')">Aprovar</button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="adminResolveLoan('${l.id}','reject')">Recusar</button>
            ` : '—'}
          </td>
        </tr>
      `).join('')}
    </tbody></table></div>`;
}

async function adminResolveLoan(loanId, action) {
  const req = (state.loanRequests || []).find(l => l.id === loanId);
  if (!req) return;
  if (action === 'reject') {
    try {
      await db.ref(`loanRequests/${loanId}`).update({ status: 'rejected', resolvedAt: Date.now() });
      await db.ref(`users/${req.userId}/loans/${loanId}`).update({ status: 'rejected', resolvedAt: Date.now() });
      showToast('Empréstimo recusado.');
    } catch (e) {
      console.error(e);
      showToast('Erro.', 'error');
    }
    return;
  }
  if (action === 'approve') {
    if (!confirm(`Liberar ${formatMoney(req.amount)} para ${req.userName}?`)) return;
    try {
      const userSnap = await db.ref('users/' + req.userId).once('value');
      const user = userSnap.val() || {};
      const bal = Number(user.balance) || 0;
      const newBal = bal + Number(req.amount);
      const updates = {};
      updates[`users/${req.userId}/balance`] = newBal;
      updates[`users/${req.userId}/loans/${loanId}/status`] = 'active';
      updates[`users/${req.userId}/loans/${loanId}/remaining`] = Number(req.amount);
      updates[`users/${req.userId}/loans/${loanId}/approvedAt`] = Date.now();
      updates[`loanRequests/${loanId}/status`] = 'active';
      updates[`loanRequests/${loanId}/approvedAt`] = Date.now();
      await db.ref().update(updates);
      await pushLedgerEntry(req.userId, {
        type: 'loan',
        amount: Number(req.amount),
        balanceAfter: newBal,
        label: `Empréstimo liberado (${formatMoney(req.amount)})`,
        refId: loanId
      });
      pushAdminLog({ type: 'loan_approved', userName: req.userName, amount: req.amount });
      showToast('Crédito liberado.');
    } catch (e) {
      console.error(e);
      showToast('Erro ao aprovar.', 'error');
    }
  }
}

function listenLoanRequests() {
  db.ref('loanRequests').on('value', (snap) => {
    const data = snap.val() || {};
    state.loanRequests = Object.entries(data)
      .map(([id, l]) => ({ id, ...l }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'admin' && typeof renderAdminLoans === 'function') renderAdminLoans();
  });
}
