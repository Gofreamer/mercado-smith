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

    // Mostra a view padrão
    showView('market');
  } else {
    state.user = null;
    state.profile = null;
    state.cart = {};
    updateCartBadge();
    closeCart();
    showAuthScreen();
  }
});
