/* Administração de cartões. Alterações ficam restritas ao jogador selecionado. */
const adminCards = { uid: null, user: null, loading: false, busy: false, request: 0, tab: 'data', subId: null, subBaseline: '' };
const acEl = id => document.getElementById(id);
const acValue = id => acEl(id)?.value || '';
const acNormalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

function adminCardsFilterUsers(users, query = '', status = '') {
  const terms = acNormalize(query).trim().split(/\s+/).filter(Boolean);
  return Object.entries(users || {}).filter(([,u]) => u && typeof u === 'object')
    .map(([uid, user]) => ({ ...user, uid }))
    .filter(u => (!status || getCardStatus(u) === status) && terms.every(term => acNormalize([u.name,u.email,u.uid,u.card?.holderName].join(' ')).includes(term)))
    .sort((a,b) => (a.name || a.email || a.uid).localeCompare(b.name || b.email || b.uid, 'pt-BR'));
}

function initAdminCardsWorkspace() {
  renderAdminCardDirectory();
  adminCardsTab(adminCards.tab);
  adminCardsLock();
}

function renderAdminCardDirectory() {
  const list = acEl('ac-player-list');
  if (!list) return;
  const rows = adminCardsFilterUsers(state.allUsers, acValue('ac-player-search'), acValue('ac-player-status'));
  acEl('ac-player-count').textContent = rows.length;
  list.innerHTML = rows.length ? rows.map(u => `<button type="button" class="ac-player ${adminCards.uid === u.uid ? 'is-selected' : ''}" data-uid="${escapeHTML(u.uid)}" onclick="adminChooseCardUser(this.dataset.uid)" aria-pressed="${adminCards.uid === u.uid}" ${adminCards.busy ? 'disabled' : ''}>
    <span class="ac-avatar" aria-hidden="true">${escapeHTML((u.name || u.email || '?').trim().split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase())}</span>
    <span class="ac-player-info"><strong>${escapeHTML(u.name || 'Sem nome')}</strong><small>${escapeHTML(u.email || u.uid)}</small><span>${formatMoney(u.balance)}</span></span>
    <span class="ac-status-dot ${getCardStatus(u)}" title="${cardStatusLabel(getCardStatus(u))}"><span class="sr-only">${cardStatusLabel(getCardStatus(u))}</span></span></button>`).join('') : '<p class="ac-list-empty">Nenhum jogador neste filtro.</p>';
}

function adminCardsTab(tab) {
  if (!['data','money','subs'].includes(tab)) return;
  adminCards.tab = tab;
  ['data','money','subs'].forEach(key => {
    const button = acEl('ac-tab-' + key), pane = acEl('ac-pane-' + key);
    button?.setAttribute('aria-selected', String(key === tab));
    if (button) button.tabIndex = key === tab ? 0 : -1;
    if (pane) pane.hidden = key !== tab;
  });
}

