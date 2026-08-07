/* Global Smith — Utils */

function formatMoney(value) {
  const n = Number(value) || 0;
  return '$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function generateId() {
  try {
    if (typeof db !== 'undefined' && db.ref) return db.ref().push().key;
  } catch (e) {}
  return 'gs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

/* ========== CATEGORIAS ========== */

const CATEGORY_LABELS = {
  equipamentos: 'Equipamentos',
  consumiveis: 'Consumíveis',
  servicos: 'Serviços',
  comida: 'Comida & Bebida',
  ilegais: 'Ilegais / Mercado Negro',
  exoticos: 'Exóticos / Raros',
  utilidades: 'Utilidades',
  informacoes: 'Informações & Favores'
};

const PUBLIC_CATEGORIES = Object.keys(CATEGORY_LABELS).filter(k => k !== 'ilegais');

/* ========== STATUS DE ENTREGA ========== */

const STATUS_LABELS = {
  in_transit: 'Em trânsito',
  held_customs: 'Retido na alfândega',
  resent: 'Reenviado',
  delivered: 'Entregue',
  refunded: 'Reembolsado',
  lost: 'Extraviado'
};

const STATUS_MESSAGES = {
  in_transit: 'Pacote em rota. Evite áreas de alta vigilância.',
  held_customs: 'Retido no perímetro. Aguardando liberação discreta.',
  resent: 'Courier substituído. Novo envio em andamento.',
  delivered: 'Entrega confirmada. Item disponível no inventário.',
  refunded: 'Valor devolvido ao saldo. Operação encerrada.',
  lost: 'Sinal perdido. Investigação interna em curso.'
};

const STATUS_CLASS = {
  in_transit: 'status-transit',
  held_customs: 'status-held',
  resent: 'status-resent',
  delivered: 'status-delivered',
  refunded: 'status-refunded',
  lost: 'status-lost'
};

function statusClass(status) {
  return STATUS_CLASS[status] || 'status-transit';
}

function formatDeliveryLabel(item) {
  if (!item) return '';
  const status = item.status || 'delivered';
  if (status === 'delivered') {
    return item.deliveredAt
      ? `Entregue em ${formatDate(item.deliveredAt)}`
      : 'Entregue';
  }
  if (status === 'refunded') return 'Reembolsado';
  if (status === 'lost') return 'Extraviado';
  if (status === 'held_customs') return 'Retido na alfândega';
  if (status === 'resent') {
    if (item.estimatedDelivery) return `Reenviado · chega ${formatDate(item.estimatedDelivery)}`;
    return 'Reenviado';
  }
  if (item.estimatedDelivery) {
    const eta = item.estimatedDelivery;
    if (eta <= Date.now()) return 'Chegada prevista hoje';
    return `Chega em ${formatDate(eta)}`;
  }
  return STATUS_LABELS[status] || 'Em trânsito';
}

/* ========== REPUTAÇÃO / RANKS ========== */

const RANK_THRESHOLDS = [
  { id: 'cliente',   label: 'Cliente',   spent: 0,         orders: 0,  color: '#9aa3b5' },
  { id: 'prata',     label: 'Prata',     spent: 50000,     orders: 5,  color: '#c0c7d4' },
  { id: 'ouro',      label: 'Ouro',      spent: 250000,    orders: 15, color: '#f5c542' },
  { id: 'platina',   label: 'Platina',   spent: 750000,    orders: 40, color: '#7dd3fc' },
  { id: 'executivo', label: 'Executivo', spent: 1000000,   orders: 80, color: '#a78bfa' }
];

const RANK_ORDER = RANK_THRESHOLDS.map(r => r.id);

function getRepStats(profile, orders) {
  // Prefer stored counters; fallback compute from delivered orders
  let spent = Number(profile?.repSpent);
  let count = Number(profile?.repOrders);
  if (isNaN(spent) || isNaN(count)) {
    const list = (orders || []).filter(o => (o.status || '') === 'delivered');
    spent = list.reduce((s, o) => s + (Number(o.price) || 0), 0);
    count = list.length;
  }
  return { spent: spent || 0, orders: count || 0 };
}

function getUserRank(profile, orders) {
  const { spent, orders: orderCount } = getRepStats(profile, orders);
  let current = RANK_THRESHOLDS[0];
  for (const r of RANK_THRESHOLDS) {
    if (spent >= r.spent && orderCount >= r.orders) current = r;
  }
  return current;
}

function getNextRank(currentId) {
  const idx = RANK_ORDER.indexOf(currentId);
  if (idx < 0 || idx >= RANK_ORDER.length - 1) return null;
  return RANK_THRESHOLDS[idx + 1];
}

function rankMeets(userRankId, requiredId) {
  if (!requiredId) return true;
  const u = RANK_ORDER.indexOf(userRankId);
  const r = RANK_ORDER.indexOf(requiredId);
  if (r < 0) return true;
  return u >= r;
}

function rankProgress(profile, orders) {
  const rank = getUserRank(profile, orders);
  const next = getNextRank(rank.id);
  const stats = getRepStats(profile, orders);
  if (!next) {
    return { rank, next: null, spentPct: 100, ordersPct: 100, stats };
  }
  const spentPct = Math.min(100, Math.floor((stats.spent / next.spent) * 100));
  const ordersPct = Math.min(100, Math.floor((stats.orders / next.orders) * 100));
  return { rank, next, spentPct, ordersPct, stats };
}

/* ========== ACESSO ========== */

function hasBlackMarketAccess() {
  return !!(state.profile?.blackMarketAccess || state.profile?.isAdmin ||
    (state.user && ADMIN_UIDS.includes(state.user.uid)));
}

function canSeeSecret(product) {
  if (!product?.secretRank) return true;
  const rank = getUserRank(state.profile, state.orders);
  return rankMeets(rank.id, product.secretRank) || !!(state.profile?.isAdmin);
}

function canNegotiate() {
  const rank = getUserRank(state.profile, state.orders);
  return rankMeets(rank.id, 'platina') || !!(state.profile?.isAdmin);
}
