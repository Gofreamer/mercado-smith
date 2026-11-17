const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workspace = fs.readFileSync(path.join(__dirname, '../js/features/admin/admin-workspace.js'), 'utf8');

test('catalog filters combine search, category, vendor and limited stock', () => {
  const scope = vm.createContext({});
  vm.runInContext(workspace, scope);
  const products = [
    {id:'1', name:'Épico', category:'exoticos', vendorId:'npc', stock:3},
    {id:'2', name:'Épico', category:'exoticos', vendorId:'npc', stock:null},
    {id:'3', name:'Épico', category:'exoticos', stock:0}
  ];
  const items = scope.adminFilterProducts(products, {query:'epico',category:'exoticos',vendor:'npc',stock:'low'});
  assert.deepEqual(Array.from(items, product => product.id), ['1']);
});

test('batch preview and apply rules preserve unlimited stock and global events', () => {
  const scope = vm.createContext({});
  vm.runInContext(workspace, scope);
  const products = {a:{stock:2, category:'exoticos'}, b:{stock:null, category:'servicos'}};
  const ids = ['a','b','deleted'];
  const stock = scope.adminBuildBatchRows(ids, products, 'stock', 3);
  assert.deepEqual(Array.from(stock, row => [row.id, row.after, row.changed]), [['a',5,true],['b',null,false]]);
  const categories = scope.adminBuildBatchRows(ids, products, 'category', 'servicos');
  assert.deepEqual(Array.from(categories, row => row.changed), [true,false]);
  const explicit = scope.adminBuildBatchRows(ids, products, 'event', 'live', {productIds:['a']});
  const all = scope.adminBuildBatchRows(ids, products, 'event', 'global', {allProducts:true});
  assert.deepEqual(Array.from(explicit, row => row.changed), [false,true]);
  assert.ok(all.every(row => !row.changed));
});

test('dashboard flags overdue open orders and only active events ending in 48 hours', () => {
  const scope = vm.createContext({isEventFlagActive:event => event.active !== false,
    isEventInWindow:(event,now) => !(event.startsAt > now || event.endsAt < now)});
  vm.runInContext(workspace, scope);
  const now = 1700000000000, hour = 3600000;
  assert.equal(scope.adminIsOverdue({status:'in_transit',estimatedDelivery:now-1},now), true);
  assert.equal(scope.adminIsOverdue({status:'delivered',estimatedDelivery:now-1},now), false);
  assert.equal(scope.adminIsOverdue({status:'in_transit',estimatedDelivery:now+1},now), false);
  assert.equal(scope.adminIsEndingSoon({useRealSchedule:true,endsAt:now+48*hour},now), true);
  assert.equal(scope.adminIsEndingSoon({useRealSchedule:true,endsAt:now+49*hour},now), false);
  assert.equal(scope.adminIsEndingSoon({useRealSchedule:true,active:false,endsAt:now+hour},now), false);
  assert.equal(scope.adminIsEndingSoon({useRealSchedule:false,endsAt:now+hour},now), false);
});
