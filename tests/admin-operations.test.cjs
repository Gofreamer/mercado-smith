const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(files) {
  const scope = vm.createContext({});
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), scope);
  return scope;
}

test('archive only old terminal orders and keep all orders belonging to an existing player', () => {
  const scope = load(['js/features/admin/admin-operations.js','js/features/admin/admin-maintenance.js']);
  const rows = [
    {id:'delivered', status:'delivered', deliveredAt:10, userId:'player'},
    {id:'late', status:'held_customs', createdAt:5},
    {id:'lost', status:'lost', createdAt:5},
    {id:'recent', status:'refunded', refundedAt:80},
    {id:'owned', status:'delivered', adminArchivedAt:9, userId:'player'},
    {id:'orphan', status:'refunded', adminArchivedAt:9, userId:'missing'}
  ];
  assert.deepEqual(Array.from(scope.adminMaintenanceCandidates('archive',rows,50), row=>row.id), ['delivered']);
  assert.deepEqual(Array.from(scope.adminMaintenanceCandidates('orphanOrders',rows,50,{player:{}}), row=>row.id), ['orphan']);
  assert.deepEqual(Array.from(scope.adminMaintenanceCandidates('logs',[{id:'kept',createdAt:5},{id:'old',createdAt:5}],50,{},new Set(['kept'])), row=>row.id), ['old']);
});

test('scoped coupons leave other items out while legacy coupons still apply to every item', () => {
  const scope = load(['js/services/database.js','js/features/admin/admin-campaign.js']);
  assert.equal(scope.couponIncludesProduct({},'other'),true);
  assert.equal(scope.couponIncludesProduct({productIds:['target']},'target'),true);
  assert.equal(scope.couponIncludesProduct({productIds:['target']},'other'),false);
  assert.equal(scope.adminCouponStatus({startsAt:51},50),'scheduled');
  assert.equal(scope.adminCouponStatus({expires:49},50),'expired');
  assert.equal(scope.adminCouponStatus({maxUses:2,uses:2},50),'used');
  assert.equal(scope.adminCouponStatus({},50),'active');
  assert.deepEqual(Array.from(scope.readAdminProductIds('a, a b')),['a','b']);
});
