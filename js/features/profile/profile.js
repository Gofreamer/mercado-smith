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
  const inTransit = invItems.filter(i => {
    const s = i.status || 'delivered';
    return s === 'in_transit' || s === 'held_customs' || s === 'resent';
  }).length;
  const delivered = invItems.filter(i => (i.status || 'delivered') === 'delivered').length;

  const orders = state.orders || [];
  const totalSpent = orders.reduce((s, o) => s + (Number(o.price) || 0), 0);
  const recent = orders.slice(0, 8);
  const progress = rankProgress(state.profile, orders);
  const { rank, next, spentPct, ordersPct, stats } = progress;
  const wishCount = Object.keys(state.wishlist || {}).length;

  const myOffers = (state.offers || []).filter(o => o.userId === state.user.uid).slice(0, 5);

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
      <div class="profile-stat rank-stat" style="border-color:${rank.color}44">
        <div class="profile-stat-value" style="color:${rank.color}">${rank.label}</div>
        <div class="profile-stat-label">Rank Global Smith</div>
      </div>
    </div>

    <div class="rank-card">
      <div class="rank-card-header">
        <span class="rank-badge" style="background:${rank.color}22;color:${rank.color};border-color:${rank.color}55">${rank.label}</span>
        ${next ? `<span class="rank-next">Próximo: <strong style="color:${next.color}">${next.label}</strong></span>` : `<span class="rank-next">Nível máximo</span>`}
      </div>
      ${next ? `
        <div class="rank-bars">
          <div class="rank-bar-row">
            <span>Gasto entregue ${formatMoney(stats.spent)} / ${formatMoney(next.spent)}</span>
            <div class="rank-bar"><div class="rank-bar-fill" style="width:${spentPct}%;background:${rank.color}"></div></div>
          </div>
          <div class="rank-bar-row">
            <span>Pedidos entregues ${stats.orders} / ${next.orders}</span>
            <div class="rank-bar"><div class="rank-bar-fill" style="width:${ordersPct}%;background:${rank.color}"></div></div>
          </div>
        </div>
        <p class="rank-hint">Rank sobe quando <strong>gasto</strong> e <strong>número de pedidos entregues</strong> atingem o mínimo.</p>
      ` : `<p class="rank-hint">Você alcançou o círculo Executivo do Global Smith.</p>`}
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
          <span class="profile-label">Desejos</span>
          <span class="profile-value"><button class="btn btn-ghost btn-sm" onclick="showView('wishlist')">${wishCount} item(ns)</button></span>
        </div>
        <div class="profile-row">
          <span class="profile-label">Subsolo</span>
          <span class="profile-value">${hasBlackMarketAccess() ? '<span class="tag-illegal">Acesso liberado</span>' : 'Sem acesso'}</span>
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
          const qty = o.quantity || 1;
          return `
            <div class="profile-order-row">
              <div class="profile-order-info">
                <h4>${escapeHTML(o.productName)}${qty > 1 ? ` ×${qty}` : ''}</h4>
                <p>${formatDateTime(o.createdAt)}</p>
                <span class="status-pill ${statusClass(status)}">${formatDeliveryLabel(o)}</span>
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

        ${myOffers.length ? `
          <h3 style="margin-top:24px">Suas ofertas</h3>
          ${myOffers.map(o => `
            <div class="profile-order-row">
              <div class="profile-order-info">
                <h4>${escapeHTML(o.productName)}</h4>
                <p>${formatMoney(o.amount)} · ${escapeHTML(o.status)}${o.counterAmount ? ` → contraproposta ${formatMoney(o.counterAmount)}` : ''}</p>
              </div>
            </div>
          `).join('')}
        ` : ''}
      </div>
    </div>
  `;
}
