/* Global Smith — Global State */

const state = {
  user: null,          // Firebase user
  profile: null,       // { name, email, balance, isAdmin, inventory, ... }
  products: {},        // { id: product }
  orders: [],
  cart: {},            // { productId: { qty, addedAt } }
  currentView: 'market',
  cartOpen: false
};

// Admin UIDs (adicione o seu UID aqui depois do primeiro login)
const ADMIN_UIDS = [];

// Persistência local do carrinho (por usuário)
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
