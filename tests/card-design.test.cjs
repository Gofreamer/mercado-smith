const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){const scope=vm.createContext({});for(const file of ['js/core/utils.js','js/features/systems/bank.js','js/features/systems/card-design.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),scope);return scope;}
const rank=id=>({id,label:id});

test('all five real ranks have three finishes and automatic appearance advances without writing a profile',()=>{
  const s=setup(),themes=vm.runInContext('SMITH_CARD_THEMES',s),profile={name:'Player',balance:100};const before=JSON.stringify(profile);
  for(const id of ['cliente','prata','ouro','platina','executivo'])assert.equal(themes.filter(t=>t.rank===id).length,3);
  assert.equal(s.smithCardAppearance(profile,rank('cliente')).theme.id,'atlantic');assert.equal(s.smithCardAppearance(profile,rank('platina')).theme.id,'glacier');assert.equal(JSON.stringify(profile),before);
});

test('locked or unknown saved themes fall back safely, without deleting the preference',()=>{
  const s=setup(),profile={card:{appearance:{theme:'obsidian',pattern:'orbit',futureSetting:true}}};
  assert.equal(s.smithCardAppearance(profile,rank('cliente')).theme.id,'atlantic');assert.equal(profile.card.appearance.theme,'obsidian');
  assert.equal(s.smithCardAppearance(profile,rank('executivo')).theme.id,'obsidian');
  assert.equal(s.smithCardAppearance({card:{appearance:{theme:'url(javascript:bad)',pattern:'bad'}}},rank('ouro')).theme.id,'aurum');
});

test('a higher level keeps access to lower finishes and the printed rank remains the actual player rank',()=>{
  const s=setup(),profile={name:'Player',rankOverride:'platina',createdAt:1700000000000,card:{appearance:{theme:'titanium'}}};
  const html=s.renderSmithCard(profile,'player',[]);assert.match(html,/data-card-theme="titanium"/);assert.match(html,/Platina/);assert.doesNotMatch(html,/data-card-theme="obsidian"/);
});

test('rendering card data escapes printed names, preserves numbers and masks cancelled cards',()=>{
  const s=setup(),profile={name:'<img src=x onerror=evil()>',rankOverride:'ouro',createdAt:1700000000000};
  const html=s.renderSmithCard(profile,'player',[]);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.ok(html.includes(s.getCardNumber('player')));
  const cancelled=s.renderSmithCard({...profile,card:{status:'cancelled'}},'player',[]);assert.ok(!cancelled.includes(s.getCardNumber('player')));assert.match(cancelled,/Cancelado/);
});

test('saving appearance touches only changed cosmetic card leaves, preserving player and subscription data',()=>{
  const s=setup(),profile={name:'Personagem',balance:123,inventory:{saved:{}},ledger:{saved:{}},loans:{saved:{}},card:{holderName:'Titular',status:'suspended',benefit:'VIP',subscriptions:{saved:{}},appearance:{theme:'atlantic',pattern:'signature',unknown:'kept'}}};const before=JSON.stringify(profile);
  const updates=s.smithAppearanceUpdates('player',profile,rank('platina'),{theme:'glacier',pattern:'orbit',name:'Nome no cartão'},'Titular',1);
  assert.equal(updates['users/player/card/appearance/theme'],'glacier');assert.equal(updates['users/player/card/holderName'],'Nome no cartão');
  assert.ok(Object.keys(updates).every(p=>/^users\/player\/card\/(appearance\/(theme|pattern)|holderName|updatedAt)$/.test(p)));
  assert.ok(Object.values(updates).every(v=>v!==null));assert.equal(JSON.stringify(profile),before);
});

test('saving the existing default is a no-op and choosing auto does not change rank',()=>{
  const s=setup(),profile={name:'Player',rankOverride:'ouro'};
  assert.equal(Object.keys(s.smithAppearanceUpdates('player',profile,rank('ouro'),{theme:'auto',pattern:'signature',name:'Player'},'Player')).length,0);
  const updates=s.smithAppearanceUpdates('player',{...profile,card:{appearance:{theme:'gold-noir'}}},rank('ouro'),{theme:'auto',pattern:'signature',name:'Player'},'Player',1);
  assert.equal(updates['users/player/card/appearance/theme'],'auto');assert.equal(updates['users/player/rankOverride'],undefined);
});

test('save rejects locked themes, unknown patterns and a conflicting holder change',()=>{
  const s=setup(),profile={name:'Player'};
  assert.throws(()=>s.smithAppearanceUpdates('player',profile,rank('cliente'),{theme:'obsidian',pattern:'signature',name:'Player'},'Player'),/nível/);
  assert.throws(()=>s.smithAppearanceUpdates('player',profile,rank('cliente'),{theme:'auto',pattern:'injected',name:'Player'},'Player'),/desenho/);
  assert.throws(()=>s.smithAppearanceUpdates('player',{name:'Alterado pela mesa'},rank('cliente'),{theme:'auto',pattern:'signature',name:'Novo'},'Original'),/titular/);
});
