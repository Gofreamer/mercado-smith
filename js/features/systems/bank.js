/* Global Smith — Banco + Cartão RP + Extrato + Gasto RP + Empréstimo + Admin cartão */

const RP_SPEND_CATEGORIES = {
  transporte: 'Transporte',
  entrada: 'Entrada / acesso',
  comida: 'Comida & bebida',
  servico: 'Serviço',
  favor: 'Favor / propina',
  hospedagem: 'Hospedagem',
  diversao: 'Diversão',
  transferencia: 'Transferência',
  outros: 'Outros'
};

function getCardNumber(uid) {
  if (!uid) return '•••• •••• •••• ••••';
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

function getCardStatus(profile) {
  const s = profile?.card?.status || 'active';
  if (s === 'cancelled' || s === 'suspended' || s === 'active') return s;
  return 'active';
}

function getCardHolder(profile) {
  return (profile?.card?.holderName || profile?.name || '—').trim();
}

function getCardBenefit(profile) {
  return (profile?.card?.benefit || '').trim();
}

function isSubscriptionActive(s, now = Date.now()) {
  if (!s) return false;
  // Controle manual (calendário do RPG): fica ativa até o admin remover
  if (!s.useRealSchedule) return true;
  // Relógio real: respeita expiresAt
  if (s.expiresAt && Number(s.expiresAt) <= now) return false;
  return true;
}

function getCardSubscriptions(profile) {
  const subs = profile?.card?.subscriptions || {};
  const now = Date.now();
  return Object.entries(subs)
    .map(([id, s]) => ({ id, ...s }))
    .filter(s => isSubscriptionActive(s, now))
    .sort((a, b) => {
      // Manuais primeiro; depois as que vencem mais cedo
      if (!a.useRealSchedule && b.useRealSchedule) return -1;
      if (a.useRealSchedule && !b.useRealSchedule) return 1;
      return (a.expiresAt || 0) - (b.expiresAt || 0);
    });
}

function getAllCardSubscriptions(profile) {
  const subs = profile?.card?.subscriptions || {};
  return Object.entries(subs)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function formatSubExpiry(s) {
  if (!s) return '';
  // Texto in-world tem prioridade na exibição
  if (s.endsLabel) {
    const base = s.endsLabel;
    if (s.useRealSchedule && s.expiresAt) {
      return `${base} · ${formatSubRealExpiry(s.expiresAt)}`;
    }
    return s.days ? `${base} · ${s.days} dia${s.days > 1 ? 's' : ''} (mesa)` : base;
  }
  if (s.useRealSchedule && s.expiresAt) return formatSubRealExpiry(s.expiresAt);
  if (s.days) return `${s.days} dia${s.days > 1 ? 's' : ''} · controle da mesa (calendário RPG)`;
  return 'Sem prazo · controle da mesa';
}

function formatSubRealExpiry(ts) {
  if (!ts) return 'Sem prazo';
  const d = new Date(ts);
  const now = Date.now();
  const days = Math.ceil((ts - now) / 86400000);
  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (days < 0) return `Expirou ${dateStr}`;
  if (days === 0) return `Expira hoje (${dateStr})`;
  if (days === 1) return `Expira amanhã (${dateStr})`;
  return `${days} dias reais · até ${dateStr}`;
}

function cardStatusLabel(status) {
  return ({ active: 'Ativo', suspended: 'Suspenso', cancelled: 'Cancelado' })[status] || status;
}

function cardStatusClass(status) {
  return ({
    active: 'status-delivered',
    suspended: 'status-held',
    cancelled: 'status-lost'
  })[status] || 'status-transit';
}

function loanStatusLabel(status) {
  return ({
    pending: 'Em análise',
    active: 'Ativo',
    paid: 'Quitado',
    rejected: 'Recusado',
    cancelled: 'Cancelado'
  })[status] || status;
}

function loanStatusClass(status) {
  return ({
    pending: 'status-held',
    active: 'status-transit',
    paid: 'status-delivered',
    rejected: 'status-lost',
    cancelled: 'status-lost'
  })[status] || 'status-held';
}

function setRpSpendAmount(v) {
  const el = document.getElementById('rp-spend-amount');
  if (el) {
    el.value = v;
    el.focus();
  }
}

async function pushLedgerEntry(uid, entry) {
  if (!uid) return;
  try {
    const key = generateId();
    await db.ref(`users/${uid}/ledger/${key}`).set({
      type: entry.type || 'adjust',
      amount: Number(entry.amount) || 0,
      balanceAfter: entry.balanceAfter != null ? Number(entry.balanceAfter) : null,
      label: entry.label || '',
      category: entry.category || null,
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
    transfer_out: 'Transferência enviada',
    rp_spend: 'Gasto no cartão',
    benefit: 'Benefício do cartão'
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
  const cardStatus = getCardStatus(state.profile);
  const holder = getCardHolder(state.profile);
  const benefit = getCardBenefit(state.profile);
  const subscriptions = getCardSubscriptions(state.profile);
  const ledger = getLedgerEntries().slice(0, 40);
  const loans = getLoans();
  const activeLoan = loans.find(l => l.status === 'active');
  const pendingLoan = loans.find(l => l.status === 'pending');
  const debt = activeLoan ? Number(activeLoan.remaining || activeLoan.amount) || 0 : 0;
  const cardOk = cardStatus === 'active';
  const catOptions = Object.entries(RP_SPEND_CATEGORIES)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join('');

  root.innerHTML = `
    <div class="bank-layout">
      <div class="bank-main">
        <div class="gs-card ${cardStatus !== 'active' ? 'gs-card-' + cardStatus : ''}" style="--rank-color:${rank.color}">
          <div class="gs-card-top">
            <span class="gs-card-brand">GLOBAL SMITH</span>
            <span class="gs-card-chip"></span>
          </div>
          ${cardStatus !== 'active' ? `<div class="gs-card-stamp">${cardStatusLabel(cardStatus).toUpperCase()}</div>` : ''}
          <div class="gs-card-number">${cardStatus === 'cancelled' ? '•••• •••• •••• ••••' : cardNo}</div>
          <div class="gs-card-bottom">
            <div>
              <div class="gs-card-label">Titular</div>
              <div class="gs-card-name">${escapeHTML(holder)}</div>
            </div>
            <div>
              <div class="gs-card-label">Validade</div>
              <div class="gs-card-name">${cardStatus === 'cancelled' ? '—' : expiry}</div>
            </div>
            <div>
              <div class="gs-card-label">Rank</div>
              <div class="gs-card-name" style="color:${rank.color}">${rank.label}</div>
            </div>
          </div>
        </div>

        <div class="bank-card-meta">
          <span class="status-pill ${cardStatusClass(cardStatus)}">${cardStatusLabel(cardStatus)}</span>
        </div>
        ${benefit ? `
          <div class="bank-benefit-card">
            <div class="bank-benefit-label">Benefício permanente</div>
            <div class="bank-benefit-text">✦ ${escapeHTML(benefit)}</div>
          </div>
        ` : ''}
        ${subscriptions.length ? `
          <div class="bank-subs-card">
            <div class="bank-benefit-label">Assinaturas ativas</div>
            <div class="bank-subs-list">
              ${subscriptions.map(s => `
                <div class="bank-sub-item">
                  <div class="bank-sub-name">◆ ${escapeHTML(s.name || 'Assinatura')}</div>
                  ${s.description ? `<div class="bank-sub-desc">${escapeHTML(s.description)}</div>` : ''}
                  <div class="bank-sub-expiry">${escapeHTML(formatSubExpiry(s))}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

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
              <p>Conta quieta. Compras, gastos no cartão e créditos do núcleo aparecem aqui.</p>
              <button class="btn btn-ghost btn-sm" onclick="showView('market')">Explorar o catálogo</button>
            </div>
          ` : `
            <div class="ledger-list">
              ${ledger.map(e => {
                const amt = Number(e.amount) || 0;
                const pos = amt >= 0;
                const cat = e.category ? (RP_SPEND_CATEGORIES[e.category] || e.category) : '';
                return `
                  <div class="ledger-row">
                    <div class="ledger-info">
                      <div class="ledger-label">${escapeHTML(e.label || ledgerTypeLabel(e.type))}</div>
                      <div class="ledger-meta">${formatDateTime(e.createdAt)} · ${escapeHTML(ledgerTypeLabel(e.type))}${cat ? ' · ' + escapeHTML(cat) : ''}</div>
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
          <h3>Gasto no cartão</h3>
          <p class="text-muted bank-hint">Despesas fora do mercado ou transferência a NPC/pessoa: transporte, propina, pagamento a July…</p>
          ${!cardOk ? `
            <div class="loan-pending">
              <p>Cartão <strong>${cardStatusLabel(cardStatus)}</strong>. Gastos no cartão estão bloqueados.</p>
              <p class="text-muted" style="font-size:12px">Fale com o núcleo GS (admin) para reativar.</p>
            </div>
          ` : `
            <form onsubmit="cardRpSpend(event)">
              <div class="form-group">
                <label>Categoria</label>
                <select id="rp-spend-cat" class="select" required>${catOptions}</select>
              </div>
              <div class="form-group">
                <label>Valor ($)</label>
                <div class="rp-amount-chips">
                  <button type="button" class="btn btn-ghost btn-sm" onclick="setRpSpendAmount(50)">$ 50</button>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="setRpSpendAmount(100)">$ 100</button>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="setRpSpendAmount(500)">$ 500</button>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="setRpSpendAmount(1000)">$ 1.000</button>
                </div>
                <input type="number" id="rp-spend-amount" required min="0.01" step="0.01" placeholder="Ex: 150"/>
              </div>
              <div class="form-group">
                <label>Descrição</label>
                <input type="text" id="rp-spend-desc" maxlength="120" required placeholder="Ex: táxi ao porto · transferência para July"/>
              </div>
              <button type="submit" class="btn btn-primary btn-full">Debitar no cartão</button>
            </form>
          `}
        </div>

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
                  <span class="status-pill ${loanStatusClass(l.status)}">${escapeHTML(loanStatusLabel(l.status))}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="bank-panel bank-panel-muted">
          <p class="bank-footnote">Cartão RP · gastos fora do mercado debitam o mesmo saldo. Status, benefício permanente e assinaturas (com prazo) são controlados pelo núcleo GS (admin).</p>
        </div>
      </div>
    </div>
  `;
}

async function cardRpSpend(e) {
  e.preventDefault();
  if (!state.user || !state.profile) return;

  const status = getCardStatus(state.profile);
  if (status !== 'active') {
    showToast('Cartão ' + cardStatusLabel(status).toLowerCase() + '. Operação bloqueada.', 'error');
    return;
  }

  const category = document.getElementById('rp-spend-cat')?.value || 'outros';
  const amount = parseFloat(document.getElementById('rp-spend-amount')?.value);
  const desc = (document.getElementById('rp-spend-desc')?.value || '').trim().slice(0, 120);

  if (isNaN(amount) || amount <= 0) {
    showToast('Informe um valor válido.', 'error');
    return;
  }
  if (!desc) {
    showToast('Descreva o gasto.', 'error');
    return;
  }

  const bal = Number(state.profile.balance) || 0;
  if (amount > bal) {
    showToast(`Saldo insuficiente. Disponível: ${formatMoney(bal)}.`, 'error');
    return;
  }

  const catLabel = RP_SPEND_CATEGORIES[category] || category;
  const okSpend = await gsConfirm({
    title: 'Débito no cartão',
    body: `Debitar <strong>${formatMoney(amount)}</strong>?<br>${escapeHTML(catLabel)} — ${escapeHTML(desc)}`,
    confirmLabel: 'Debitar',
    danger: true
  });
  if (!okSpend) return;

  const newBal = bal - amount;
  const uid = state.user.uid;
  const ledgerKey = generateId();

  try {
    await db.ref().update({
      [`users/${uid}/balance`]: newBal,
      [`users/${uid}/ledger/${ledgerKey}`]: {
        type: 'rp_spend',
        amount: -amount,
        balanceAfter: newBal,
        label: desc,
        category,
        createdAt: Date.now()
      }
    });
    pushAdminLog({
      type: 'rp_spend',
      userId: uid,
      userName: state.profile.name,
      amount,
      productName: desc
    });
    showToast(`Débito no cartão · ${desc} · −${formatMoney(amount)}`);
  } catch (err) {
    console.error(err);
    showToast('Erro ao debitar.', 'error');
  }
}

async function requestLoan(e) {
  e.preventDefault();
  if (!state.user || !state.profile) return;
  if (getCardStatus(state.profile) === 'cancelled') {
    showToast('Cartão cancelado. Crédito indisponível.', 'error');
    return;
  }
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
  if (!state.user) return;
  const okCancel = await gsConfirm({
    title: 'Cancelar empréstimo',
    body: 'Cancelar este pedido de empréstimo?',
    confirmLabel: 'Cancelar pedido',
    danger: true
  });
  if (!okCancel) return;
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

function renderAdminLoans() {
  const el = document.getElementById('admin-loans-list');
  if (!el) return;
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
          <td><span class="status-pill ${loanStatusClass(l.status)}">${escapeHTML(loanStatusLabel(l.status))}</span></td>
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
    const okLoan = await gsConfirm({
      title: 'Liberar empréstimo',
      body: `Liberar <strong>${formatMoney(req.amount)}</strong> para ${escapeHTML(req.userName || 'jogador')}?`,
      confirmLabel: 'Liberar'
    });
    if (!okLoan) return;
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

async function adminResolveUserRef(input) {
  const raw = (input || '').trim();
  if (!raw) return null;
  if (!raw.includes('@')) return raw;
  const snap = await db.ref('users').orderByChild('email').equalTo(raw).once('value');
  const users = snap.val();
  if (!users) return null;
  return Object.keys(users)[0];
}

async function adminLoadCardInfo() {
  const input = document.getElementById('admin-card-user')?.value;
  const box = document.getElementById('admin-card-preview');
  if (!box) return;
  try {
    const uid = await adminResolveUserRef(input);
    if (!uid) {
      box.innerHTML = '<p class="text-muted">Usuário não encontrado.</p>';
      renderAdminSubsList(null);
      return;
    }
    const snap = await db.ref('users/' + uid).once('value');
    const u = snap.val();
    if (!u) {
      box.innerHTML = '<p class="text-muted">Usuário não encontrado.</p>';
      renderAdminSubsList(null);
      return;
    }
    const status = u.card?.status || 'active';
    const holder = u.card?.holderName || u.name || '—';
    const benefit = u.card?.benefit || '';
    document.getElementById('admin-card-uid').value = uid;
    document.getElementById('admin-card-holder').value = holder;
    document.getElementById('admin-card-benefit').value = benefit;
    document.getElementById('admin-card-status').value = status;
    const activeSubs = getCardSubscriptions(u);
    const allSubs = getAllCardSubscriptions(u);
    box.innerHTML = `
      <div class="admin-card-preview-inner">
        <div><strong>${escapeHTML(u.name || '')}</strong> · ${escapeHTML(u.email || '')}</div>
        <div class="mono" style="font-size:12px;margin-top:4px">${getCardNumber(uid)}</div>
        <div style="margin-top:6px">Saldo: <strong class="success">${formatMoney(u.balance)}</strong>
          · <span class="status-pill ${cardStatusClass(status)}">${cardStatusLabel(status)}</span>
        </div>
        ${benefit ? `<div style="margin-top:6px;font-size:12px">Benefício: <em>${escapeHTML(benefit)}</em></div>` : ''}
        <div style="margin-top:4px;font-size:12px;color:var(--text-muted)">Assinaturas ativas: ${activeSubs.length} · total registradas: ${allSubs.length}</div>
      </div>
    `;
    renderAdminSubsList(u);
  } catch (e) {
    console.error(e);
    box.innerHTML = '<p class="text-danger">Erro ao carregar.</p>';
    renderAdminSubsList(null);
  }
}

function renderAdminSubsList(userOrNull) {
  const el = document.getElementById('admin-subs-list');
  if (!el) return;
  if (!userOrNull) {
    el.innerHTML = '<p class="text-muted" style="font-size:13px">Carregue um jogador para ver assinaturas.</p>';
    return;
  }
  const all = getAllCardSubscriptions(userOrNull);
  const now = Date.now();
  if (!all.length) {
    el.innerHTML = '<p class="text-muted" style="font-size:13px">Nenhuma assinatura neste cartão.</p>';
    return;
  }
  el.innerHTML = `
    <div class="admin-subs-table">
      ${all.map(s => {
        const active = isSubscriptionActive(s, now);
        const mode = s.useRealSchedule ? 'relógio real' : 'calendário RPG (mesa)';
        return `
          <div class="admin-sub-row ${active ? '' : 'admin-sub-expired'}">
            <div class="admin-sub-info">
              <strong>${escapeHTML(s.name || 'Assinatura')}</strong>
              ${s.description ? `<span class="text-muted"> · ${escapeHTML(s.description)}</span>` : ''}
              <div class="admin-sub-meta">${escapeHTML(formatSubExpiry(s))} · ${mode}${active ? '' : ' · <span class="text-danger">inativa</span>'}</div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="adminRemoveSubscription('${s.id}')" title="Remover">Remover</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function adminSaveCard(e) {
  e.preventDefault();
  const uid = document.getElementById('admin-card-uid')?.value?.trim();
  if (!uid) {
    showToast('Carregue um jogador primeiro.', 'error');
    return;
  }
  const holderName = (document.getElementById('admin-card-holder')?.value || '').trim().slice(0, 60);
  const benefit = (document.getElementById('admin-card-benefit')?.value || '').trim().slice(0, 160);
  const status = document.getElementById('admin-card-status')?.value || 'active';

  try {
    await db.ref(`users/${uid}/card`).update({
      holderName: holderName || null,
      benefit: benefit || null,
      status,
      updatedAt: Date.now()
    });
    pushAdminLog({
      type: 'card_update',
      userId: uid,
      from: status,
      productName: holderName || benefit || status
    });
    showToast('Cartão atualizado.');
    adminLoadCardInfo();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar cartão.', 'error');
  }
}

async function adminCardCredit(e) {
  e.preventDefault();
  const uid = document.getElementById('admin-card-uid')?.value?.trim();
  if (!uid) {
    showToast('Carregue um jogador primeiro.', 'error');
    return;
  }
  const amount = parseFloat(document.getElementById('admin-card-credit-amount')?.value);
  const note = (document.getElementById('admin-card-credit-note')?.value || '').trim().slice(0, 120);
  if (isNaN(amount) || amount === 0) {
    showToast('Valor inválido (positivo = crédito, negativo = débito).', 'error');
    return;
  }
  try {
    const snap = await db.ref(`users/${uid}/balance`).once('value');
    const bal = Number(snap.val()) || 0;
    const newBal = bal + amount;
    if (newBal < 0) {
      showToast('Saldo ficaria negativo.', 'error');
      return;
    }
    const updates = {};
    updates[`users/${uid}/balance`] = newBal;
    const lk = generateId();
    updates[`users/${uid}/ledger/${lk}`] = {
      type: amount > 0 ? 'benefit' : 'rp_spend',
      amount,
      balanceAfter: newBal,
      label: note || (amount > 0 ? 'Benefício do cartão GS' : 'Débito administrativo no cartão'),
      category: amount > 0 ? null : 'outros',
      createdAt: Date.now()
    };
    await db.ref().update(updates);
    pushAdminLog({ type: amount > 0 ? 'card_benefit' : 'card_debit', userId: uid, amount });
    showToast(amount > 0 ? `Benefício de ${formatMoney(amount)} creditado.` : `Débito de ${formatMoney(Math.abs(amount))} aplicado.`);
    document.getElementById('admin-card-credit-amount').value = '';
    document.getElementById('admin-card-credit-note').value = '';
    adminLoadCardInfo();
  } catch (err) {
    console.error(err);
    showToast('Erro no lançamento.', 'error');
  }
}

async function adminSetCardStatus(status) {
  const uid = document.getElementById('admin-card-uid')?.value?.trim();
  if (!uid) {
    showToast('Carregue um jogador primeiro.', 'error');
    return;
  }
  const labels = { active: 'reativar', suspended: 'suspender', cancelled: 'cancelar' };
  const okCard = await gsConfirm({
    title: 'Status do cartão',
    body: `Confirma <strong>${escapeHTML(labels[status] || status)}</strong> este cartão?`,
    confirmLabel: 'Confirmar',
    danger: status === 'cancelled' || status === 'suspended'
  });
  if (!okCard) return;
  try {
    await db.ref(`users/${uid}/card`).update({
      status,
      updatedAt: Date.now()
    });
    pushAdminLog({ type: 'card_status', userId: uid, to: status });
    showToast(`Cartão: ${cardStatusLabel(status)}.`);
    const sel = document.getElementById('admin-card-status');
    if (sel) sel.value = status;
    adminLoadCardInfo();
  } catch (e) {
    console.error(e);
    showToast('Erro ao alterar status.', 'error');
  }
}

async function adminClearBenefit() {
  const uid = document.getElementById('admin-card-uid')?.value?.trim();
  if (!uid) {
    showToast('Carregue um jogador primeiro.', 'error');
    return;
  }
  const ok = await gsConfirm({
    title: 'Remover benefício',
    body: 'Apagar o benefício permanente deste cartão? (Assinaturas não são afetadas.)',
    confirmLabel: 'Remover benefício',
    danger: true
  });
  if (!ok) return;
  try {
    await db.ref(`users/${uid}/card`).update({
      benefit: null,
      updatedAt: Date.now()
    });
    const benefitInput = document.getElementById('admin-card-benefit');
    if (benefitInput) benefitInput.value = '';
    pushAdminLog({ type: 'card_benefit_clear', userId: uid });
    showToast('Benefício removido.');
    adminLoadCardInfo();
  } catch (e) {
    console.error(e);
    showToast('Erro ao remover benefício.', 'error');
  }
}

async function adminAddSubscription(e) {
  e.preventDefault();
  const uid = document.getElementById('admin-card-uid')?.value?.trim();
  if (!uid) {
    showToast('Carregue um jogador primeiro.', 'error');
    return;
  }
  const name = (document.getElementById('admin-sub-name')?.value || '').trim().slice(0, 80);
  const description = (document.getElementById('admin-sub-desc')?.value || '').trim().slice(0, 160);
  const days = parseInt(document.getElementById('admin-sub-days')?.value, 10);
  const endsLabel = (document.getElementById('admin-sub-ends-label')?.value || '').trim().slice(0, 80);
  const useRealSchedule = document.getElementById('admin-sub-use-real')?.value === 'true';
  if (!name) {
    showToast('Informe o nome da assinatura.', 'error');
    return;
  }
  if (isNaN(days) || days < 1) {
    showToast('Duração mínima: 1 dia.', 'error');
    return;
  }
  const now = Date.now();
  const expiresAt = useRealSchedule ? now + days * 86400000 : null;
  const sid = generateId();
  try {
    await db.ref(`users/${uid}/card/subscriptions/${sid}`).set({
      name,
      description: description || null,
      startsAt: now,
      expiresAt,
      endsLabel: endsLabel || null,
      useRealSchedule: !!useRealSchedule,
      createdAt: now,
      days
    });
    await db.ref(`users/${uid}/card`).update({ updatedAt: now });
    pushAdminLog({
      type: 'card_subscription_add',
      userId: uid,
      productName: name,
      amount: days
    });
    const modeMsg = useRealSchedule
      ? `${days} dia${days > 1 ? 's' : ''} reais (auto-expira)`
      : `${days} dia${days > 1 ? 's' : ''} no calendário RPG (você remove quando acabar)`;
    showToast(`Assinatura "${name}" adicionada · ${modeMsg}.`);
    const nameEl = document.getElementById('admin-sub-name');
    const descEl = document.getElementById('admin-sub-desc');
    const daysEl = document.getElementById('admin-sub-days');
    const labelEl = document.getElementById('admin-sub-ends-label');
    if (nameEl) nameEl.value = '';
    if (descEl) descEl.value = '';
    if (daysEl) daysEl.value = '30';
    if (labelEl) labelEl.value = '';
    adminLoadCardInfo();
  } catch (err) {
    console.error(err);
    showToast('Erro ao adicionar assinatura.', 'error');
  }
}

async function adminRemoveSubscription(subId) {
  const uid = document.getElementById('admin-card-uid')?.value?.trim();
  if (!uid || !subId) {
    showToast('Carregue um jogador primeiro.', 'error');
    return;
  }
  const ok = await gsConfirm({
    title: 'Remover assinatura',
    body: 'Remover esta assinatura do cartão do jogador?',
    confirmLabel: 'Remover',
    danger: true
  });
  if (!ok) return;
  try {
    await db.ref(`users/${uid}/card/subscriptions/${subId}`).remove();
    await db.ref(`users/${uid}/card`).update({ updatedAt: Date.now() });
    pushAdminLog({ type: 'card_subscription_remove', userId: uid, productName: subId });
    showToast('Assinatura removida.');
    adminLoadCardInfo();
  } catch (e) {
    console.error(e);
    showToast('Erro ao remover assinatura.', 'error');
  }
}