document.addEventListener('keydown', event => {
  const tab = event.target.closest?.('.ac-tabs [role=tab]');
  if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  const keys = ['data','money','subs'];
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (keys.indexOf(adminCards.tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
  event.preventDefault(); adminCardsTab(keys[index]); acEl('ac-tab-' + keys[index]).focus();
});

function adminCardsLock() {
  const disabled = !adminCards.user || adminCards.loading || adminCards.busy;
  document.querySelectorAll('#admin-tab-cards [data-ac-fields]').forEach(el => { el.disabled = disabled; });
  document.querySelectorAll('#admin-tab-cards [data-ac-lock]').forEach(el => { el.disabled = adminCards.busy || (el.closest('#ac-selected') && disabled); });
  document.querySelectorAll('.ac-player').forEach(el => { el.disabled = adminCards.busy; });
  const root = acEl('ac-selected');
  root?.setAttribute('aria-busy', String(adminCards.loading || adminCards.busy));
}

function adminCardsCardDirty() {
  const u = adminCards.user;
  return !!u && (acValue('admin-card-holder').trim() !== getCardHolder(u) || acValue('admin-card-benefit').trim() !== getCardBenefit(u) || acValue('admin-card-status') !== getCardStatus(u));
}
function adminCardsSubSignature() {
  return JSON.stringify(['admin-sub-name','admin-sub-desc','admin-sub-days','admin-sub-use-real','admin-sub-ends-label','ac-sub-date'].map(acValue));
}
function adminCardsHasDraft() {
  return !!adminCards.user && (adminCardsCardDirty() || !!acValue('admin-card-credit-amount') || !!acValue('admin-card-credit-note') || (adminCards.subBaseline && adminCardsSubSignature() !== adminCards.subBaseline));
}
window.addEventListener('beforeunload', event => { if (adminCardsHasDraft() || adminCards.busy) { event.preventDefault(); event.returnValue = ''; } });

async function adminCardsDiscardDraft() {
  if (!adminCardsHasDraft()) return true;
  adminCards.busy = true; adminCardsLock();
  try { return await gsConfirm({title:'Há alterações sem salvar', body:'Trocar ou atualizar o jogador descarta os campos ainda não salvos deste cartão.', confirmLabel:'Descartar e continuar'}); }
  finally { adminCards.busy = false; adminCardsLock(); }
}

function adminCardsClearSelection() {
  adminCards.uid = null; adminCards.user = null; adminCards.loading = false;
  acEl('admin-card-uid').value = '';
  acEl('ac-selected').hidden = true;
  acEl('ac-empty').hidden = false;
  ['ac-card-form','ac-money-form','ac-sub-form'].forEach(id => acEl(id)?.reset());
  adminCards.subId = null; adminCards.subBaseline = '';
  renderAdminCardDirectory(); adminCardsLock();
}

async function adminChooseCardUser(uid) {
  if (!uid || adminCards.busy || !(await adminCardsDiscardDraft())) return;
  const request = ++adminCards.request;
  adminCardsClearSelection(); adminCards.loading = true; adminCardsLock();
  acEl('ac-load-status').textContent = 'Carregando cartão…';
  try {
    const snap = await db.ref('users/' + uid).once('value');
    if (request !== adminCards.request) return;
    const user = snap.val();
    if (!user) throw Error('Jogador não encontrado. Escolha outro na lista.');
    adminCards.uid = uid; adminCards.user = user;
    acEl('admin-card-uid').value = uid;
    acEl('admin-card-user').value = uid;
    acEl('ac-empty').hidden = true; acEl('ac-selected').hidden = false;
    adminCardsFillCard(); adminCardsNewSubscription(false);
    adminCardsRenderSummary();
    acEl('ac-load-status').textContent = '';
  } catch (error) {
    if (request === adminCards.request) { adminCardsClearSelection(); acEl('ac-load-status').textContent = error.message || 'Não foi possível carregar este cartão.'; }
  } finally {
    if (request === adminCards.request) { adminCards.loading = false; adminCardsLock(); renderAdminCardDirectory(); }
  }
}

async function adminResolveUserRef(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (Object.hasOwn(state.allUsers || {}, raw)) return raw;
  if (!raw.includes('@')) return raw;
  const email = raw.toLowerCase();
  const local = Object.entries(state.allUsers || {}).find(([,u]) => String(u.email || '').toLowerCase() === email);
  if (local) return local[0];
  const snap = await db.ref('users').orderByChild('email').equalTo(email).once('value');
  return Object.keys(snap.val() || {})[0] || null;
}
async function adminLoadCardInfo() {
  if (adminCards.busy) return;
  const input = acValue('admin-card-user').trim();
  if (!input) return showToast('Informe um UID ou e-mail, ou escolha na lista.', 'error');
  if (!(await adminCardsDiscardDraft())) return;
  const request = ++adminCards.request;
  adminCardsClearSelection(); adminCards.loading = true; adminCardsLock();
  acEl('ac-load-status').textContent = 'Buscando jogador…';
  try {
    const uid = await adminResolveUserRef(input);
    if (request !== adminCards.request) return;
    if (!uid) throw Error('Jogador não encontrado.');
    await adminChooseCardUser(uid);
  } catch (error) {
    if (request === adminCards.request) { adminCardsClearSelection(); acEl('ac-load-status').textContent = error.message || 'Não foi possível buscar o jogador.'; }
  }
}
async function adminReloadCard() { if (adminCards.uid) await adminChooseCardUser(adminCards.uid); }

function adminCardsFillCard() {
  const u = adminCards.user;
  acEl('admin-card-holder').value = getCardHolder(u);
  acEl('admin-card-benefit').value = getCardBenefit(u);
  acEl('admin-card-status').value = getCardStatus(u);
  adminCardsPreview();
}
function adminCardsPreview() {
  if (!adminCards.user) return;
  const status = acValue('admin-card-status'), dirty = adminCardsCardDirty();
  acEl('admin-card-preview').innerHTML = `<div class="ac-plastic ${status}"><div class="ac-plastic-top"><strong>GS <span>GLOBAL SMITH</span></strong><span class="ac-card-state">${escapeHTML(cardStatusLabel(status))}</span></div><span class="ac-chip" aria-hidden="true">▥</span><div class="ac-card-number">${getCardNumber(adminCards.uid)}</div><div class="ac-plastic-bottom"><div><small>TITULAR</small><strong>${escapeHTML(acValue('admin-card-holder').trim() || adminCards.user.name || 'Sem titular')}</strong></div><div><small>VALIDADE</small><strong>${getCardExpiry(adminCards.user)}</strong></div></div></div><p class="ac-preview-caption">${dirty ? 'Prévia · salve para aplicar ao jogador' : 'Cartão atual do jogador'}</p>`;
  acEl('ac-card-draft').textContent = dirty ? 'Alterações ainda não salvas.' : 'Nenhuma alteração pendente.';
}
function adminCardsRenderSummary() {
  const u = adminCards.user, uid = adminCards.uid;
  if (!u) return;
  if (state.allUsers) state.allUsers[uid] = u;
  acEl('ac-player-name').textContent = u.name || 'Sem nome';
  acEl('ac-player-email').textContent = u.email || uid;
  acEl('ac-balance').textContent = formatMoney(u.balance);
  acEl('ac-balance').className = Number(u.balance) < 0 ? 'warning' : 'success';
  acEl('ac-margin').textContent = formatMoney(Math.max(0, (Number(u.balance) || 0) - BALANCE_FLOOR));
  acEl('ac-subs-count').textContent = getCardSubscriptions(u).length;
  const status = getCardStatus(u);
  acEl('ac-quick-status').innerHTML = status === 'active' ? '<button type="button" class="btn btn-ghost btn-sm" onclick="adminSetCardStatus(\'suspended\')" data-ac-lock>Suspender cartão…</button>' : '<button type="button" class="btn btn-ghost btn-sm" onclick="adminSetCardStatus(\'active\')" data-ac-lock>Reativar cartão…</button>';
  renderAdminSubsList(u); adminCardsRenderLedger(); adminCardsMoneyPreview(); renderAdminCardDirectory(); adminCardsLock();
}
function adminCardsRenderLedger() {
  const rows = Object.entries(adminCards.user?.ledger || {}).map(([id,e]) => ({...e,id})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8);
  acEl('ac-ledger').innerHTML = rows.length ? rows.map(e => `<div class="ac-ledger-row"><div><strong>${escapeHTML(e.label || ledgerTypeLabel(e.type))}</strong><small>${escapeHTML(formatDateTime(e.createdAt))}</small></div><strong class="mono ${Number(e.amount)<0?'warning':'success'}">${Number(e.amount)>0?'+':''}${formatMoney(e.amount)}</strong></div>`).join('') : '<p class="ac-list-empty">Nenhum lançamento registrado.</p>';
}
function adminCardsAmount() {
  const n = Number(acValue('admin-card-credit-amount'));
  if (!Number.isFinite(n) || n <= 0 || !Number.isSafeInteger(Math.round(n * 100))) return null;
  const amount = Math.round(n * 100) / 100;
  if (!amount || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) return null;
  return acValue('ac-money-kind') === 'debit' ? -amount : amount;
}
function adminCardsMoneyPreview() {
  const el = acEl('ac-money-preview');
  if (!el || !adminCards.user) return;
  const amount = adminCardsAmount(), balance = Number(adminCards.user.balance) || 0;
  if (amount == null) { el.innerHTML = '<span class="ac-hint">Informe um valor positivo. Escolha Crédito ou Débito acima.</span>'; return; }
  const after = Math.round((balance + amount) * 100) / 100, error = validateBalanceFloor(after);
  el.innerHTML = `<div><span>Saldo atual</span><strong>${formatMoney(balance)}</strong></div><div><span>${amount>0?'Crédito':'Débito'}</span><strong class="${amount>0?'success':'warning'}">${amount>0?'+':'−'}${formatMoney(Math.abs(amount))}</strong></div><div class="ac-money-result"><span>Saldo previsto</span><strong class="${error?'text-danger':after<0?'warning':'success'}">${formatMoney(after)}</strong></div>${error?`<p class="text-danger">${escapeHTML(error)}</p>`:''}`;
}

async function adminCardsRun(action) {
  if (adminCards.busy || adminCards.loading || !adminCards.uid || !adminCards.user) return showToast('Escolha um jogador primeiro.', 'error');
  adminCards.busy = true; adminCardsLock();
  const uid = adminCards.uid;
  try { await action(uid); }
  catch (error) { console.error(error); showToast(error.message || 'Não foi possível concluir a operação.', 'error'); }
  finally { adminCards.busy = false; adminCardsLock(); renderAdminCardDirectory(); }
}
async function adminCardsRefresh(uid, fillCard = false) {
  const snap = await db.ref('users/' + uid).once('value');
  if (adminCards.uid !== uid) return;
  const u = snap.val();
  if (!u) { adminCardsClearSelection(); return; }
  adminCards.user = u;
  if (fillCard) adminCardsFillCard();
  adminCardsRenderSummary();
}
async function adminSaveCard(event) {
  event.preventDefault();
  const holderName = acValue('admin-card-holder').trim().slice(0,60), benefit = acValue('admin-card-benefit').trim().slice(0,160), status = acValue('admin-card-status');
  if (!['active','suspended','cancelled'].includes(status)) return;
  if (!adminCardsCardDirty()) return showToast('Nenhuma alteração para salvar.', 'info');
  await adminCardsRun(async uid => {
    const oldStatus = getCardStatus(adminCards.user);
    if (status !== oldStatus && !(await gsConfirm({title:'Alterar estado do cartão', body:`Cartão de <strong>${escapeHTML(adminCards.user.name || uid)}</strong>.`, rows:[{label:'Antes',value:cardStatusLabel(oldStatus)},{label:'Depois',value:cardStatusLabel(status)}],confirmLabel:'Salvar cartão',danger:status!=='active'}))) return;
    await db.ref(`users/${uid}/card`).update({holderName:holderName || null,benefit:benefit || null,status,updatedAt:Date.now()});
    pushAdminLog({type:'card_update',userId:uid,userName:adminCards.user.name,from:oldStatus,to:status,productName:holderName || benefit || status});
    await adminCardsRefresh(uid,true); showToast('Cartão atualizado.');
  });
}

// A transação preserva os campos do jogador e aplica saldo + extrato juntos.
// Se o saldo mudou desde a confirmação, pede uma nova revisão em vez de sobrescrever.
function adminCardsCreditUpdate(user, expectedBalance, amount, ledgerId, entry) {
  if (!user || user.ledger?.[ledgerId] || (Number(user.balance)||0) !== expectedBalance) return;
  const balance = Math.round((expectedBalance + amount)*100)/100;
  if (!Number.isFinite(balance) || validateBalanceFloor(balance)) return;
  return {...user,balance,ledger:{...(user.ledger||{}),[ledgerId]:{...entry,amount,balanceAfter:balance}}};
}
async function adminCardCredit(event) {
  event.preventDefault();
  const amount = adminCardsAmount(), note = acValue('admin-card-credit-note').trim().slice(0,120);
  if (amount == null) return showToast('Informe um valor positivo válido.', 'error');
  await adminCardsRun(async uid => {
    const snap = await db.ref('users/' + uid).once('value'), user = snap.val();
    if (!user) throw Error('Jogador não encontrado.');
    const balance = Number(user.balance)||0, after = Math.round((balance+amount)*100)/100, floor = validateBalanceFloor(after);
    adminCards.user=user; adminCardsRenderSummary();
    if (floor) throw Error(floor);
    const label = note || (amount>0?'Benefício do cartão GS':'Débito administrativo no cartão');
    if (!(await gsConfirm({title:amount>0?'Confirmar crédito':'Confirmar débito',body:`Lançamento para <strong>${escapeHTML(user.name || uid)}</strong>.`,rows:[{label:'Descrição',value:label},{label:'Saldo atual',value:formatMoney(balance)},{label:amount>0?'Adicionar':'Retirar',value:formatMoney(Math.abs(amount))},{label:'Saldo previsto',value:formatMoney(after),warn:after<0}],confirmLabel:amount>0?'Creditar':'Debitar',danger:amount<0}))) return;
    const id=generateId(),entry={type:amount>0?'benefit':'rp_spend',label,category:amount>0?null:'outros',createdAt:Date.now()};
    const result=await db.ref('users/'+uid).transaction(current=>adminCardsCreditUpdate(current,balance,amount,id,entry),undefined,false);
    if (!result.committed) { await adminCardsRefresh(uid); throw Error('O saldo mudou durante a revisão. Confira a prévia atualizada e tente novamente.'); }
    adminCards.user=result.snapshot.val();
    pushAdminLog({type:amount>0?'card_benefit':'card_debit',userId:uid,userName:user.name,amount});
    acEl('ac-money-form').reset(); adminCardsRenderSummary(); showToast(amount>0?'Crédito lançado.':'Débito lançado.');
  });
}
async function adminSetCardStatus(status) {
  if (!['active','suspended','cancelled'].includes(status)) return;
  await adminCardsRun(async uid => {
    if (adminCardsCardDirty()) return showToast('Salve os dados do cartão antes de mudar o estado.', 'info');
    const oldStatus=getCardStatus(adminCards.user);
    if (oldStatus===status) return;
    if (!(await gsConfirm({title:status==='active'?'Reativar cartão':'Suspender cartão',body:`Cartão de <strong>${escapeHTML(adminCards.user.name || uid)}</strong>. Saldo e itens são preservados.`,confirmLabel:status==='active'?'Reativar':'Suspender',danger:status!=='active'}))) return;
    await db.ref(`users/${uid}/card`).update({status,updatedAt:Date.now()});
    pushAdminLog({type:'card_status',userId:uid,from:oldStatus,to:status});
    await adminCardsRefresh(uid,true); showToast('Estado do cartão atualizado.');
  });
}

function adminCardsLocalDate(ts) {
  if (!Number.isFinite(Number(ts)) || !ts) return '';
  const d=new Date(Number(ts));
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function adminCardsNewSubscription(open = true) {
  if (adminCards.busy) return;
  adminCards.subId=null;
  acEl('ac-sub-form')?.reset();
  acEl('ac-sub-editor').open=open;
  acEl('ac-sub-editor-title').textContent='Adicionar assinatura';
  acEl('ac-sub-save').textContent='Adicionar assinatura';
  adminCardsSubscriptionPreview(); adminCards.subBaseline=adminCardsSubSignature();
  if(open) acEl('admin-sub-name').focus();
}
function adminCardsEditSubscription(id) {
  if (adminCards.busy) return;
  const sub=adminCards.user?.card?.subscriptions?.[id];
  if (!sub) return;
  adminCards.subId=id;
  acEl('ac-sub-editor').open=true;
  acEl('ac-sub-editor-title').textContent='Editar assinatura'; acEl('ac-sub-save').textContent='Salvar assinatura';
  acEl('admin-sub-name').value=sub.name || ''; acEl('admin-sub-desc').value=sub.description || '';
  acEl('admin-sub-days').value=sub.days || 30; acEl('admin-sub-use-real').value=String(!!sub.useRealSchedule);
  acEl('admin-sub-ends-label').value=sub.endsLabel || ''; acEl('ac-sub-date').value=adminCardsLocalDate(sub.expiresAt);
  adminCardsSubscriptionPreview(); adminCards.subBaseline=adminCardsSubSignature();
  acEl('ac-sub-editor').scrollIntoView({block:'nearest',behavior:'smooth'}); acEl('admin-sub-name').focus();
}
function adminCardsSubscriptionPreview() {
  const real=acValue('admin-sub-use-real')==='true', editing=!!adminCards.subId;
  acEl('ac-sub-date-wrap').hidden=!(editing&&real);
  acEl('ac-sub-date').required=editing&&real;
  if(editing&&real&&!acValue('ac-sub-date'))acEl('ac-sub-date').value=adminCardsLocalDate(Date.now()+30*86400000);
  const days=Number(acValue('admin-sub-days'));
  acEl('ac-sub-schedule-hint').textContent=real ? editing ? 'O vencimento atual é preservado. Para renovar, escolha uma nova data de expiração acima.' : `Expira automaticamente após ${Number.isInteger(days)&&days>0?days:'…'} dia(s) reais a partir da criação.` : 'Não expira com o relógio real. A mesa remove quando o prazo terminar dentro do RPG.';
}
function renderAdminSubsList(user) {
  const el=acEl('admin-subs-list'); if(!el)return;
  const all=getAllCardSubscriptions(user),filter=acValue('ac-sub-filter') || 'active',now=Date.now();
  const rows=all.filter(s=>filter==='all'||(filter==='active'?isSubscriptionActive(s,now):!isSubscriptionActive(s,now)));
  el.innerHTML=rows.length?rows.map(s=>{const active=isSubscriptionActive(s,now);return `<div class="ac-sub-row"><div><strong>${escapeHTML(s.name||'Assinatura')}</strong><span class="ac-sub-badge ${active?'active':'expired'}">${active?'Ativa':'Expirada'}</span>${s.description?`<p>${escapeHTML(s.description)}</p>`:''}<small>${escapeHTML(formatSubExpiry(s))}</small><small>${s.useRealSchedule?'Relógio real':'Calendário do RPG · controle da mesa'}</small></div><div class="ac-sub-actions"><button type="button" class="btn btn-ghost btn-sm" data-sub="${escapeHTML(s.id)}" onclick="adminCardsEditSubscription(this.dataset.sub)" data-ac-lock>Editar</button><button type="button" class="btn btn-ghost btn-sm text-danger" data-sub="${escapeHTML(s.id)}" onclick="adminRemoveSubscription(this.dataset.sub)" data-ac-lock>Remover…</button></div></div>`;}).join(''):`<div class="ac-list-empty">${filter==='expired'?'Nenhuma assinatura expirada.':filter==='active'?'Nenhuma assinatura ativa.':'Nenhuma assinatura cadastrada.'}</div>`;
}
function adminCardsSubscriptionValues(now=Date.now()) {
  const name=acValue('admin-sub-name').trim().slice(0,80),days=Number(acValue('admin-sub-days')),real=acValue('admin-sub-use-real')==='true';
  if(!name)throw Error('Informe o nome da assinatura.');
  if(!Number.isInteger(days)||days<1||days>3650)throw Error('Use uma duração entre 1 e 3650 dias.');
  const original=adminCards.user?.card?.subscriptions?.[adminCards.subId];
  const sameExpiry=original?.useRealSchedule && acValue('ac-sub-date')===adminCardsLocalDate(original.expiresAt);
  const expiresAt=real?(adminCards.subId?(sameExpiry?original.expiresAt:new Date(acValue('ac-sub-date')).getTime()):now+days*86400000):null;
  if(real&&!Number.isFinite(expiresAt))throw Error('Informe uma data de expiração válida.');
  return {name,description:acValue('admin-sub-desc').trim().slice(0,160)||null,days,useRealSchedule:real,expiresAt,endsLabel:acValue('admin-sub-ends-label').trim().slice(0,80)||null};
}
async function adminAddSubscription(event) {
  event.preventDefault();
  await adminCardsRun(async uid => {
    const now=Date.now(),values=adminCardsSubscriptionValues(now),editing=adminCards.subId,id=editing||generateId();
    const updates={};
    for(const [key,value] of Object.entries(values))updates[`users/${uid}/card/subscriptions/${id}/${key}`]=value;
    if(!editing){updates[`users/${uid}/card/subscriptions/${id}/startsAt`]=now;updates[`users/${uid}/card/subscriptions/${id}/createdAt`]=now;}
    updates[`users/${uid}/card/updatedAt`]=now;
    await db.ref().update(updates);
    pushAdminLog({type:editing?'card_subscription_update':'card_subscription_add',userId:uid,productName:values.name,amount:values.days});
    // A operação terminou; libera apenas o reset local, sem abrir outra gravação.
    adminCards.subId=null; acEl('ac-sub-form').reset(); acEl('ac-sub-editor').open=false;
    acEl('ac-sub-editor-title').textContent='Adicionar assinatura'; acEl('ac-sub-save').textContent='Adicionar assinatura';
    adminCardsSubscriptionPreview();adminCards.subBaseline=adminCardsSubSignature();
    await adminCardsRefresh(uid); showToast(editing?'Assinatura atualizada.':'Assinatura adicionada.');
  });
}
async function adminRemoveSubscription(id) {
  await adminCardsRun(async uid => {
    const sub=adminCards.user.card?.subscriptions?.[id];if(!sub)return;
    if(!(await gsConfirm({title:'Remover assinatura',body:`Remover <strong>${escapeHTML(sub.name||'Assinatura')}</strong> do cartão de ${escapeHTML(adminCards.user.name||uid)}?`,confirmLabel:'Remover assinatura',danger:true})))return;
    await db.ref().update({[`users/${uid}/card/subscriptions/${id}`]:null,[`users/${uid}/card/updatedAt`]:Date.now()});
    pushAdminLog({type:'card_subscription_remove',userId:uid,productName:sub.name||id});
    if(adminCards.subId===id){adminCards.subId=null;acEl('ac-sub-form').reset();acEl('ac-sub-editor').open=false;adminCardsSubscriptionPreview();adminCards.subBaseline=adminCardsSubSignature();}
    await adminCardsRefresh(uid);showToast('Assinatura removida.');
  });
}
async function adminCardsClearLedger() {
  await adminCardsRun(async uid => {
    if(!(await gsConfirm({title:'Limpar extrato do jogador',body:`Apagar todo o extrato de <strong>${escapeHTML(adminCards.user.name||uid)}</strong>? O saldo, o cartão e o inventário permanecem.`,confirmLabel:'Limpar extrato',danger:true})))return;
    await db.ref(`users/${uid}/ledger`).remove();pushAdminLog({type:'ledger_clear',userId:uid});
    await adminCardsRefresh(uid);showToast('Extrato limpo. Saldo preservado.');
  });
}
