/* Global Smith — Admin */

function getCategoryOptions(selected) {
  return Object.entries(CATEGORY_LABELS).map(([k, v]) =>
    `<option value="${k}" ${selected === k ? 'selected' : ''}>${v}</option>`
  ).join('');
}

/* ---------- PRODUTOS ---------- */

function renderAdminProducts() {
  const el = document.getElementById('admin-products-list');
  if (!el) return;

  const products = Object.entries(state.products)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || (a.name || '').localeCompare(b.name || ''));

  if (products.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhum produto cadastrado.</div>';
    return;
  }

  el.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Entrega</th>
            <th>Categoria</th>
            <th>Adicionado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const stock = (p.stock === null || p.stock === undefined) ? '∞' : p.stock;
            const delivery = p.deliveryDays > 0 ? `${p.deliveryDays}d` : 'Imediata';
            return `
              <tr>
                <td>
                  <div class="admin-prod-name">${escapeHTML(p.name)}</div>
                  <div class="admin-prod-desc">${escapeHTML((p.description || '').slice(0, 60))}</div>
                </td>
                <td class="mono">${formatMoney(p.price)}</td>
                <td class="mono">${stock}</td>
                <td>${delivery}</td>
                <td>${escapeHTML(CATEGORY_LABELS[p.category] || p.category || '')}</td>
                <td style="font-size:12px;white-space:nowrap">${p.createdAt ? formatDateTime(p.createdAt) : '—'}</td>
                <td class="admin-actions-cell">
                  <button class="btn btn-ghost btn-sm" onclick="adminEditProduct('${p.id}')">Editar</button>
                  <button class="btn btn-ghost btn-sm text-danger" onclick="adminDeleteProduct('${p.id}')">Apagar</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function adminResetProductForm() {
  state.editingProductId = null;
  const form = document.getElementById('admin-product-form');
  if (form) form.reset();
  const title = document.getElementById('admin-product-form-title');
  if (title) title.textContent = 'Adicionar Produto';
  const btn = document.getElementById('admin-product-submit');
  if (btn) btn.textContent = 'Adicionar Produto';
  const cancel = document.getElementById('admin-product-cancel');
  if (cancel) cancel.classList.add('hidden');
}

function adminEditProduct(id) {
  const p = state.products[id];
  if (!p) return;

  state.editingProductId = id;
  document.getElementById('admin-product-name').value = p.name || '';
  document.getElementById('admin-product-desc').value = p.description || '';
  document.getElementById('admin-product-price').value = p.price ?? '';
  document.getElementById('admin-product-category').value = p.category || 'equipamentos';
  document.getElementById('admin-product-image').value = p.image || '';
  document.getElementById('admin-product-stock').value =
    (p.stock === null || p.stock === undefined) ? '' : p.stock;
  document.getElementById('admin-product-delivery').value =
    p.deliveryDays > 0 ? p.deliveryDays : 0;
  const sec = document.getElementById('admin-product-secret');
  if (sec) sec.value = p.secretRank || '';

  document.getElementById('admin-product-form-title').textContent = 'Editar Produto';
  document.getElementById('admin-product-submit').textContent = 'Salvar alterações';
  document.getElementById('admin-product-cancel')?.classList.remove('hidden');

  document.getElementById('admin-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function adminSaveProduct(e) {
  e.preventDefault();

  const name = document.getElementById('admin-product-name').value.trim();
  const description = document.getElementById('admin-product-desc').value.trim();
  const price = parseFloat(document.getElementById('admin-product-price').value);
  const category = document.getElementById('admin-product-category').value;
  const image = document.getElementById('admin-product-image').value.trim();
  const stockRaw = document.getElementById('admin-product-stock').value;
  const deliveryDays = parseInt(document.getElementById('admin-product-delivery').value, 10) || 0;

  if (!name || isNaN(price)) {
    showToast('Preencha nome e preço corretamente.', 'error');
    return;
  }

  const secretRank = document.getElementById('admin-product-secret')?.value || '';

  const product = {
    name,
    description,
    price,
    category,
    image: image || '',
    stock: stockRaw === '' ? null : parseInt(stockRaw, 10),
    deliveryDays: deliveryDays > 0 ? deliveryDays : 0,
    secretRank: secretRank || null,
    createdAt: state.editingProductId
      ? (state.products[state.editingProductId]?.createdAt || Date.now())
      : Date.now(),
    updatedAt: Date.now()
  };

  try {
    if (state.editingProductId) {
      await db.ref('products/' + state.editingProductId).update(product);
      showToast('Produto atualizado!');
    } else {
      await db.ref('products').push(product);
      showToast('Produto adicionado!');
    }
    adminResetProductForm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar produto.', 'error');
  }
}

async function adminDeleteProduct(id) {
  const p = state.products[id];
  if (!p) return;
  if (!confirm(`Apagar "${p.name}"?\nEssa ação não pode ser desfeita.`)) return;

  try {
    await db.ref('products/' + id).remove();
    showToast('Produto removido.');
    if (state.editingProductId === id) adminResetProductForm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao apagar produto.', 'error');
  }
}

/* ---------- PEDIDOS (admin) ---------- */

function renderAdminOrders() {
  const el = document.getElementById('admin-orders-list');
  if (!el) return;

  const orders = state.allOrders || [];
  if (orders.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhum pedido no sistema.</div>';
    return;
  }

  el.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Jogador</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Previsão</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => {
            const status = o.status || 'delivered';
            const sClass = statusClass(status);
            return `
              <tr>
                <td>
                  <div class="admin-prod-name">${escapeHTML(o.productName)}${(o.quantity || 1) > 1 ? ` ×${o.quantity}` : ''}</div>
                  <div class="admin-prod-desc">${formatDateTime(o.createdAt)}</div>
                </td>
                <td>${escapeHTML(o.userName || o.userId || '—')}</td>
                <td class="mono">${formatMoney(o.price)}</td>
                <td><span class="status-pill ${sClass}">${STATUS_LABELS[status] || status}</span></td>
                <td>${o.estimatedDelivery ? formatDate(o.estimatedDelivery) : '—'}</td>
                <td class="admin-actions-cell">
                  <select class="select select-sm" onchange="adminSetOrderStatus('${o.id}', this.value)">
                    ${Object.entries(STATUS_LABELS).map(([k,v]) => `<option value="${k}" ${status===k?'selected':''}>${v}</option>`).join('')}
                  </select>
                  <button class="btn btn-ghost btn-sm" onclick="adminEditOrderDelivery('${o.id}')">Data</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function adminMarkDelivered(orderId) {
  const order = state.allOrders.find(o => o.id === orderId);
  if (!order) return;
  if (!confirm(`Marcar "${order.productName}" como entregue para ${order.userName}?`)) return;

  const now = Date.now();
  const updates = {};
  updates[`orders/${orderId}/status`] = 'delivered';
  updates[`orders/${orderId}/deliveredAt`] = now;

  // Atualiza itens do inventário correspondentes (mesmo produto, ainda em trânsito)
  try {
    const invSnap = await db.ref(`users/${order.userId}/inventory`).once('value');
    const inv = invSnap.val() || {};
    Object.entries(inv).forEach(([key, item]) => {
      if (item.productId === order.productId && item.status === 'in_transit') {
        updates[`users/${order.userId}/inventory/${key}/status`] = 'delivered';
        updates[`users/${order.userId}/inventory/${key}/deliveredAt`] = now;
        updates[`users/${order.userId}/inventory/${key}/statusMessage`] = STATUS_MESSAGES.delivered;
      }
    });

    const uSnap = await db.ref('users/' + order.userId).once('value');
    const u = uSnap.val() || {};
    updates[`users/${order.userId}/repSpent`] = (Number(u.repSpent) || 0) + (Number(order.price) || 0);
    updates[`users/${order.userId}/repOrders`] = (Number(u.repOrders) || 0) + 1;

    await db.ref().update(updates);
    showToast('Pedido marcado como entregue!');
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar status.', 'error');
  }
}

