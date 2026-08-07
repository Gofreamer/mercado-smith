/* Global Smith — Profile */

function renderProfile() {
  const card = document.getElementById('profile-card');
  if (!state.profile || !state.user) {
    card.innerHTML = '<div class="empty-state">Carregando perfil...</div>';
    return;
  }

  const invCount = Object.keys(state.profile.inventory || {}).length;

  card.innerHTML = `
    <div class="profile-row">
      <span class="profile-label">Nome</span>
      <span class="profile-value">${escapeHTML(state.profile.name)}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">E-mail</span>
      <span class="profile-value">${escapeHTML(state.profile.email || state.user.email)}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">Saldo</span>
      <span class="profile-value" style="color: var(--success)">${formatMoney(state.profile.balance)}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">Itens no inventário</span>
      <span class="profile-value">${invCount}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">UID</span>
      <span class="profile-value" style="font-size: 12px; color: var(--text-muted)">${state.user.uid}</span>
    </div>
  `;
}
