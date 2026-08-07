/* Global Smith — Utils */

function formatMoney(value) {
  return '$ ' + Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3200);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

function formatDeliveryLabel(item) {
  if (!item) return '';
  const status = item.status || 'delivered';
  if (status === 'delivered') {
    return item.deliveredAt
      ? `Entregue em ${formatDate(item.deliveredAt)}`
      : 'Entregue';
  }
  if (item.estimatedDelivery) {
    const eta = item.estimatedDelivery;
    if (eta <= Date.now()) return 'Chegada prevista hoje';
    return `Chega em ${formatDate(eta)}`;
  }
  return 'Em trânsito';
}

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

const STATUS_LABELS = {
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  pending: 'Pendente'
};
