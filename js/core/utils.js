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
