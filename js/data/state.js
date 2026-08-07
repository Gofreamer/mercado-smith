/* Global Smith — Global State */

const state = {
  user: null,          // Firebase user
  profile: null,       // { name, email, balance, isAdmin, inventory, ... }
  products: {},        // { id: product }
  orders: [],
  currentView: 'market'
};

// Admin UIDs (adicione o seu UID aqui depois do primeiro login)
const ADMIN_UIDS = [];
