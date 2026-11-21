const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(profile={name:'Jogador',balance:100}){
  const elements=new Map();const field=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',hidden:false,disabled:false,contains:()=>false,setAttribute(){},focus(){}});return elements.get(id)};
  const calls=[];let confirmations=0;
  const scope=vm.createContext({document:{getElementById:field,querySelectorAll:()=>[],activeElement:null,addEventListener(){}},state:{user:{uid:'player'},profile,orders:[]},db:{ref(p=''){return {once:async()=>({val:()=>structuredClone(profile)}),update:async data=>calls.push({p,data}),transaction:async fn=>{const next=fn(profile);calls.push({p,next});return {committed:!!next,snapshot:{val:()=>next}};}}}},structuredClone,console});
  for(const file of ['js/core/utils.js','js/features/systems/bank.js','js/features/systems/card-design.js','js/features/systems/bank-view.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),scope);
  scope.showToast=()=>{};scope.pushAdminLog=()=>{};scope.gsConfirm=async()=>{confirmations++;return false};scope.generateId=()=> 'entry';
  const ui=vm.runInContext('bankUi',scope);scope.bankResetUi('player');return {scope,ui,field,calls,confirmations:()=>confirmations};
}

test('bank totals include every active loan and respect a remaining balance of zero',()=>{
  const profile={balance:-100,loans:{a:{status:'active',amount:500,remaining:0},b:{status:'active',amount:200,remaining:50},c:{status:'paid',amount:900},d:{status:'pending',amount:300}}};
  const {scope}=setup(profile),result=scope.bankSummary(profile);assert.equal(result.debt,50);assert.equal(result.room,199900);assert.equal(result.active.length,2);assert.equal(scope.bankLoanRemaining(profile.loans.a),0);
});

test('RPG subscription deadlines remain informational and do not expire with elapsed real time',()=>{
  const sub={name:'VIP',days:30,useRealSchedule:false,expiresAt:1,endsLabel:'Até o fim do torneio'};
  const {scope}=setup();assert.equal(scope.isSubscriptionActive(sub,99999999999999),true);assert.equal(scope.bankSubscriptionDeadline(sub),'Até o fim do torneio');assert.equal(scope.bankSubscriptionDeadline({days:30}),'30 dias no RPG');
});

test('ledger filters combine accents, direction and real dates without dropping saved entries',()=>{
  const {scope}=setup(),now=1700000000000,rows=[{id:'a',label:'Táxi do porto',type:'rp_spend',category:'transporte',amount:-20,createdAt:now-1000},{id:'b',label:'Táxi reembolsado',type:'refund',amount:20,createdAt:now-1000},{id:'c',label:'Táxi antigo',amount:-5,createdAt:now-40*86400000}];
  assert.deepEqual(Array.from(scope.bankFilterLedger(rows,{query:'taxi',direction:'out',period:'30'},now),r=>r.id),['a']);assert.equal(rows.length,3);assert.equal(scope.bankFilterLedger(rows,{},now).length,3);
});

test('render is read-only, starts with the ledger collapsed and preserves unsent drafts on refresh',()=>{
  const profile={name:'Player',balance:100,inventory:{saved:{count:2}},card:{subscriptions:{vip:{name:'VIP',days:30}}},ledger:{old:{amount:10,label:'Old'}}};
  const before=JSON.stringify(profile),{scope,ui,field,calls}=setup(profile);ui.spend.amount='15';ui.spend.description='Viagem ainda não registrada';
  scope.getLedgerEntries=()=>{throw Error('Closed ledger must not build the transaction list')};scope.renderBank();
  assert.equal(ui.ledgerOpen,false);assert.match(field('bank-root').innerHTML,/value="15"/);assert.match(field('bank-root').innerHTML,/Viagem ainda não registrada/);assert.equal(JSON.stringify(profile),before);assert.equal(calls.length,0);
});

test('spent amount transaction preserves all existing player records and rejects duplicates, stale balance and blocked cards',()=>{
  const {scope}=setup(),profile={name:'Player',balance:100,inventory:{old:{count:3}},loans:{old:{amount:30}},card:{subscriptions:{vip:{name:'VIP'}}},ledger:{old:{amount:5}},custom:{untouched:true}};
  const result=scope.bankSpendUpdate(profile,100,25,'new',{label:'Taxi',createdAt:1});assert.equal(result.balance,75);assert.equal(result.ledger.new.amount,-25);assert.equal(result.ledger.old,profile.ledger.old);
  for(const key of ['name','inventory','loans','card','custom'])assert.equal(result[key],profile[key]);assert.equal(profile.balance,100);
  assert.equal(scope.bankSpendUpdate(profile,99,25,'new',{}),undefined);assert.equal(scope.bankSpendUpdate(result,75,25,'new',{}),undefined);assert.equal(scope.bankSpendUpdate({...profile,card:{status:'suspended'}},100,5,'new',{}),undefined);assert.equal(scope.bankSpendUpdate(profile,100,200101,'new',{}),undefined);
});

test('cancelled spend and double submit perform no writes',async()=>{
  const {scope,field,calls,confirmations}=setup();field('rp-spend-amount').value='20';field('rp-spend-desc').value='Taxi';
  let resolve;scope.gsConfirm=()=>new Promise(r=>{resolve=r});const first=scope.cardRpSpend({preventDefault(){}});await Promise.resolve();await Promise.resolve();
  await scope.cardRpSpend({preventDefault(){}});resolve(false);await first;assert.equal(calls.length,0);
});

test('loan payment writes only balance, that loan, its administrative status and one new ledger entry; no deletion',()=>{
  const user={balance:1000,inventory:{saved:{}},card:{subscriptions:{saved:{}}},loans:{l:{status:'active',amount:500,remaining:100},other:{status:'active',amount:700,remaining:500}},ledger:{old:{amount:10}}};
  const before=JSON.stringify(user),{scope}=setup(user),result=scope.bankLoanPaymentUpdates('player','l',user,100,'new',123);
  assert.equal(result.remaining,0);assert.equal(result.after,900);assert.equal(result.updates['loanRequests/l/status'],'paid');assert.equal(result.updates['users/player/ledger/new'].amount,-100);
  assert.ok(Object.entries(result.updates).every(([p,v])=>v!==null&&!p.includes('/inventory')&&!p.includes('/card')&&!p.includes('/other')&&!p.endsWith('/ledger/old')));assert.equal(JSON.stringify(user),before);
});

test('cancelled loan payment leaves balance, debt and ledger untouched',async()=>{
  const user={name:'Player',balance:1000,loans:{l:{status:'active',amount:500,remaining:100}},ledger:{old:{amount:20}}};const before=JSON.stringify(user),{scope,field,calls}=setup(user);field('loan-pay-amount').value='50';await scope.payLoan('l');assert.equal(calls.length,0);assert.equal(JSON.stringify(user),before);
});

test('partial payment retains active loan state and honors available margin down to the floor',()=>{
  const {scope}=setup(),user={balance:-199900,loans:{l:{status:'active',amount:200,remaining:200}}};
  const result=scope.bankLoanPaymentUpdates('player','l',user,100,'new');assert.equal(result.after,-200000);assert.equal(result.remaining,100);assert.equal(result.updates['loanRequests/l/status'],undefined);
  assert.throws(()=>scope.bankLoanPaymentUpdates('player','l',user,101,'new'),/Limite/);assert.throws(()=>scope.bankLoanPaymentUpdates('player','l',user,201,'new'),/Confira/);
});
