/* Global Smith — App Start */

auth.onAuthStateChanged(async (user) => {
  if (user) {
    state.user = user;
    loadCartFromStorage(user.uid);
    updateCartBadge();
    showApp();
    listenUserProfile(user.uid);
    listenProducts();
    listenOrders(user.uid);
    // allOrders será ligado quando isAdmin for detectado em updateAdminVisibility
    showView('market');
  } else {
    state.user = null;
    state.profile = null;
    state.cart = {};
    state.allOrders = [];
    updateCartBadge();
    closeCart();
    closeProductModal();
    showAuthScreen();
  }
});
