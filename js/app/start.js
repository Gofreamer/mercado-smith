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
    listenFeed();
    showView('market');
  } else {
    state.user = null;
    state.profile = null;
    state.cart = {};
    state.allOrders = [];
    state.wishlist = {};
    state.appliedCoupon = null;
    updateCartBadge();
    closeCart();
    closeProductModal();
    document.body.classList.remove('theme-blackmarket');
    showAuthScreen();
  }
});