async function adminEditOrderDelivery(orderId) {
  const order = state.allOrders.find(o => o.id === orderId);
  if (!order) return;

  const current = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toISOString().slice(0, 10)
    : '';

  const input = prompt('Nova data de previsão (AAAA-MM-DD):', current);
  if (input === null) return;

  const ts = Date.parse(input + 'T12:00:00');
  if (isNaN(ts)) {
    showToast('Data inválida.', 'error');
    return;
  }

  try {
    const updates = {};
    updates[`orders/${orderId}/estimatedDelivery`] = ts;
    if (order.status === 'delivered') {
      // se já entregue, só muda a data; senão mantém em trânsito
    } else {
      updates[`orders/${orderId}/status`] = 'in_transit';
    }

    // espelha no inventário em trânsito do mesmo produto
    const invSnap = await db.ref(`users/${order.userId}/inventory`).once('value');
    const inv = invSnap.val() || {};
    Object.entries(inv).forEach(([key, item]) => {
      if (item.productId === order.productId && item.status !== 'delivered') {
        updates[`users/${order.userId}/inventory/${key}/estimatedDelivery`] = ts;
        updates[`users/${order.userId}/inventory/${key}/status`] = 'in_transit';
      }
    });

    await db.ref().update(updates);
    showToast('Previsão atualizada!');
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar data.', 'error');
  }
}

/* ---------- SALDO ---------- */

async function adminAdjustBalance(e) {
  e.preventDefault();

  const input = document.getElementById('admin-user-id').value.trim();
  const newBalance = parseFloat(document.getElementById('admin-new-balance').value);

  if (isNaN(newBalance)) {
    showToast('Saldo inválido.', 'error');
    return;
  }

  try {
    let uid = input;

    if (input.includes('@')) {
      const snap = await db.ref('users').orderByChild('email').equalTo(input).once('value');
      const users = snap.val();
      if (!users) {
        showToast('Usuário não encontrado.', 'error');
        return;
      }
      uid = Object.keys(users)[0];
    }

    await db.ref(`users/${uid}/balance`).set(newBalance);
    showToast('Saldo atualizado!');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar saldo.', 'error');
  }
}

// Compat: formulário antigo apontava para adminAddProduct
async function adminAddProduct(e) {
  return adminSaveProduct(e);
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('admin-tab-' + tab)?.classList.remove('hidden');
  if (btn) btn.classList.add('active');
  if (tab === 'products') renderAdminProducts();
  if (tab === 'orders') renderAdminOrders();
  if (tab === 'coupons') renderAdminCoupons();
  if (tab === 'offers') renderAdminOffers();
  if (tab === 'log') renderAdminLog();
  if (tab === 'players') renderAdminPlayers();
  if (tab === 'access') { /* form only */ }
}

/* ---------- IA (Gemini) ---------- */

const AI_KEY_STORAGE = 'gs_gemini_api_key';
const AI_CATEGORIES = Object.keys(CATEGORY_LABELS);

function loadAiApiKey() {
  const input = document.getElementById('ai-api-key');
  if (!input) return;
  try {
    const key = localStorage.getItem(AI_KEY_STORAGE) || '';
    input.value = key;
  } catch {}
}

function saveAiApiKey() {
  const input = document.getElementById('ai-api-key');
  if (!input) return;
  const key = input.value.trim();
  try {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key);
    else localStorage.removeItem(AI_KEY_STORAGE);
    showToast(key ? 'Chave salva neste navegador' : 'Chave removida');
  } catch {
    showToast('Não foi possível salvar a chave.', 'error');
  }
}

function setAiStatus(msg, type = '') {
  const el = document.getElementById('ai-status');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'ai-status' + (type ? ' ' + type : '');
}

