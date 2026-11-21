/* Identidade visual do cartão GS. Sem imagens remotas ou alteração de nível. */
const SMITH_CARD_THEMES = [
  {id:'atlantic',rank:'cliente',name:'Atlântico',finish:'Azul profundo',colors:['#183a50','#7cb6c6']},
  {id:'carbon',rank:'cliente',name:'Carbono',finish:'Grafite fosco',colors:['#222c31','#82aaa4']},
  {id:'copper',rank:'cliente',name:'Cobre',finish:'Cobre acetinado',colors:['#633c32','#ddb79a']},
  {id:'titanium',rank:'prata',name:'Titânio',finish:'Prata escovada',colors:['#c9d1d8','#f2f5f6']},
  {id:'lunar',rank:'prata',name:'Lunar',finish:'Prata azulada',colors:['#a6bbc8','#e0ebf0']},
  {id:'silver-noir',rank:'prata',name:'Prata Noir',finish:'Metal escuro',colors:['#28313b','#bccbd6']},
  {id:'aurum',rank:'ouro',name:'Aurum',finish:'Ouro champagne',colors:['#c6a36a','#f1d9a1']},
  {id:'gold-noir',rank:'ouro',name:'Ouro Noir',finish:'Preto e dourado',colors:['#1d2025','#ccae74']},
  {id:'rose',rank:'ouro',name:'Rosé',finish:'Ouro rosé',colors:['#bd8c7c','#f4d2bd']},
  {id:'glacier',rank:'platina',name:'Glacier',finish:'Platina glacial',colors:['#a9c8d5','#edf8fa']},
  {id:'midnight',rank:'platina',name:'Midnight',finish:'Safira e platina',colors:['#1a304f','#a1cfed']},
  {id:'aurora',rank:'platina',name:'Aurora',finish:'Petróleo iridescente',colors:['#17464b','#bad7c6']},
  {id:'obsidian',rank:'executivo',name:'Obsidian',finish:'Preto e ouro pálido',colors:['#14171c','#c9b57f']},
  {id:'imperial',rank:'executivo',name:'Imperial',finish:'Ameixa e champagne',colors:['#392637','#d8bca4']},
  {id:'ivory',rank:'executivo',name:'Ivory',finish:'Porcelana e ouro',colors:['#e6e1d5','#a28c5e']}
];
const SMITH_CARD_DEFAULTS = {cliente:'atlantic',prata:'titanium',ouro:'aurum',platina:'glacier',executivo:'obsidian'};
const SMITH_CARD_PATTERNS = [{id:'signature',name:'Assinatura GS',description:'Linhas de precisão'},{id:'orbit',name:'Órbitas',description:'Curvas concêntricas'},{id:'minimal',name:'Liso',description:'O metal em destaque'}];
let smithDesigner = null;
function smithCardRank(profile,orders) {return getUserRank(profile,orders||[]);}
function smithThemeUnlocked(theme,rank) {return !!theme && RANK_ORDER.indexOf(theme.rank)<=RANK_ORDER.indexOf(rank.id) && RANK_ORDER.includes(rank.id);}
function smithCardAppearance(profile,rank,override,allowLocked=false) {
  const raw=override||profile?.card?.appearance||{},selected=SMITH_CARD_THEMES.find(t=>t.id===raw.theme);
  const theme=selected&&(allowLocked||smithThemeUnlocked(selected,rank))?selected:SMITH_CARD_THEMES.find(t=>t.id===SMITH_CARD_DEFAULTS[rank.id])||SMITH_CARD_THEMES[0];
  const pattern=SMITH_CARD_PATTERNS.some(p=>p.id===raw.pattern)?raw.pattern:'signature';
  return {theme,pattern};
}
function renderSmithCard(profile,uid,orders=[],options={}) {
  const rank=smithCardRank(profile,orders),appearance=smithCardAppearance(profile,rank,options.appearance,!!options.allowLocked),theme=appearance.theme,status=getCardStatus(profile),holder=options.holderName??getCardHolder(profile);
  const displayedRank=options.allowLocked&&!smithThemeUnlocked(theme,rank)?RANK_THRESHOLDS.find(r=>r.id===theme.rank):rank;
  return `<div class="gscc gscc--${theme.id} gscc--${theme.rank} gscc--${appearance.pattern} gscc--${status}" data-card-theme="${theme.id}" role="group" aria-label="Cartão Global Smith · ${escapeHTML(displayedRank.label)} · ${escapeHTML(cardStatusLabel(status))}">
    <div class="gscc__grain" aria-hidden="true"></div><div class="gscc__ornament" aria-hidden="true"></div><div class="gscc__edge" aria-hidden="true"></div>
    <div class="gscc__content"><div class="gscc__top"><div class="gscc__brand"><strong>GS</strong><span>GLOBAL<br>SMITH</span></div><div class="gscc__tier"><span class="gscc__tier-mark" aria-hidden="true">◇</span>${escapeHTML(displayedRank.label)}</div></div>
      <div class="gscc__hardware"><svg class="gscc__chip" viewBox="0 0 48 36" aria-hidden="true"><rect x="1" y="1" width="46" height="34" rx="6"/><path d="M17 1v10l-6 6 6 7v11M31 1v10l6 6-6 7v11M1 12h11M1 24h11M36 12h11M36 24h11M17 11h14M17 24h14M20 17h8"/></svg><svg class="gscc__contactless" viewBox="0 0 30 34" aria-hidden="true"><path d="M6 13q4 4 0 8M12 8q8 9 0 18M18 3q13 14 0 28"/></svg><span class="gscc__series">GS / ${String(RANK_ORDER.indexOf(displayedRank.id)+1).padStart(2,'0')}</span></div>
      <div class="gscc__number">${status==='cancelled'?'•••• •••• •••• ••••':getCardNumber(uid)}</div>
      <div class="gscc__bottom"><div class="gscc__holder"><small>TITULAR</small><strong>${escapeHTML(holder||'Seu nome')}</strong></div><div class="gscc__expiry"><small>VALIDADE</small><strong>${status==='cancelled'?'—':getCardExpiry(profile)}</strong></div><span class="gscc__seal" aria-hidden="true">GS</span></div>
    </div>${status!=='active'?`<span class="gscc__status">${escapeHTML(cardStatusLabel(status))}</span>`:''}
  </div>`;
}
function smithCardName(value) {return String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,60);}
function smithAppearanceUpdates(uid,profile,rank,draft,originalName,now=Date.now()) {
  if(!uid||/[.#$\[\]/\u0000-\u001f]/.test(uid))throw Error('Conta inválida.');
  if(draft.theme!=='auto') {const theme=SMITH_CARD_THEMES.find(t=>t.id===draft.theme);if(!smithThemeUnlocked(theme,rank))throw Error('Este acabamento ainda não está disponível no nível atual.');}
  if(!SMITH_CARD_PATTERNS.some(p=>p.id===draft.pattern))throw Error('Escolha um desenho de fundo válido.');
  const name=smithCardName(draft.name);if(!name)throw Error('Informe o nome impresso no cartão.');
  const saved=profile.card?.appearance||{},updates={};
  if(draft.theme!==(saved.theme||'auto'))updates[`users/${uid}/card/appearance/theme`]=draft.theme;
  if(draft.pattern!==(saved.pattern||'signature'))updates[`users/${uid}/card/appearance/pattern`]=draft.pattern;
  if(name!==originalName){if(getCardHolder(profile)!==originalName)throw Error('O titular foi atualizado enquanto você personalizava. Reabra o editor para conferir.');updates[`users/${uid}/card/holderName`]=name;}
  if(Object.keys(updates).length)updates[`users/${uid}/card/updatedAt`]=now;
  return updates;
}
function smithDesignerIsAdmin() {return typeof isUserAdmin==='function'?isUserAdmin():!!state.profile?.isAdmin;}
function openAdminSmithCardDesigner() {
  if(typeof adminCards==='undefined'||adminCards.busy||!adminCards.user||!smithDesignerIsAdmin())return;
  if(adminCardsCardDirty())return showToast('Salve os dados do cartão antes de personalizar a aparência.','info');
  openSmithCardDesigner(true);
}
function openSmithCardDesigner(admin=false) {
  if(smithDesigner?.busy||(typeof bankActionBusy!=='undefined'&&bankActionBusy))return;
  const uid=admin?adminCards.uid:state.user?.uid,profile=admin?adminCards.user:state.profile;
  if(!uid||!profile||(admin&&!smithDesignerIsAdmin()))return;
  const orders=admin?[]:state.orders||[],rank=smithCardRank(profile,orders),saved=profile.card?.appearance||{};
  const validTheme=saved.theme==='auto'||SMITH_CARD_THEMES.some(t=>t.id===saved.theme&&smithThemeUnlocked(t,rank))?saved.theme:'auto';
  smithDesigner={uid,profile,orders,rank,admin,busy:false,originalName:getCardHolder(profile),family:SMITH_CARD_THEMES.find(t=>t.id===validTheme)?.rank||rank.id,draft:{theme:validTheme,pattern:smithCardAppearance(profile,rank).pattern,name:getCardHolder(profile)}};
  let dialog=document.getElementById('smith-card-designer');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='smith-card-designer';dialog.className='scd';dialog.setAttribute('aria-labelledby','scd-title');dialog.addEventListener('cancel',event=>{event.preventDefault();closeSmithCardDesigner();});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSmithCardDesigner();}});document.body.appendChild(dialog);}
  dialog.innerHTML=`<header class="scd__heading"><div><span>ATELIÊ GLOBAL SMITH</span><h2 id="scd-title">Seu cartão, sua assinatura.</h2><p>Escolha o acabamento e confira cada detalhe antes de salvar.</p></div><button type="button" class="scd__close" aria-label="Fechar personalização" onclick="closeSmithCardDesigner()" data-scd-lock>✕</button></header>
    <div class="scd__body"><section class="scd__preview" aria-label="Prévia da personalização"><div id="scd-preview"></div><p id="scd-theme-caption"></p><div class="scd__level"><span>Seu nível atual</span><strong>${escapeHTML(rank.label)}</strong></div><p class="scd__hint">Novos acabamentos se liberam conforme seu nível. O número, o saldo e os benefícios continuam os mesmos.</p><div class="scd__locked-message" id="scd-locked-message" role="status" hidden></div></section>
    <form class="scd__controls" onsubmit="event.preventDefault();saveSmithCardDesign()"><fieldset id="scd-fields"><div class="scd__section-heading"><h3>01 <span>Acabamento</span></h3><button type="button" class="scd__auto" id="scd-auto" onclick="smithDesignerAuto()">Acompanhar meu nível</button></div><div class="scd__ranks" role="group" aria-label="Explorar acabamentos por nível">${RANK_THRESHOLDS.map(r=>`<button type="button" data-rank="${r.id}" onclick="smithDesignerFamily(this.dataset.rank)" aria-pressed="${r.id===smithDesigner.family}">${escapeHTML(r.label)}${RANK_ORDER.indexOf(r.id)>RANK_ORDER.indexOf(rank.id)?'<span aria-label="nível ainda não alcançado"> ·</span>':''}</button>`).join('')}</div><div id="scd-themes" class="scd__themes"></div>
      <div class="scd__section-heading scd__separated"><h3>02 <span>Desenho do fundo</span></h3></div><div class="scd__patterns" role="group" aria-label="Desenho do fundo">${SMITH_CARD_PATTERNS.map(p=>`<button type="button" data-pattern="${p.id}" onclick="smithDesignerPattern(this.dataset.pattern)" aria-pressed="${p.id===smithDesigner.draft.pattern}"><span class="scd__pattern-icon scd__pattern-icon--${p.id}" aria-hidden="true"></span><strong>${p.name}</strong><small>${p.description}</small></button>`).join('')}</div>
      <div class="scd__section-heading scd__separated"><h3>03 <span>Nome impresso</span></h3></div><label class="scd__visually-hidden" for="scd-name">Nome impresso no cartão</label><input id="scd-name" maxlength="60" required value="${escapeHTML(smithDesigner.draft.name)}" autocomplete="off" oninput="smithDesignerName(this.value)"/><p class="scd__hint">Este é o titular exibido no cartão. O nome do personagem na conta não muda.</p><p id="scd-message" class="scd__message" role="status" aria-live="polite"></p>
      <footer class="scd__footer"><button class="btn btn-ghost" type="button" onclick="closeSmithCardDesigner()" data-scd-lock>Cancelar</button><button class="btn btn-primary" type="submit" id="scd-save">Salvar personalização</button></footer>
    </fieldset></form></div>`;
  smithDesignerRenderThemes();smithDesignerPreview();if(!dialog.open)dialog.showModal();
}
function smithDesignerRenderThemes() {
  if(!smithDesigner)return;
  const s=smithDesigner,el=document.getElementById('scd-themes');
  el.innerHTML=SMITH_CARD_THEMES.filter(t=>t.rank===s.family).map(t=>{const unlocked=smithThemeUnlocked(t,s.rank);return `<button type="button" class="scd__theme" data-theme="${t.id}" onclick="smithDesignerTheme(this.dataset.theme)" aria-pressed="${s.draft.theme===t.id}" aria-label="${t.name} · ${t.finish}${unlocked?'':' · prévia bloqueada para seu nível'}"><span class="scd__theme-sample gscc--${t.id}"><span>GS</span><i aria-hidden="true"></i></span><strong>${t.name}</strong><small>${t.finish}</small>${unlocked?'':'<span class="scd__lock">Bloqueado</span>'}</button>`;}).join('');
  document.querySelectorAll('.scd__ranks [data-rank]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.rank===s.family)));
}
function smithDesignerPreview() {
  const s=smithDesigner;if(!s)return;
  const a=smithCardAppearance(s.profile,s.rank,s.draft,true),locked=s.draft.theme!=='auto'&&!smithThemeUnlocked(a.theme,s.rank),rankLabel=RANK_THRESHOLDS.find(r=>r.id===a.theme.rank)?.label||'';
  document.getElementById('scd-preview').innerHTML=renderSmithCard(s.profile,s.uid,s.orders,{appearance:s.draft,holderName:smithCardName(s.draft.name)||'Seu nome',allowLocked:true});
  document.getElementById('scd-theme-caption').textContent=a.theme.name+' · '+a.theme.finish+(s.draft.theme==='auto'?' · acompanha seu nível':'');
  const message=document.getElementById('scd-locked-message');message.hidden=!locked;message.textContent=locked?`Prévia do nível ${rankLabel}. Alcance esse nível para salvar este acabamento.`:'';
  document.getElementById('scd-save').disabled=locked||s.busy;
  document.getElementById('scd-auto').setAttribute('aria-pressed',String(s.draft.theme==='auto'));
  document.querySelectorAll('.scd__patterns [data-pattern]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.pattern===s.draft.pattern)));
}
function smithDesignerFamily(rank) {if(!smithDesigner||smithDesigner.busy||!RANK_ORDER.includes(rank))return;smithDesigner.family=rank;smithDesignerRenderThemes();}
function smithDesignerTheme(id) {if(!smithDesigner||smithDesigner.busy||!SMITH_CARD_THEMES.some(t=>t.id===id))return;smithDesigner.draft.theme=id;smithDesignerRenderThemes();smithDesignerPreview();}
function smithDesignerPattern(id) {if(!smithDesigner||smithDesigner.busy||!SMITH_CARD_PATTERNS.some(p=>p.id===id))return;smithDesigner.draft.pattern=id;smithDesignerPreview();}
function smithDesignerName(value) {if(smithDesigner&&!smithDesigner.busy){smithDesigner.draft.name=value;smithDesignerPreview();}}
function smithDesignerAuto() {if(!smithDesigner||smithDesigner.busy)return;smithDesigner.draft.theme='auto';smithDesigner.family=smithDesigner.rank.id;smithDesignerRenderThemes();smithDesignerPreview();}
function closeSmithCardDesigner() {if(smithDesigner?.busy)return;document.getElementById('smith-card-designer')?.close();smithDesigner=null;}
async function saveSmithCardDesign() {
  const s=smithDesigner;if(!s||s.busy)return;
  s.busy=true;document.getElementById('scd-fields').disabled=true;document.querySelectorAll('#smith-card-designer [data-scd-lock]').forEach(el=>el.disabled=true);document.getElementById('scd-save').disabled=true;
  const message=document.getElementById('scd-message');message.textContent='Salvando seu cartão…';
  try {
    if(!state.user||(s.admin?!smithDesignerIsAdmin():state.user.uid!==s.uid))throw Error('Sua sessão mudou. Reabra a personalização.');
    const fresh=(await db.ref('users/'+s.uid).once('value')).val();if(!fresh)throw Error('Conta não encontrada.');
    const rank=smithCardRank(fresh,s.admin?[]:state.orders),updates=smithAppearanceUpdates(s.uid,fresh,rank,s.draft,s.originalName);
    if(!state.user||(s.admin?!smithDesignerIsAdmin():state.user.uid!==s.uid))throw Error('Sua sessão mudou. Reabra a personalização.');
    if(Object.keys(updates).length)await db.ref().update(updates);
    if(s.admin){if(typeof adminCards!=='undefined'&&adminCards.uid===s.uid)await adminCardsRefresh(s.uid,true);}else if(state.user?.uid===s.uid){const after=(await db.ref('users/'+s.uid).once('value')).val();if(after){state.profile=after;if(state.currentView==='bank')renderBank();}}
    s.busy=false;closeSmithCardDesigner();showToast(Object.keys(updates).length?'Personalização salva. Seu cartão está pronto.':'Seu cartão já está com essa personalização.','success');
  } catch(error) {console.error(error);message.textContent=error.message||'Não foi possível salvar. Tente novamente.';s.busy=false;document.getElementById('scd-fields').disabled=false;document.querySelectorAll('#smith-card-designer [data-scd-lock]').forEach(el=>el.disabled=false);smithDesignerPreview();}
}
