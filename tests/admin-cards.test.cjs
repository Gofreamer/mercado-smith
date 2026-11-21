const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function setup(db={ref(){throw Error('Unexpected database access')}}){
  const els=new Map(); const field=id=>{if(!els.has(id))els.set(id,{value:'',hidden:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},reset(){},focus(){},scrollIntoView(){}});return els.get(id)};
  const scope=vm.createContext({document:{getElementById:field,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},state:{allUsers:{}},db,showToast(){},pushAdminLog(){},generateId:()=> 'entry',gsConfirm:async()=>true,console});
  for(const file of ['js/core/utils.js','js/features/systems/bank.js','js/features/admin/admin-cards.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope);
  scope.showToast=()=>{};scope.gsConfirm=async()=>true;
  const model=vm.runInContext('adminCards',scope);
  field('admin-card-status').value='active';field('admin-sub-days').value='30';field('admin-sub-use-real').value='false';field('ac-money-kind').value='credit';
  return {scope,model,field};
}

test('card directory searches accents, holder and UID without changing player identity',()=>{
  const {scope}=setup();const users={one:{name:'João',email:'j@rpg.test',card:{holderName:'Capitão',status:'suspended'}},two:{name:'Ana',uid:'wrong',balance:20}};
  assert.deepEqual(Array.from(scope.adminCardsFilterUsers(users,'joao','suspended'),u=>u.uid),['one']);
  assert.deepEqual(Array.from(scope.adminCardsFilterUsers(users,'capitao'),u=>u.uid),['one']);
  assert.equal(scope.adminCardsFilterUsers(users,'','active')[0].uid,'two');assert.equal(users.two.uid,'wrong');
});

test('credit transaction preserves inventory, cards and custom data and refuses stale balances or duplicate entry',()=>{
  const {scope}=setup();const original={name:'Player',balance:100,inventory:{rare:{qty:2}},card:{holderName:'RP',subscriptions:{vip:{name:'VIP'}}},custom:{kept:true},ledger:{old:{amount:5}}};
  const result=scope.adminCardsCreditUpdate(original,100,-25,'new',{label:'Multa',createdAt:1});
  assert.equal(result.balance,75);assert.equal(result.ledger.new.balanceAfter,75);assert.equal(result.ledger.new.amount,-25);
  for(const key of ['inventory','card','custom'])assert.equal(result[key],original[key]);
  assert.equal(original.balance,100);assert.equal(original.ledger.new,undefined);assert.equal(result.ledger.old,original.ledger.old);
  assert.equal(scope.adminCardsCreditUpdate(original,90,20,'new',{}),undefined);
  assert.equal(scope.adminCardsCreditUpdate(result,75,20,'new',{}),undefined);
  assert.equal(scope.adminCardsCreditUpdate(original,100,-200101,'new',{}),undefined);
  assert.equal(scope.adminCardsCreditUpdate(null,0,10,'new',{}),undefined);
});

test('explicit debit accepts positive value, rejects negative, non-finite and fractional cents',()=>{
  const {scope,field}=setup();field('ac-money-kind').value='debit';field('admin-card-credit-amount').value='150.25';assert.equal(scope.adminCardsAmount(),-150.25);
  for(const value of ['','-20','Infinity','0.001','1.234']){field('admin-card-credit-amount').value=value;assert.equal(scope.adminCardsAmount(),null,value);}
});

test('failed player lookup clears the old target and prevents operations on previous player',async()=>{
  let writes=0;const {scope,model,field}=setup({ref(){return {once:async()=>({val:()=>null}),update(){writes++;}}}});
  model.uid='old';model.user={name:'Old'};field('admin-card-holder').value='Old';field('admin-card-uid').value='old';
  await scope.adminChooseCardUser('missing');
  assert.equal(model.uid,null);assert.equal(model.user,null);assert.equal(field('admin-card-uid').value,'');assert.equal(field('ac-selected').hidden,true);assert.equal(model.loading,false);
  await scope.adminCardsRun(async()=>{writes++});assert.equal(writes,0);
});

test('late player response cannot replace the latest chosen card',async()=>{
  let finishA;const {scope,model}=setup({ref(p){return {once:()=>p==='users/a'?new Promise(r=>{finishA=r}):Promise.resolve({val:()=>({name:'B',balance:20})})};}});
  const first=scope.adminChooseCardUser('a');await Promise.resolve();await scope.adminChooseCardUser('b');
  finishA({val:()=>({name:'A',balance:10})});await first;assert.equal(model.uid,'b');assert.equal(model.user.name,'B');
});

test('editing real subscription keeps its precise existing expiry; RPG time never auto-expires',()=>{
  const {scope,model,field}=setup();const expiry=1798000000123;model.subId='vip';model.user={card:{subscriptions:{vip:{useRealSchedule:true,expiresAt:expiry}}}};
  field('admin-sub-name').value='VIP atualizado';field('admin-sub-use-real').value='true';field('ac-sub-date').value=scope.adminCardsLocalDate(expiry);
  assert.equal(scope.adminCardsSubscriptionValues(100).expiresAt,expiry);
  field('admin-sub-use-real').value='false';assert.equal(scope.adminCardsSubscriptionValues(100).expiresAt,null);
  assert.equal(scope.isSubscriptionActive({days:30,useRealSchedule:false},99999999999999),true);
});

test('subscription edit updates only that subscription and leaves creation times, balance and inventory alone',async()=>{
  let written;const user={name:'Player',card:{subscriptions:{vip:{name:'VIP',startsAt:123,createdAt:123,useRealSchedule:false,days:30}}}};
  const {scope,model,field}=setup({ref(){return {update:async u=>{written=u},once:async()=>({val:()=>user})}}});
  model.uid='player';model.user=user;model.subId='vip';field('admin-sub-name').value='Seguro';
  await scope.adminAddSubscription({preventDefault(){}});
  assert.equal(written['users/player/card/subscriptions/vip/name'],'Seguro');
  assert.ok(Object.keys(written).every(k=>k.startsWith('users/player/card/')));
  assert.ok(Object.keys(written).every(k=>!k.endsWith('/createdAt')&&!k.endsWith('/startsAt')));
  assert.equal(user.card.subscriptions.vip.createdAt,123);
});

test('cancelling a reviewed debit never writes player data',async()=>{
  let writes=0;const user={name:'Player',balance:100};const {scope,model,field}=setup({ref(){return {once:async()=>({val:()=>user}),transaction(){writes++}}}});
  model.uid='player';model.user=user;field('admin-card-credit-amount').value='20';field('ac-money-kind').value='debit';scope.gsConfirm=async()=>false;
  await scope.adminCardCredit({preventDefault(){}});assert.equal(writes,0);assert.equal(user.balance,100);assert.equal(model.busy,false);
});