function extractJson(text) {
  if (!text) return null;
  // tenta parse direto
  try { return JSON.parse(text); } catch {}
  // bloco ```json
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  // primeiro { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function generateProductWithAI() {
  const keyInput = document.getElementById('ai-api-key');
  const promptEl = document.getElementById('ai-prompt');
  const toneEl = document.getElementById('ai-tone');
  const catHintEl = document.getElementById('ai-category-hint');
  const btn = document.getElementById('btn-ai-generate');

  const apiKey = (keyInput?.value || '').trim() || (localStorage.getItem(AI_KEY_STORAGE) || '');
  const idea = (promptEl?.value || '').trim();
  const toneRaw = (toneEl?.value || '').trim();
  const catHint = catHintEl?.value || '';

  if (!apiKey) {
    showToast('Cole sua chave da API Gemini.', 'error');
    keyInput?.focus();
    return;
  }
  if (!idea) {
    showToast('Descreva a ideia do item.', 'error');
    promptEl?.focus();
    return;
  }
  if (!toneRaw) {
    showToast('Informe o tom (ou escreva "nenhum").', 'error');
    toneEl?.focus();
    return;
  }
  const toneNeutral = /^(nenhum|none|neutro|sem tom|n\/?a)$/i.test(toneRaw);
  const tone = toneNeutral ? 'neutro, sem estilo forçado' : toneRaw;

  try { localStorage.setItem(AI_KEY_STORAGE, apiKey); } catch {}

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Gerando...';
  }
  setAiStatus('Consultando a IA...', 'loading');

  const systemInstruction = `Você cria produtos para o marketplace in-world "Global Smith", um mercado de RPG.
Responda APENAS com um JSON válido, sem markdown, no formato:
{
  "name": "string (nome curto e marcante, máx 60 caracteres)",
  "description": "string (2 a 4 frases em português do Brasil, vendendo o item no universo do jogo)",
  "price": number (preço sugerido em dólares do jogo, realista para o tipo de item; entre 50 e 500000),
  "category": "uma destas chaves: ${AI_CATEGORIES.join(', ')}",
  "deliveryDays": number (0 = imediato; serviços costumam 0-2; físicos/raros 1-14; ilegais/exóticos 3-21),
  "stock": number ou null (null = ilimitado; itens únicos use 1; consumíveis 5-50)
}
Regras: português BR; sem emojis no nome; não invente URLs; category deve ser exatamente uma das chaves listadas; respeite o tom pedido.`;

  const userPrompt = `Ideia do jogador/mestre: ${idea}
Tom / estilo desejado: ${tone}
${catHint ? `Categoria preferida: ${catHint} (${CATEGORY_LABELS[catHint] || catHint})` : 'Escolha a categoria mais adequada.'}
Gere um único produto coerente com o universo Global Smith.`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  };

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

  try {
    let data = null;
    let lastErr = null;

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        data = await res.json();
        break;
      }

      const errText = await res.text();
      console.error('Gemini error', model, res.status, errText);
      lastErr = res.status;

      if (res.status === 400 || res.status === 403) {
        throw new Error('Chave inválida ou API sem permissão. Confira no AI Studio.');
      }
      if (res.status === 429) {
        throw new Error('Limite da API atingido. Aguarde um pouco e tente de novo.');
      }
      // 404 model → tenta próximo
    }

    if (!data) {
      throw new Error('Falha na API Gemini' + (lastErr ? ' (' + lastErr + ')' : '') + '.');
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
    const product = extractJson(text);

    if (!product || !product.name) {
      console.error('AI raw:', text);
      throw new Error('A IA não retornou um produto válido. Tente de novo.');
    }

    // normaliza categoria
    let category = product.category;
    if (!AI_CATEGORIES.includes(category)) {
      category = catHint || 'exoticos';
    }

    const price = Number(product.price);
    const deliveryDays = Math.max(0, parseInt(product.deliveryDays, 10) || 0);
    let stock = product.stock;
    if (stock === undefined || stock === '' || stock === 'null') stock = null;
    else {
      stock = parseInt(stock, 10);
      if (isNaN(stock)) stock = null;
    }

    // preenche formulário (modo adicionar)
    adminResetProductForm();
    document.getElementById('admin-product-name').value = String(product.name).slice(0, 80);
    document.getElementById('admin-product-desc').value = String(product.description || '');
    document.getElementById('admin-product-price').value = isNaN(price) ? '' : Math.round(price * 100) / 100;
    document.getElementById('admin-product-category').value = category;
    document.getElementById('admin-product-delivery').value = deliveryDays;
    document.getElementById('admin-product-stock').value = stock === null ? '' : stock;
    // imagem fica a cargo do admin (Imgur)

    document.getElementById('admin-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAiStatus('Pronto! Revise o formulário e clique em Adicionar Produto.', 'ok');
    showToast('Item gerado — revise e salve');
  } catch (err) {
    console.error(err);
    setAiStatus(err.message || 'Erro ao gerar item.', 'error');
    showToast(err.message || 'Erro ao gerar item.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Gerar item';
    }
  }
}

