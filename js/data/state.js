/* Global Smith — Global State */

const state = {
  user: null,
  profile: null,
  products: {},
  orders: [],
  allOrders: [],
  allUsers: {},
  cart: {},
  currentView: 'market',
  cartOpen: false,
  sortBy: 'name',
  editingProductId: null,
  wishlist: {},
  coupons: {},
  feed: [],
  offers: [],
  adminLog: [],
  appliedCoupon: null,
  events: {},
  vendors: {},
  siteSettings: {},
  vendorFilter: '',
  loanRequests: [],
  /** snapshot de estoque anterior para notificar restock da wishlist */
  _prevStock: null,
  /** ids de produto já notificados nesta sessão (evita spam) */
  _restockNotified: {}
};

/** UIDs com admin forçado (opcional). Preferir users/{uid}/isAdmin = true no Firebase. */
const ADMIN_UIDS = [
  // 'cole_o_uid_admin_aqui_se_quiser_fallback'
];

function loadCartFromStorage(uid) {
  try {
    const raw = localStorage.getItem('gs_cart_' + uid);
    state.cart = raw ? JSON.parse(raw) : {};
  } catch {
    state.cart = {};
  }
}

function saveCartToStorage() {
  if (!state.user) return;
  try {
    localStorage.setItem('gs_cart_' + state.user.uid, JSON.stringify(state.cart));
  } catch {}
}

function clearCartStorage() {
  if (!state.user) return;
  try {
    localStorage.removeItem('gs_cart_' + state.user.uid);
  } catch {}
}
