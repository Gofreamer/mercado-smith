/* Global Smith — Banco + Cartão RP + Extrato + Gasto RP + Empréstimo + Admin cartão */

/** Saldo mínimo permitido (negativo até este valor). */
const BALANCE_FLOOR = -200000;

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

function balanceFloorLabel() {
  return formatMoney(Math.abs(BALANCE_FLOOR));
}

/** Retorna null se ok, ou mensagem de erro se ultrapassar o piso. */
function validateBalanceFloor(newBal) {
  if (newBal < BALANCE_FLOOR) {
    return `Limite de crédito estourado. Mínimo permitido: −${balanceFloorLabel()}.`;
  }
  return null;
}

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
    if (typeof bankCaptureSpend === 'function') bankCaptureSpend();
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

let bankActionBusy = false;
function bankPositiveAmount(value) {
  const n=Number(value),cents=Math.round(n*100);
  return Number.isFinite(n)&&n>0&&Number.isSafeInteger(cents)&&cents>0&&Math.abs(n*100-cents)<0.00001?cents/100:null;
}
function bankLoanRemaining(loan) {return Math.max(0,Number(loan?.remaining ?? loan?.amount)||0);}
async function bankRunAction(action) {
  if(bankActionBusy||!state.user||!state.profile)return;
  const uid=state.user.uid;bankActionBusy=true;
  if(typeof bankSetBusy==='function')bankSetBusy(true);
  try {await action(uid);} catch(error){console.error(error);showToast(error.message||'Não foi possível concluir a operação.','error');}
  finally {bankActionBusy=false;if(typeof bankSetBusy==='function')bankSetBusy(false);}
}
function bankSpendUpdate(user,expectedBalance,amount,id,entry) {
  if(!user||getCardStatus(user)!=='active'||user.ledger?.[id]||(Number(user.balance)||0)!==expectedBalance)return;
  const balance=Math.round((expectedBalance-amount)*100)/100;
  if(bankPositiveAmount(amount)==null||!Number.isFinite(balance)||validateBalanceFloor(balance))return;
  return {...user,balance,ledger:{...(user.ledger||{}),[id]:{...entry,type:'rp_spend',amount:-amount,balanceAfter:balance}}};
}
async function bankUseProfile(uid,profile,notice='') {
  if(state.user?.uid!==uid)return;
  state.profile=profile;
  if(typeof bankUi!=='undefined')bankUi.notice=notice;
  if(typeof updateBalanceUI==='function')updateBalanceUI();
  renderBank();
}
async function cardRpSpend(event) {
  event.preventDefault();
  const amount=bankPositiveAmount(document.getElementById('rp-spend-amount')?.value),desc=(document.getElementById('rp-spend-desc')?.value||'').trim().slice(0,120),rawCategory=document.getElementById('rp-spend-cat')?.value,category=Object.hasOwn(RP_SPEND_CATEGORIES,rawCategory)?rawCategory:'outros';
  if(amount==null)return showToast('Informe um valor positivo com até duas casas decimais.','error');
  if(!desc)return showToast('Descreva o gasto.','error');
  await bankRunAction(async uid=>{
    const user=(await db.ref('users/'+uid).once('value')).val();
    if(!user)throw Error('Conta não encontrada. Atualize a página.');
    if(getCardStatus(user)!=='active')throw Error('Este cartão está bloqueado para novos gastos.');
    const balance=Number(user.balance)||0,after=Math.round((balance-amount)*100)/100,error=validateBalanceFloor(after);
    if(error){await bankUseProfile(uid,user);throw Error(error);}
    const ok=await gsConfirm({title:'Confirmar gasto no cartão',body:'Confira o gasto de <strong>'+escapeHTML(getCardHolder(user))+'</strong>.',rows:[{label:'Categoria',value:RP_SPEND_CATEGORIES[category]},{label:'Descrição',value:desc},{label:'Valor do gasto',value:formatMoney(amount)},{label:'Saldo atual',value:formatMoney(balance)},{label:'Saldo após o gasto',value:formatMoney(after),warn:after<0}],confirmLabel:after<0?'Confirmar no crédito':'Confirmar gasto',danger:after<0});
    if(!ok||state.user?.uid!==uid)return;
    const id=generateId(),entry={label:desc,category,createdAt:Date.now()};
    const result=await db.ref('users/'+uid).transaction(current=>bankSpendUpdate(current,balance,amount,id,entry),undefined,false);
    if(!result.committed){const latest=(await db.ref('users/'+uid).once('value')).val();if(latest)await bankUseProfile(uid,latest);throw Error('O saldo ou o cartão mudou durante a revisão. Confira a prévia e tente novamente.');}
    if(typeof bankUi!=='undefined'&&bankUi.uid===uid)bankUi.spend={category,amount:'',description:''};
    await bankUseProfile(uid,result.snapshot.val(),'Gasto registrado: −'+formatMoney(amount)+' · saldo atualizado '+formatMoney(after)+'.');
    pushAdminLog({type:'rp_spend',userId:uid,userName:user.name,amount,productName:desc});
    showToast('Gasto registrado. Saldo atualizado: '+formatMoney(after));
  });
}
async function requestLoan(event) {
  event.preventDefault();
  const amount=bankPositiveAmount(document.getElementById('loan-amount')?.value),reason=(document.getElementById('loan-reason')?.value||'').trim().slice(0,120);
  if(amount==null||amount<100)return showToast('Valor mínimo para solicitar: $ 100.','error');
  await bankRunAction(async uid=>{
    const user=(await db.ref('users/'+uid).once('value')).val();
    if(!user)throw Error('Conta não encontrada.');
    if(getCardStatus(user)==='cancelled')throw Error('Cartão cancelado. Fale com a mesa para solicitar crédito.');
    if(Object.values(user.loans||{}).some(l=>l.status==='pending'||l.status==='active'))throw Error('Já existe um empréstimo ativo ou um pedido em análise.');
    const ok=await gsConfirm({title:'Enviar pedido de empréstimo',body:'O crédito depende da aprovação da mesa.',rows:[{label:'Valor solicitado',value:formatMoney(amount)},{label:'Motivo',value:reason||'Não informado'}],confirmLabel:'Enviar pedido'});
    if(!ok||state.user?.uid!==uid)return;
    const id=generateId(),now=Date.now(),request={userId:uid,userName:user.name||'',amount,reason,status:'pending',createdAt:now};
    await db.ref().update({['users/'+uid+'/loans/'+id]:{...request,remaining:amount},['loanRequests/'+id]:request});
    if(typeof bankUi!=='undefined'&&bankUi.uid===uid){bankUi.request={amount:'',reason:''};bankUi.loanRequestOpen=false;}
    const latest=(await db.ref('users/'+uid).once('value')).val();if(latest)await bankUseProfile(uid,latest,'Pedido enviado à mesa. O valor será creditado após a aprovação.');
    pushAdminLog({type:'loan_request',userId:uid,userName:user.name,amount});showToast('Pedido enviado à mesa.');
  });
}
async function cancelLoanRequest(loanId) {
  await bankRunAction(async uid=>{
    const user=(await db.ref('users/'+uid).once('value')).val(),loan=user?.loans?.[loanId];
    if(!loan||loan.status!=='pending')throw Error('Este pedido não está mais em análise. Atualize sua conta.');
    if(!(await gsConfirm({title:'Cancelar solicitação',body:'Cancelar o pedido de '+formatMoney(loan.amount)+'? O registro continuará no histórico.',confirmLabel:'Cancelar solicitação',danger:true}))||state.user?.uid!==uid)return;
    await db.ref().update({['users/'+uid+'/loans/'+loanId+'/status']:'cancelled',['users/'+uid+'/loans/'+loanId+'/resolvedAt']:Date.now(),['loanRequests/'+loanId+'/status']:'cancelled'});
    const latest=(await db.ref('users/'+uid).once('value')).val();if(latest)await bankUseProfile(uid,latest,'Solicitação cancelada. O histórico foi preservado.');showToast('Solicitação cancelada.');
  });
}
function bankLoanPaymentUpdates(uid,loanId,user,amount,entryId,now=Date.now()) {
  const loan=user?.loans?.[loanId],debt=bankLoanRemaining(loan),balance=Number(user?.balance)||0;
  if(!loan||loan.status!=='active'||bankPositiveAmount(amount)==null||amount>debt)throw Error('Confira o valor e a dívida atual.');
  const after=Math.round((balance-amount)*100)/100,error=validateBalanceFloor(after);if(error)throw Error(error);
  const remaining=Math.round((debt-amount)*100)/100,paid=remaining<=0;
  const updates={['users/'+uid+'/balance']:after,['users/'+uid+'/loans/'+loanId+'/remaining']:remaining,['users/'+uid+'/ledger/'+entryId]:{type:'loan_payment',amount:-amount,balanceAfter:after,label:paid?'Empréstimo quitado':'Pagamento parcial de empréstimo',refId:loanId,createdAt:now}};
  if(paid){updates['users/'+uid+'/loans/'+loanId+'/status']='paid';updates['users/'+uid+'/loans/'+loanId+'/paidAt']=now;updates['loanRequests/'+loanId+'/status']='paid';}
  return {updates,after,remaining,paid};
}
async function payLoan(loanId) {
  const amount=bankPositiveAmount(document.getElementById('loan-pay-amount')?.value);
  if(amount==null)return showToast('Informe um valor positivo para pagar.','error');
  await bankRunAction(async uid=>{
    const user=(await db.ref('users/'+uid).once('value')).val(),id=generateId();
    const payment=bankLoanPaymentUpdates(uid,loanId,user,amount,id);
    const ok=await gsConfirm({title:payment.paid?'Quitar empréstimo':'Confirmar pagamento',body:'O valor será descontado do seu saldo.',rows:[{label:'Pagamento',value:formatMoney(amount)},{label:'Saldo após pagar',value:formatMoney(payment.after),warn:payment.after<0},{label:'Dívida restante',value:formatMoney(payment.remaining)}],confirmLabel:payment.paid?'Confirmar quitação':'Confirmar pagamento',danger:payment.after<0});
    if(!ok||state.user?.uid!==uid)return;
    const fresh=(await db.ref('users/'+uid).once('value')).val();
    if(!fresh||fresh.loans?.[loanId]?.status!=='active'||(Number(fresh.balance)||0)!==(Number(user.balance)||0)||bankLoanRemaining(fresh.loans[loanId])!==bankLoanRemaining(user.loans[loanId])){if(fresh)await bankUseProfile(uid,fresh);throw Error('Seu saldo ou a dívida mudou. Revise o pagamento novamente.');}
    // Saldo, dívida, histórico e espelho administrativo são gravados juntos.
    await db.ref().update(payment.updates);
    if(typeof bankUi!=='undefined'&&bankUi.uid===uid)bankUi.pay.amount='';
    const latest=(await db.ref('users/'+uid).once('value')).val();if(latest)await bankUseProfile(uid,latest,payment.paid?'Empréstimo quitado. Seu saldo foi atualizado.':'Pagamento registrado. Restam '+formatMoney(payment.remaining)+'.');
    showToast(payment.paid?'Empréstimo quitado.':'Pagamento registrado. Restam '+formatMoney(payment.remaining)+'.');
  });
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