/* ---------- GERADOR LOCAL (sem API) ---------- */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function titleCaseIdea(idea) {
  const clean = idea.replace(/^["']|["']$/g, '').trim();
  if (!clean) return 'Item Exclusivo Global Smith';
  // Se já parece um nome curto, usa
  if (clean.length <= 50 && !clean.includes('.')) {
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  // Pega trecho principal
  const cut = clean.split(/[.,;—–-]/)[0].trim();
  return (cut.charAt(0).toUpperCase() + cut.slice(1)).slice(0, 70);
}

function detectCategoryFromIdea(idea, hint) {
  if (hint && AI_CATEGORIES.includes(hint)) return hint;
  const t = idea.toLowerCase();
  if (/bilhete|ingresso|ticket|acesso|vip|show|evento|pass/.test(t)) return 'servicos';
  if (/arma|colete|capacete|equip|armadura|faca|pistola|rifle/.test(t)) return 'equipamentos';
  if (/droga|ilegal|contrabando|falso|documento falso|hack/.test(t)) return 'ilegais';
  if (/comida|bebida|whisky|vinho|champanhe|jantar|café/.test(t)) return 'comida';
  if (/informação|segredo|dossier|favor|contato|pista/.test(t)) return 'informacoes';
  if (/poção|injeção|stim|consum|kit médico|antidoto/.test(t)) return 'consumiveis';
  if (/raro|relíquia|artefato|único|lendário|exótico/.test(t)) return 'exoticos';
  if (/ferramenta|utilitário|chip|drone|gadget/.test(t)) return 'utilidades';
  return 'exoticos';
}

function priceFor(category, tone, idea) {
  const t = idea.toLowerCase();
  let base = {
    equipamentos: 2500,
    consumiveis: 400,
    servicos: 5000,
    comida: 300,
    ilegais: 8000,
    exoticos: 15000,
    utilidades: 1200,
    informacoes: 6000
  }[category] || 2000;

  if (/vip|premium|exclusiv|lendár|único|grandioso|luxo/.test(t)) base *= 2.2;
  if (/bilhete|ingresso|show/.test(t)) base = Math.max(base, 3500);
  const tl = String(tone || '').toLowerCase();
  if (/luxo|ostenta|exclusiv|elite/.test(tl)) base *= 2.5;
  if (/ilegal|negro|contrabando|underground|crime/.test(tl)) base *= 1.6;
  if (/sombrio|noir|dark/.test(tl)) base *= 1.3;
  if (/tecnol|cyber|high-?tech|futur/.test(tl)) base *= 1.4;
  if (/premium|corporativ|sofistic/.test(tl)) base *= 1.2;

  // variação
  const factor = 0.75 + Math.random() * 0.6;
  let price = Math.round(base * factor);
  // arredonda “bonito”
  if (price >= 10000) price = Math.round(price / 500) * 500;
  else if (price >= 1000) price = Math.round(price / 50) * 50;
  else price = Math.round(price / 10) * 10;
  return clamp(price, 50, 500000);
}

function deliveryFor(category, idea) {
  const t = idea.toLowerCase();
  if (category === 'servicos' || category === 'informacoes') return pick([0, 0, 1]);
  if (category === 'comida' || category === 'consumiveis') return pick([0, 1, 1, 2]);
  if (category === 'ilegais' || category === 'exoticos') return pick([3, 5, 7, 10, 14]);
  if (/digital|código|acesso online|arquivo/.test(t)) return 0;
  return pick([0, 1, 2, 3, 5]);
}

function stockFor(category, idea) {
  const t = idea.toLowerCase();
  if (/único|one of one|edição única|lendário/.test(t)) return 1;
  if (category === 'servicos' || category === 'informacoes') return pick([null, null, 10, 25]);
  if (category === 'exoticos') return pick([1, 2, 3, 5]);
  if (category === 'ilegais') return pick([3, 5, 8, null]);
  return pick([null, 10, 20, 50]);
}

function buildDescription(name, idea, category, tone) {
  const catLabel = CATEGORY_LABELS[category] || category;
  const openings = {
    premium: [
      `Disponível somente através da Global Smith.`,
      `Catalogado para clientes com acesso privilegiado.`,
      `Item selecionado pela curadoria Global Smith.`
    ],
    sombrio: [
      `Negociado longe dos holofotes.`,
      `Quem pergunta demais não fecha negócio.`,
      `Sem recibo. Sem testemunhas. Só resultado.`
    ],
    tecnologico: [
      `Especificação de ponta, rastreabilidade mínima.`,
      `Hardware e acesso alinhados ao padrão da elite técnica.`,
      `Performance acima do que o mercado comum entrega.`
    ],
    luxo: [
      `Reservado àqueles que não perguntam o preço primeiro.`,
      `Exclusividade sob medida para quem já tem de tudo.`,
      `O tipo de aquisição que redefine status.`
    ],
    ilegal: [
      `Fora dos canais oficiais. Entrada discreta.`,
      `Mercado paralelo, risco calculado.`,
      `Se você está lendo isto, já sabe o jogo.`
    ]
  };

  const middles = [
    `Baseado na demanda: “${idea.slice(0, 120)}${idea.length > 120 ? '…' : ''}”.`,
    `Conceito central: ${idea.slice(0, 100)}${idea.length > 100 ? '…' : ''}.`,
    `Sob encomenda alinhada ao briefing do cliente.`
  ];

  const closings = {
    servicos: [
      `Ativação conforme disponibilidade da agenda Global Smith.`,
      `Inclui coordenação logística discreta até o momento do acesso.`
    ],
    equipamentos: [
      `Entrega com verificação de autenticidade e suporte inicial.`,
      `Pronto para uso operacional após a liberação.`
    ],
    ilegais: [
      `Sem garantia pública. Sem rastro desnecessário.`,
      `Cliente assume o contexto de uso.`
    ],
    exoticos: [
      `Peça de circulação restrita — estoque limitado.`,
      `Procedência reservada aos arquivos internos.`
    ],
    comida: [
      `Experiência sensorial sob padrão premium.`,
      `Serviço e apresentação no nível da casa.`
    ],
    consumiveis: [
      `Uso único ou ciclo curto — efeito conforme especificação.`,
      `Validade e lote controlados internamente.`
    ],
    utilidades: [
      `Ferramenta prática para quem resolve problemas de verdade.`,
      `Integração simples ao kit operacional do cliente.`
    ],
    informacoes: [
      `Conteúdo entregue por canal seguro após confirmação.`,
      `Atualidade sujeita à janela de inteligência disponível.`
    ]
  };

  const tl = String(tone || '').toLowerCase();
  let toneKey = 'premium';
  if (/^(neutro|nenhum|none)$/.test(tl)) toneKey = 'premium';
  else if (/sombrio|noir|dark|underground/.test(tl)) toneKey = 'sombrio';
  else if (/tecnol|cyber|futur/.test(tl)) toneKey = 'tecnologico';
  else if (/luxo|ostenta|elite/.test(tl)) toneKey = 'luxo';
  else if (/ilegal|negro|contrabando/.test(tl)) toneKey = 'ilegal';
  else if (openings[tone]) toneKey = tone;
  const open = pick(openings[toneKey] || openings.premium);
  const mid = pick(middles);
  const close = pick(closings[category] || closings.exoticos);

  return `${open} ${mid} Categoria: ${catLabel}. ${close}`;
}

function generateProductLocal() {
  const promptEl = document.getElementById('ai-prompt');
  const toneEl = document.getElementById('ai-tone');
  const catHintEl = document.getElementById('ai-category-hint');
  const qtyEl = document.getElementById('ai-qty');
  const btn = document.getElementById('btn-local-generate');

  const idea = (promptEl?.value || '').trim();
  const toneRaw = (toneEl?.value || '').trim();
  const catHint = catHintEl?.value || '';
  let qty = parseInt(qtyEl?.value, 10);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 10) qty = 10;

  if (!idea) {
    showToast('Descreva a ideia do item ou do lote.', 'error');
    promptEl?.focus();
    return;
  }
  if (!toneRaw) {
    showToast('Informe o tom (ou escreva "nenhum").', 'error');
    toneEl?.focus();
    return;
  }
  const toneNeutral = /^(nenhum|none|neutro|sem tom|n\/?a)$/i.test(toneRaw);
  const tone = toneNeutral ? 'neutro' : toneRaw.toLowerCase();

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Gerando...';
  }
  setAiStatus(qty > 1 ? `Gerando ${qty} variações locais...` : 'Gerando localmente...', 'loading');

  setTimeout(() => {
    try {
      const products = [];
      for (let i = 0; i < qty; i++) {
        const seed = qty > 1 ? `${idea} (variação ${i + 1})` : idea;
        const category = detectCategoryFromIdea(idea, catHint);
        let name = titleCaseIdea(seed);
        if (qty > 1) {
          const suffixes = ['Padrão', 'Premium', 'Edição limitada', 'Compacto', 'Executivo', 'Clássico', 'Refinado', 'Operacional', 'Shadow', 'Elite'];
          name = (titleCaseIdea(idea) + ' — ' + suffixes[i % suffixes.length]).slice(0, 80);
        }
        if (category === 'servicos' && /bilhete|ingresso|show|evento/i.test(idea) && !/bilhete|ingresso/i.test(name)) {
          name = ('Bilhete — ' + name).slice(0, 80);
        }
        const price = Math.round(priceFor(category, tone, idea) * (1 + (i * 0.12)) * 100) / 100;
        const deliveryDays = deliveryFor(category, idea);
        const stock = stockFor(category, idea);
        const description = buildDescription(name, idea, category, tone);
        products.push({
          name, description, price, category, deliveryDays, stock,
          image: '', secretRank: null
        });
      }

      if (products.length === 1) {
        window.__gsAiBatch = null;
        if (typeof renderBatchPreview === 'function') renderBatchPreview([]);
        const p = products[0];
        adminResetProductForm();
        document.getElementById('admin-product-name').value = p.name;
        document.getElementById('admin-product-desc').value = p.description;
        document.getElementById('admin-product-price').value = p.price;
        document.getElementById('admin-product-category').value = p.category;
        document.getElementById('admin-product-delivery').value = p.deliveryDays;
        document.getElementById('admin-product-stock').value = p.stock === null ? '' : p.stock;
        document.getElementById('admin-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setAiStatus('Gerado localmente. Revise e clique em Adicionar Produto.', 'ok');
        showToast('Item gerado (local)');
      } else {
        window.__gsAiBatch = products;
        if (typeof renderBatchPreview === 'function') renderBatchPreview(products);
        else if (typeof adminAddAiBatch === 'function') {
          // fallback: preview only after module load
        }
        const p = products[0];
        adminResetProductForm();
        document.getElementById('admin-product-name').value = p.name;
        document.getElementById('admin-product-desc').value = p.description;
        document.getElementById('admin-product-price').value = p.price;
        document.getElementById('admin-product-category').value = p.category;
        document.getElementById('admin-product-delivery').value = p.deliveryDays;
        document.getElementById('admin-product-stock').value = p.stock === null ? '' : p.stock;
        setAiStatus(`${products.length} variações locais. Publique o lote ou edite no form.`, 'ok');
        showToast(`Lote local: ${products.length} itens`);
      }
    } catch (err) {
      console.error(err);
      setAiStatus('Erro no gerador local.', 'error');
      showToast('Erro ao gerar localmente.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Gerar local';
      }
    }
  }, 280);
}

/** Usado pelo preview do lote (definido também no firebase-ai.js module) */
function renderBatchPreview(products) {
  const box = document.getElementById('ai-batch-preview');
  if (!box) return;
  if (!products || !products.length) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="ai-batch-header">
      <strong>${products.length} item(ns) gerado(s)</strong>
      <div class="ai-batch-actions">
        <button type="button" class="btn btn-primary btn-sm" onclick="adminAddAiBatch()">Adicionar todos ao mercado</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="adminClearAiBatch()">Descartar</button>
      </div>
    </div>
    <div class="ai-batch-list">
      ${products.map((p, i) => `
        <div class="ai-batch-item">
          <div class="ai-batch-main">
            <strong>${escapeHTML(p.name)}</strong>
            <span class="ai-batch-meta">${escapeHTML(CATEGORY_LABELS[p.category] || p.category)} · ${formatMoney(p.price)}</span>
            <p>${escapeHTML((p.description || '').slice(0, 140))}${(p.description || '').length > 140 ? '…' : ''}</p>
          </div>
          <div class="ai-batch-item-actions">
            <button type="button" class="btn btn-ghost btn-sm" onclick="adminApplyAiBatchItem(${i})">Editar no form</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="adminAddAiBatchItem(${i})">Só este</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

if (typeof window.adminClearAiBatch !== 'function') {
  window.adminClearAiBatch = function () {
    window.__gsAiBatch = null;
    renderBatchPreview([]);
    setAiStatus('', '');
  };
}

if (typeof window.adminApplyAiBatchItem !== 'function') {
  window.adminApplyAiBatchItem = function (index) {
    const list = window.__gsAiBatch || [];
    const p = list[index];
    if (!p) return;
    adminResetProductForm();
    document.getElementById('admin-product-name').value = String(p.name || '').slice(0, 80);
    document.getElementById('admin-product-desc').value = p.description || '';
    document.getElementById('admin-product-price').value = p.price ?? '';
    document.getElementById('admin-product-category').value = p.category || 'exoticos';
    document.getElementById('admin-product-delivery').value = p.deliveryDays || 0;
    document.getElementById('admin-product-stock').value = p.stock == null ? '' : p.stock;
    showToast('Carregado no formulário — revise e salve.');
  };
}

if (typeof window.adminAddAiBatchItem !== 'function') {
  window.adminAddAiBatchItem = async function (index) {
    const list = window.__gsAiBatch || [];
    const p = list[index];
    if (!p) return;
    try {
      await db.ref('products').push({
        name: p.name,
        description: p.description || '',
        price: Number(p.price) || 0,
        category: p.category || 'exoticos',
        image: '',
        stock: p.stock == null ? null : p.stock,
        deliveryDays: p.deliveryDays || 0,
        secretRank: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      showToast('Adicionado: ' + p.name);
      list.splice(index, 1);
      window.__gsAiBatch = list;
      renderBatchPreview(list);
    } catch (e) {
      console.error(e);
      showToast('Erro ao adicionar.', 'error');
    }
  };
}

if (typeof window.adminAddAiBatch !== 'function') {
  window.adminAddAiBatch = async function () {
    const list = window.__gsAiBatch || [];
    if (!list.length) return;
    if (!confirm('Adicionar ' + list.length + ' produto(s) ao mercado agora?')) return;
    try {
      const updates = {};
      list.forEach((p) => {
        const key = db.ref('products').push().key;
        updates['products/' + key] = {
          name: p.name,
          description: p.description || '',
          price: Number(p.price) || 0,
          category: p.category || 'exoticos',
          image: '',
          stock: p.stock == null ? null : p.stock,
          deliveryDays: p.deliveryDays || 0,
          secretRank: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      });
      await db.ref().update(updates);
      showToast(list.length + ' produtos adicionados.');
      if (typeof pushFeed === 'function') pushFeed('Novo lote de ' + list.length + ' itens no catálogo GS.', 'admin');
      window.__gsAiBatch = null;
      renderBatchPreview([]);
      setAiStatus('Lote publicado no mercado.', 'ok');
    } catch (e) {
      console.error(e);
      showToast('Erro ao publicar lote.', 'error');
    }
  };
}


/* ---------- STATUS FLEXÍVEL + REP ---------- */

async function adminSetOrderStatus(orderId, newStatus) {
  const order = state.allOrders.find(o => o.id === orderId);
  if (!order || !newStatus) return;
  const prev = order.status || 'in_transit';
  if (prev === newStatus) return;

  const now = Date.now();
  const updates = {};
  updates[`orders/${orderId}/status`] = newStatus;
  updates[`orders/${orderId}/statusMessage`] = STATUS_MESSAGES[newStatus] || '';

  if (newStatus === 'delivered') {
    updates[`orders/${orderId}/deliveredAt`] = now;
  }
  if (newStatus === 'refunded') {
    // devolve saldo
    try {
      const userSnap = await db.ref('users/' + order.userId + '/balance').once('value');
      const bal = Number(userSnap.val()) || 0;
      updates[`users/${order.userId}/balance`] = bal + (Number(order.price) || 0);
    } catch (e) { console.warn(e); }
  }

  try {
    const invSnap = await db.ref(`users/${order.userId}/inventory`).once('value');
    const inv = invSnap.val() || {};
    Object.entries(inv).forEach(([key, item]) => {
      if (item.productId === order.productId && item.status === prev) {
        updates[`users/${order.userId}/inventory/${key}/status`] = newStatus;
        updates[`users/${order.userId}/inventory/${key}/statusMessage`] = STATUS_MESSAGES[newStatus] || '';
        if (newStatus === 'delivered') {
          updates[`users/${order.userId}/inventory/${key}/deliveredAt`] = now;
        }
      }
    });

    // reputação: só soma ao virar delivered (e ainda não tinha)
    if (newStatus === 'delivered' && prev !== 'delivered') {
      const uSnap = await db.ref('users/' + order.userId).once('value');
      const u = uSnap.val() || {};
      updates[`users/${order.userId}/repSpent`] = (Number(u.repSpent) || 0) + (Number(order.price) || 0);
      updates[`users/${order.userId}/repOrders`] = (Number(u.repOrders) || 0) + 1;
    }

    await db.ref().update(updates);
    pushAdminLog({ type: 'status', orderId, productName: order.productName, userName: order.userName, from: prev, to: newStatus });
    showToast(`Status → ${STATUS_LABELS[newStatus] || newStatus}`);
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar status.', 'error');
  }
}

/* ---------- CUPONS ADMIN ---------- */

function renderAdminCoupons() {
  const el = document.getElementById('admin-coupons-list');
  if (!el) return;
  const list = Object.entries(state.coupons || {}).map(([code, c]) => ({ code, ...c }));
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">Nenhum cupom.</div>';
    return;
  }
  el.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Usos</th><th>Rank mín.</th><th></th></tr></thead>
    <tbody>
      ${list.map(c => `
        <tr>
          <td class="mono">${escapeHTML(c.code)}</td>
          <td>${c.type === 'percent' ? '%' : '$'}</td>
          <td>${c.type === 'percent' ? c.value + '%' : formatMoney(c.value)}</td>
          <td>${c.uses || 0}${c.maxUses != null ? ' / ' + c.maxUses : ''}</td>
          <td>${c.minRank || '—'}</td>
          <td><button class="btn btn-ghost btn-sm text-danger" onclick="adminDeleteCoupon('${escapeHTML(c.code)}')">Apagar</button></td>
        </tr>
      `).join('')}
    </tbody></table></div>`;
}

async function adminCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coupon-code').value.trim().toUpperCase();
  const type = document.getElementById('coupon-type').value;
  const value = parseFloat(document.getElementById('coupon-value').value);
  const maxUses = document.getElementById('coupon-max').value;
  const minRank = document.getElementById('coupon-rank').value || null;
  if (!code || isNaN(value)) {
    showToast('Código e valor obrigatórios.', 'error');
    return;
  }
  try {
    await db.ref('coupons/' + code).set({
      type,
      value,
      uses: 0,
      maxUses: maxUses === '' ? null : parseInt(maxUses, 10),
      minRank,
      createdAt: Date.now()
    });
    showToast('Cupom criado: ' + code);
    e.target.reset();
    pushFeed(`Código promocional ativo no núcleo GS.`, 'promo');
  } catch (err) {
    console.error(err);
    showToast('Erro ao criar cupom.', 'error');
  }
}

async function adminDeleteCoupon(code) {
  if (!confirm('Apagar cupom ' + code + '?')) return;
  await db.ref('coupons/' + code).remove();
  showToast('Cupom removido.');
}

/* ---------- OFERTAS ADMIN ---------- */

function renderAdminOffers() {
  const el = document.getElementById('admin-offers-list');
  if (!el) return;
  const list = (state.offers || []).filter(o => o.status === 'pending' || o.status === 'counter');
  const all = state.offers || [];
  if (!all.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma oferta.</div>';
    return;
  }
  el.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Jogador</th><th>Produto</th><th>Lista</th><th>Oferta</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${all.slice(0, 40).map(o => `
        <tr>
          <td>${escapeHTML(o.userName || '')}</td>
          <td>${escapeHTML(o.productName || '')}</td>
          <td class="mono">${formatMoney(o.listPrice)}</td>
          <td class="mono">${formatMoney(o.amount)}${o.counterAmount ? ` → ${formatMoney(o.counterAmount)}` : ''}</td>
          <td>${escapeHTML(o.status)}</td>
          <td class="admin-actions-cell">
            ${o.status === 'pending' ? `
              <button class="btn btn-primary btn-sm" onclick="adminRespondOffer('${o.id}','accept')">Aceitar</button>
              <button class="btn btn-ghost btn-sm" onclick="adminRespondOffer('${o.id}','counter')">Contra</button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="adminRespondOffer('${o.id}','reject')">Recusar</button>
            ` : '—'}
          </td>
        </tr>
      `).join('')}
    </tbody></table></div>`;
}

/* ---------- LOG ADMIN ---------- */

function renderAdminLog() {
  const el = document.getElementById('admin-log-list');
  if (!el) return;
  const list = state.adminLog || [];
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">Log vazio.</div>';
    return;
  }
  el.innerHTML = list.slice(0, 80).map(e => `
    <div class="log-row">
      <span class="log-time">${formatDateTime(e.createdAt)}</span>
      <span class="log-type">${escapeHTML(e.type || '')}</span>
      <span class="log-body">${escapeHTML(
        e.userName || ''
      )} ${escapeHTML(e.productName || '')} ${e.total != null ? formatMoney(e.total) : ''} ${e.amount != null ? formatMoney(e.amount) : ''} ${e.from ? (e.from + '→' + e.to) : ''}</span>
    </div>
  `).join('');
}

/* ---------- ACESSO SUBSOLO ---------- */

async function adminToggleBlackMarket(e) {
  e.preventDefault();
  const input = document.getElementById('admin-bm-user').value.trim();
  const grant = document.getElementById('admin-bm-grant').value === 'true';
  if (!input) return;
  try {
    let uid = input;
    if (input.includes('@')) {
      const snap = await db.ref('users').orderByChild('email').equalTo(input).once('value');
      const users = snap.val();
      if (!users) { showToast('Usuário não encontrado.', 'error'); return; }
      uid = Object.keys(users)[0];
    }
    await db.ref(`users/${uid}/blackMarketAccess`).set(grant);
    pushAdminLog({ type: 'blackmarket', userId: uid, grant });
    pushFeed(grant ? 'Novo contato liberado no subsolo.' : 'Acesso ao subsolo revogado.', 'system');
    showToast(grant ? 'Acesso ao Subsolo liberado.' : 'Acesso removido.');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar acesso.', 'error');
  }
}

async function adminPostFeed(e) {
  e.preventDefault();
  const text = document.getElementById('admin-feed-text').value.trim();
  if (!text) return;
  await pushFeed(text, 'admin');
  showToast('Feed publicado.');
  e.target.reset();
}

/* ---------- JOGADORES: inventário + rank ---------- */

function renderAdminPlayers() {
  const el = document.getElementById('admin-players-list');
  if (!el) return;

  const users = Object.entries(state.allUsers || {})
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!users.length) {
    el.innerHTML = '<div class="empty-state">Nenhum usuário carregado. Aguarde ou verifique as rules do Firebase (users read para admin).</div>';
    return;
  }

  el.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Jogador</th>
            <th>Saldo</th>
            <th>Rank</th>
            <th>Rep (gasto / pedidos)</th>
            <th>Itens</th>
            <th>Subsolo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const rank = getUserRank(u, null);
            const invCount = Object.keys(u.inventory || {}).length;
            const spent = Number(u.repSpent) || 0;
            const orders = Number(u.repOrders) || 0;
            return `
              <tr>
                <td>
                  <div class="admin-prod-name">${escapeHTML(u.name || '—')}</div>
                  <div class="admin-prod-desc">${escapeHTML(u.email || u.id)}</div>
                </td>
                <td class="mono">${formatMoney(u.balance)}</td>
                <td><span class="rank-badge" style="background:${rank.color}22;color:${rank.color};border-color:${rank.color}55">${escapeHTML(rank.label)}${u.rankOverride ? ' *' : ''}</span></td>
                <td class="mono" style="font-size:12px">${formatMoney(spent)} · ${orders}</td>
                <td>${invCount}</td>
                <td>${u.blackMarketAccess ? '<span class="tag-illegal">Sim</span>' : '—'}</td>
                <td class="admin-actions-cell">
                  <button class="btn btn-ghost btn-sm" onclick="adminViewPlayerInventory('${u.id}')">Inventário</button>
                  <button class="btn btn-ghost btn-sm" onclick="adminOpenRankEditor('${u.id}')">Rank</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div id="admin-player-detail" class="admin-player-detail hidden"></div>
  `;
}

async function adminViewPlayerInventory(uid) {
  const box = document.getElementById('admin-player-detail');
  if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = '<div class="empty-state">Carregando inventário...</div>';

  try {
    const snap = await db.ref('users/' + uid).once('value');
    const u = snap.val();
    if (!u) {
      box.innerHTML = '<div class="empty-state">Usuário não encontrado.</div>';
      return;
    }
    const inv = Object.entries(u.inventory || {}).map(([id, item]) => ({ id, ...item }));
    inv.sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));

    box.innerHTML = `
      <div class="admin-card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3>Inventário — ${escapeHTML(u.name || uid)}</h3>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('admin-player-detail').classList.add('hidden')">Fechar</button>
        </div>
        <p class="text-muted admin-hint">${inv.length} item(ns) · UID: ${uid}</p>
        ${inv.length === 0 ? '<div class="empty-state">Inventário vazio.</div>' : `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>Item</th><th>Preço pago</th><th>Status</th><th>Comprado</th></tr></thead>
              <tbody>
                ${inv.map(item => `
                  <tr>
                    <td>
                      <div class="admin-prod-name">${escapeHTML(item.name || '—')}${item.illegal ? ' <span class="tag-illegal">Subsolo</span>' : ''}</div>
                      <div class="admin-prod-desc">${escapeHTML(CATEGORY_LABELS[item.category] || item.category || '')}</div>
                    </td>
                    <td class="mono">${formatMoney(item.price)}</td>
                    <td><span class="status-pill ${statusClass(item.status || 'delivered')}">${formatDeliveryLabel(item)}</span></td>
                    <td style="font-size:12px">${item.boughtAt ? formatDateTime(item.boughtAt) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    box.innerHTML = '<div class="empty-state">Erro ao carregar inventário (rules?).</div>';
  }
}

function adminOpenRankEditor(uid) {
  const u = state.allUsers?.[uid];
  if (!u) {
    showToast('Usuário não encontrado na lista.', 'error');
    return;
  }
  const current = getUserRank(u, null);
  const options = RANK_THRESHOLDS.map(r =>
    `<option value="${r.id}" ${current.id === r.id ? 'selected' : ''}>${r.label}</option>`
  ).join('');

  const box = document.getElementById('admin-player-detail');
  if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="admin-card" style="margin-top:16px;max-width:480px">
      <h3>Ajustar rank — ${escapeHTML(u.name || uid)}</h3>
      <p class="text-muted admin-hint">Atual: <strong style="color:${current.color}">${current.label}</strong>
        ${u.rankOverride ? ' (override manual)' : ' (por reputação)'}
      </p>
      <div class="form-group">
        <label>Novo rank</label>
        <select id="admin-rank-select">${options}</select>
      </div>
      <div class="form-group">
        <label>Modo</label>
        <select id="admin-rank-mode">
          <option value="override">Forçar rank (override)</option>
          <option value="stats">Ajustar repSpent/repOrders para o mínimo do rank</option>
          <option value="clear">Remover override (voltar à reputação)</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" onclick="adminApplyRank('${uid}')">Aplicar</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('admin-player-detail').classList.add('hidden')">Cancelar</button>
      </div>
    </div>
  `;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function adminApplyRank(uid) {
  const rankId = document.getElementById('admin-rank-select')?.value;
  const mode = document.getElementById('admin-rank-mode')?.value || 'override';
  const threshold = RANK_THRESHOLDS.find(r => r.id === rankId);
  if (!threshold) {
    showToast('Rank inválido.', 'error');
    return;
  }

  const updates = {};
  try {
    if (mode === 'clear') {
      updates[`users/${uid}/rankOverride`] = null;
    } else if (mode === 'override') {
      updates[`users/${uid}/rankOverride`] = rankId;
    } else if (mode === 'stats') {
      const snap = await db.ref('users/' + uid).once('value');
      const u = snap.val() || {};
      updates[`users/${uid}/repSpent`] = Math.max(Number(u.repSpent) || 0, threshold.spent);
      updates[`users/${uid}/repOrders`] = Math.max(Number(u.repOrders) || 0, threshold.orders);
      updates[`users/${uid}/rankOverride`] = null;
    }

    await db.ref().update(updates);
    if (typeof pushAdminLog === 'function') {
      pushAdminLog({ type: 'rank', userId: uid, rankId, mode });
    }
    showToast('Rank atualizado: ' + threshold.label);
    document.getElementById('admin-player-detail')?.classList.add('hidden');
    renderAdminPlayers();
  } catch (e) {
    console.error(e);
    showToast('Erro ao atualizar rank.', 'error');
  }
}
