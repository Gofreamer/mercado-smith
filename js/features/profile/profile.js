/* Global Smith — Profile */

function renderProfile() {
  const root = document.getElementById('profile-root');
  if (!root) return;

  if (!state.profile || !state.user) {
    root.innerHTML = '<div class="empty-state">Carregando perfil...</div>';
    return;
  }

  const inv = state.profile.inventory || {};
  const invItems = Object.values(inv);
  const invCount = invItems.length;
  const inTransit = invItems.filter(i => (i.status || 'delivered') === 'in_transit').length;
  const delivered = invItems.filter(i => (i.status || 'delivered') === 'delivered').length;

  const orders = state.orders || [];
  const totalSpent = orders.reduce((s, o) => s + (Number(o.price) || 0), 0);
  const recent = orders.slice(0, 8);

  root.innerHTML = `
    <div class="profile-stats">
      <div class="profile-stat">
        <div class="profile-stat-value success">${formatMoney(state.profile.balance)}</div>
        <div class="profile-stat-label">Saldo atual</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${invCount}</div>
        <div class="profile-stat-label">Itens no inventário</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value warning">${inTransit}</div>
        <div class="profile-stat-label">Em trânsito</div>
      </div>
    </div>

    <div class="profile-layout">
      <div class="profile-card" id="profile-card">
        <div class="profile-row">
          <span class="profile-label">Nome</span>
          <span class="profile-value">${escapeHTML(state.profile.name)}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">E-mail</span>
          <span class="profile-value">${escapeHTML(state.profile.email || state.user.email)}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">Entregues</span>
          <span class="profile-value">${delivered}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">Total em pedidos</span>
          <span class="profile-value" style="color: var(--success)">${formatMoney(totalSpent)}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">Pedidos</span>
          <span class="profile-value">${orders.length}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">UID</span>
          <span class="profile-value" style="font-size: 11px; color: var(--text-muted); word-break: break-all; text-align: right; max-width: 60%">${state.user.uid}</span>
        </div>
      </div>

      <div class="profile-history-card">
        <h3>Histórico recente</h3>
        ${recent.length === 0 ? `
          <div class="empty-state" style="padding: 24px 0">
            <p>Nenhuma compra ainda.</p>
            <button class="btn btn-primary btn-sm" onclick="showView('market')" style="margin-top:10px">Ir ao Mercado</button>
          </div>
        ` : recent.map(o => {
          const status = o.status || 'delivered';
          const statusClass = status === 'delivered' ? 'status-delivered' : 'status-transit';
          const qty = o.quantity || 1;
          return `
            <div class="profile-order-row">
              <div class="profile-order-info">
                <h4>${escapeHTML(o.productName)}${qty > 1 ? ` ×${qty}` : ''}</h4>
                <p>${formatDateTime(o.createdAt)}</p>
                <span class="status-pill ${statusClass}">${formatDeliveryLabel(o)}</span>
              </div>
              <div class="profile-order-meta">
                <div class="item-price success">${formatMoney(o.price)}</div>
              </div>
            </div>
          `;
        }).join('')}
        ${orders.length > 8 ? `
          <div style="margin-top: 14px; text-align: center">
            <button class="btn btn-ghost btn-sm" onclick="showView('orders')">Ver todos os pedidos</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
