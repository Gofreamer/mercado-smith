/* Global Smith — App Start */

auth.onAuthStateChanged(async (user) => {
  if (user) {
    state.user = user;
    showApp();
    listenUserProfile(user.uid);
    listenProducts();
    listenOrders(user.uid);

    // Mostra a view padrão
    showView('market');
  } else {
    state.user = null;
    state.profile = null;
    showAuthScreen();
  }
});
