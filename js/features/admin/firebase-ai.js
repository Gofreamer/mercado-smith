/* Global Smith — Firebase AI Logic (mesmo padrão do Jet League) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app-check.js";

const aiFirebaseConfig = {
  apiKey: "AIzaSyCBttq3QfezqC5y2KRI4kSs5VoUnAP90Zk",
  authDomain: "mercado-smith.firebaseapp.com",
  databaseURL: "https://mercado-smith-default-rtdb.firebaseio.com",
  projectId: "mercado-smith",
  storageBucket: "mercado-smith.firebasestorage.app",
  messagingSenderId: "1084544496126",
  appId: "1:1084544496126:web:6a3e7bdff7e246e88bd0af"
};

// Igual ao Jet League: deixe vazio para NÃO ativar App Check.
const APP_CHECK_SITE_KEY = "";

let aiApp = null;
let appCheckReady = false;

function getAIApp() {
  if (!aiApp) aiApp = initializeApp(aiFirebaseConfig, "gsAI");
  if (!appCheckReady && APP_CHECK_SITE_KEY) {
    try {
      initializeAppCheck(aiApp, {
        provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    } catch (e) {
      console.warn("App Check:", e?.message || e);
    }
    appCheckReady = true;
  }
  return aiApp;
}

async function jetStyleGenerate(prompt, modelName = "gemini-3.6-flash") {
  const ai = getAI(getAIApp(), { backend: new GoogleAIBackend() });
  const candidates = [modelName, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash"];
  const tried = new Set();
  let lastErr;
  for (const m of candidates) {
    if (tried.has(m)) continue;
    tried.add(m);
    try {
      const model = getGenerativeModel(ai, { model: m });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      lastErr = e;
      console.warn("AI model failed:", m, e?.message || e);
    }
  }
  throw lastErr || new Error("Nenhum modelo Gemini disponível");
}

const CATEGORIES = [
  "equipamentos", "consumiveis", "servicos", "comida",
  "ilegais", "exoticos", "utilidades", "informacoes"
];

/** Pending batch from last AI call — used by "Adicionar todos" */
window.__gsAiBatch = null;

function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

function extractProducts(text) {
  if (!text) return [];
  let data = null;
  try { data = JSON.parse(text); } catch {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try { data = JSON.parse(fence[1].trim()); } catch {}
    }
  }
  if (!data) {
    // try array slice
    const a = text.indexOf("[");
    const b = text.lastIndexOf("]");
    if (a !== -1 && b > a) {
      try { data = JSON.parse(text.slice(a, b + 1)); } catch {}
    }
  }
  if (!data) {
    const one = extractJson(text);
    return one && one.name ? [one] : [];
  }
  if (Array.isArray(data)) return data.filter(p => p && p.name);
  if (Array.isArray(data.products)) return data.products.filter(p => p && p.name);
  if (data.name) return [data];
  return [];
}

function normalizeProduct(product, catHint) {
  let category = product.category;
  if (!CATEGORIES.includes(category)) category = catHint || "exoticos";

  const price = Number(product.price);
  const deliveryDays = Math.max(0, parseInt(product.deliveryDays, 10) || 0);
  let stock = product.stock;
  if (stock === undefined || stock === "" || stock === "null" || stock === null) stock = null;
  else {
    stock = parseInt(stock, 10);
    if (isNaN(stock)) stock = null;
  }

  return {
    name: String(product.name || "").slice(0, 80),
    description: String(product.description || ""),
    price: isNaN(price) ? 0 : Math.round(price * 100) / 100,
    category,
    deliveryDays,
    stock,
    image: "",
    secretRank: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function applyProductToForm(product, catHint) {
  const p = normalizeProduct(product, catHint);
  if (typeof adminResetProductForm === "function") adminResetProductForm();

  document.getElementById("admin-product-name").value = p.name;
  document.getElementById("admin-product-desc").value = p.description;
  document.getElementById("admin-product-price").value = p.price;
  document.getElementById("admin-product-category").value = p.category;
  document.getElementById("admin-product-delivery").value = p.deliveryDays;
  document.getElementById("admin-product-stock").value = p.stock === null ? "" : p.stock;
  const sec = document.getElementById("admin-product-secret");
  if (sec) sec.value = "";

  document.getElementById("admin-product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function readAiInputs() {
  const promptEl = document.getElementById("ai-prompt");
  const toneEl = document.getElementById("ai-tone");
  const catHintEl = document.getElementById("ai-category-hint");
  const qtyEl = document.getElementById("ai-qty");

  const idea = (promptEl?.value || "").trim();
  const toneRaw = (toneEl?.value || "").trim();
  const catHint = catHintEl?.value || "";
  let qty = parseInt(qtyEl?.value, 10);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 10) qty = 10;

  if (!idea) {
    showToast("Descreva a ideia do item ou do lote.", "error");
    promptEl?.focus();
    return null;
  }
  if (!toneRaw) {
    showToast('Informe o tom (ou escreva "nenhum").', "error");
    toneEl?.focus();
    return null;
  }

  const toneNeutral = /^(nenhum|none|neutro|sem tom|n\/?a)$/i.test(toneRaw);
  const tone = toneNeutral ? "neutro, sem estilo forçado" : toneRaw;

  return { idea, tone, catHint, qty, promptEl, toneEl };
}

function buildPrompt(idea, tone, catHint, qty) {
  if (qty <= 1) {
    return `Você cria produtos para o marketplace in-world "Global Smith" (RPG).
Responda APENAS com JSON válido, sem markdown:
{"name":"string max 60","description":"2-4 frases em pt-BR","price":number,"category":"uma de: ${CATEGORIES.join(", ")}","deliveryDays":number,"stock":number|null}

Ideia: ${idea}
Tom / estilo: ${tone}
${catHint ? `Categoria preferida: ${catHint}` : "Escolha a categoria adequada."}
Regras: português BR; sem emojis no nome; category exatamente uma das chaves; deliveryDays 0 = imediato; respeite o tom (se neutro, texto limpo e direto).`;
  }

  return `Você cria produtos para o marketplace in-world "Global Smith" (RPG).
Gere exatamente ${qty} produtos DISTINTOS baseados no pedido do mestre (variações coerentes, não cópias).
Responda APENAS com JSON válido, sem markdown — um array:
[{"name":"string max 60","description":"2-4 frases em pt-BR","price":number,"category":"uma de: ${CATEGORIES.join(", ")}","deliveryDays":number,"stock":number|null}, ...]

Pedido / lote: ${idea}
Tom / estilo: ${tone}
${catHint ? `Categoria preferida (quando fizer sentido): ${catHint}` : "Escolha categorias adequadas a cada item."}
Regras: português BR; nomes diferentes entre si; sem emojis no nome; category exatamente uma das chaves; deliveryDays 0 = imediato; respeite o tom; preços variados e realistas.`;
}

function renderBatchPreview(products) {
  const box = document.getElementById("ai-batch-preview");
  if (!box) return;
  if (!products.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
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
            <p>${escapeHTML((p.description || "").slice(0, 140))}${(p.description || "").length > 140 ? "…" : ""}</p>
          </div>
          <div class="ai-batch-item-actions">
            <button type="button" class="btn btn-ghost btn-sm" onclick="adminApplyAiBatchItem(${i})">Editar no form</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="adminAddAiBatchItem(${i})">Só este</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

window.adminClearAiBatch = function () {
  window.__gsAiBatch = null;
  renderBatchPreview([]);
  if (typeof setAiStatus === "function") setAiStatus("", "");
};

window.adminApplyAiBatchItem = function (index) {
  const list = window.__gsAiBatch || [];
  const p = list[index];
  if (!p) return;
  applyProductToForm(p, p.category);
  showToast("Carregado no formulário — revise e salve.");
};

window.adminAddAiBatchItem = async function (index) {
  const list = window.__gsAiBatch || [];
  const p = list[index];
  if (!p) return;
  try {
    await db.ref("products").push({
      ...normalizeProduct(p, p.category),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    showToast(`Adicionado: ${p.name}`);
    list.splice(index, 1);
    window.__gsAiBatch = list;
    renderBatchPreview(list);
    if (!list.length && typeof setAiStatus === "function") {
      setAiStatus("Lote concluído.", "ok");
    }
  } catch (e) {
    console.error(e);
    showToast("Erro ao adicionar produto.", "error");
  }
};

window.adminAddAiBatch = async function () {
  const list = window.__gsAiBatch || [];
  if (!list.length) return;
  const okBatch = await gsConfirm({
    title: 'Publicar lote',
    body: `Adicionar <strong>${list.length}</strong> produto(s) ao mercado agora?`,
    confirmLabel: 'Publicar'
  });
  if (!okBatch) return;
  try {
    const updates = {};
    list.forEach((p) => {
      const key = db.ref("products").push().key;
      updates[`products/${key}`] = {
        ...normalizeProduct(p, p.category),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    });
    await db.ref().update(updates);
    showToast(`${list.length} produtos adicionados.`);
    if (typeof pushFeed === "function") {
      pushFeed(`Novo lote de ${list.length} itens no catálogo GS.`, "admin");
    }
    window.__gsAiBatch = null;
    renderBatchPreview([]);
    if (typeof setAiStatus === "function") setAiStatus("Lote publicado no mercado.", "ok");
  } catch (e) {
    console.error(e);
    showToast("Erro ao publicar lote.", "error");
  }
};

async function runFirebaseGenerate(qtyOverride) {
  const inputs = readAiInputs();
  if (!inputs) return;
  const { idea, tone, catHint } = inputs;
  const qty = qtyOverride != null ? qtyOverride : inputs.qty;

  const btn = document.getElementById("btn-ai-generate");
  const btnBatch = document.getElementById("btn-ai-batch");
  const buttons = [btn, btnBatch].filter(Boolean);
  buttons.forEach((b) => { b.disabled = true; });
  if (btn) btn.textContent = "Gerando...";
  if (btnBatch) btnBatch.textContent = "Gerando lote...";

  if (typeof setAiStatus === "function") {
    setAiStatus(
      qty > 1
        ? `Firebase AI gerando lote de ${qty} itens...`
        : "Firebase AI gerando (gemini-3.6-flash)...",
      "loading"
    );
  }

  const prompt = buildPrompt(idea, tone, catHint, qty);

  try {
    let text = "";
    try {
      text = await jetStyleGenerate(prompt, "gemini-3.6-flash");
    } catch (e1) {
      console.warn("gemini-3.6-flash falhou, tentando gemini-2.5-flash", e1);
      text = await jetStyleGenerate(prompt, "gemini-2.5-flash");
    }

    const products = extractProducts(text).map((p) => normalizeProduct(p, catHint));
    if (!products.length) {
      console.error("Firebase AI raw:", text);
      throw new Error("A IA não retornou produto(s) válido(s). Tente de novo.");
    }

    if (products.length === 1 && qty <= 1) {
      window.__gsAiBatch = null;
      renderBatchPreview([]);
      applyProductToForm(products[0], catHint);
      if (typeof setAiStatus === "function") {
        setAiStatus("Pronto via Firebase AI. Revise e adicione o produto.", "ok");
      }
      showToast("Item gerado (Firebase AI)");
    } else {
      window.__gsAiBatch = products;
      renderBatchPreview(products);
      if (typeof setAiStatus === "function") {
        setAiStatus(`${products.length} itens gerados. Revise o lote e publique.`, "ok");
      }
      showToast(`Lote: ${products.length} itens`);
      // also load first into form for quick edit
      applyProductToForm(products[0], catHint);
    }
  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? err.message : String(err);
    let friendly = msg;
    if (/quota|429|rate-limit|free_tier|limit: 0/i.test(msg)) {
      friendly = "Cota do modelo esgotada ou indisponível neste projeto. Use Gerar local ou troque o modelo/plano no Google AI.";
    } else if (/inactive|onboarding/i.test(msg)) {
      friendly = "AI Logic ainda inativo. Complete o onboarding no console.";
    } else if (/App Check|appCheck|403/i.test(msg)) {
      friendly = "App Check bloqueou. Confira site key e domínio (pages.dev / localhost).";
    }
    if (typeof setAiStatus === "function") setAiStatus(friendly, "error");
    showToast(friendly, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Gerar 1 com IA";
    }
    if (btnBatch) {
      btnBatch.disabled = false;
      btnBatch.textContent = "Gerar lote (IA)";
    }
  }
}

window.generateProductWithFirebaseAI = async function generateProductWithFirebaseAI() {
  const qtyEl = document.getElementById("ai-qty");
  const qty = Math.max(1, Math.min(10, parseInt(qtyEl?.value, 10) || 1));
  // botão principal: se qty>1 gera lote, senão 1
  await runFirebaseGenerate(qty);
};

window.generateProductBatchWithFirebaseAI = async function generateProductBatchWithFirebaseAI() {
  const qtyEl = document.getElementById("ai-qty");
  let qty = parseInt(qtyEl?.value, 10);
  if (isNaN(qty) || qty < 2) qty = 5;
  if (qty > 10) qty = 10;
  if (qtyEl) qtyEl.value = String(qty);
  await runFirebaseGenerate(qty);
};


window.generateVendorWithFirebaseAI = async function generateVendorWithFirebaseAI(ideaArg, toneArg) {
  const idea = (ideaArg || document.getElementById("vendor-ai-idea")?.value || "").trim();
  const tone = (toneArg || document.getElementById("vendor-ai-tone")?.value || "premium corporativo").trim() || "premium corporativo";
  if (!idea) {
    if (typeof showToast === "function") showToast("Descreva a vitrine.", "error");
    return;
  }
  const btn = document.querySelector('button[onclick="generateVendorWithAI()"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Gerando…";
  }
  try {
    const prompt = `Você cria vitrines/vendedores NPC para o mercado fictício Global Smith (RP cyber-corporativo).
Responda APENAS com um JSON válido (sem markdown), neste formato:
{
  "name": "nome curto da vitrine (até 48 chars)",
  "slug": "slug-url-simples",
  "tagline": "frase curta de marketing (até 80 chars)",
  "tone": "uma palavra: premium|show|underground|courier|corporativo",
  "description": "2 frases em português BR, tom in-world, sem emoji"
}
Ideia do mestre: ${idea}
Tom pedido: ${tone}
Regras: português BR; nome próprio quando fizer sentido (ex: Nina Riders Merch); sem inventar URLs.`;

    const text = await jetStyleGenerate(prompt, "gemini-3.6-flash");
    const data = extractJson(text);
    if (!data || !data.name) {
      throw new Error("Resposta da IA inválida");
    }
    const name = String(data.name).slice(0, 48);
    let slug = String(data.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (!slug) slug = "vitrine";
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    set("vendor-name", name);
    set("vendor-slug", slug);
    set("vendor-tagline", String(data.tagline || "").slice(0, 80));
    set("vendor-tone", String(data.tone || tone).slice(0, 40));
    set("vendor-desc", String(data.description || "").slice(0, 400));
    if (typeof showToast === "function") showToast("Vitrine gerada pela IA — revise e salve.");
  } catch (err) {
    console.error(err);
    const msg = err?.message || String(err);
    if (typeof showToast === "function") {
      showToast("IA falhou: " + msg.slice(0, 120) + " — tentando local…", "error");
    }
    if (typeof generateVendorLocal === "function") generateVendorLocal();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Gerar com IA";
    }
  }
};


window.generateEventWithFirebaseAI = async function generateEventWithFirebaseAI() {
  const idea = (document.getElementById("event-ai-idea")?.value || "").trim();
  const tone = (document.getElementById("event-ai-tone")?.value || "campanha premium").trim() || "campanha premium";
  if (!idea) {
    if (typeof showToast === "function") showToast("Descreva o evento (ex: Semana Nina Riders).", "error");
    return;
  }
  const btn = document.getElementById("btn-event-ai");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Gerando…";
  }
  try {
    const prompt = `Você cria eventos temporários para o mercado fictício Global Smith (RP cyber-corporativo).
Responda APENAS com um JSON válido (sem markdown), neste formato:
{
  "name": "nome do evento (até 60 chars)",
  "tagLabel": "tag curta no catálogo (até 24 chars)",
  "tagColor": "#hexcor vibrante",
  "bannerText": "frase do banner (até 100 chars)",
  "description": "1-2 frases in-world em português BR",
  "discountPercent": number entre 0 e 40,
  "autoCoupon": true ou false,
  "couponCode": "CODIGOMAIUSCULO sem espaços (até 12) ou null",
  "couponPercent": number entre 0 e 40
}
Ideia do mestre: ${idea}
Tom: ${tone}
Regras: português BR; sem emoji; cupom só se fizer sentido narrativo; cores tipo #e11d48 #6366f1 #f59e0b.`;

    const text = await jetStyleGenerate(prompt, "gemini-3.6-flash");
    const data = extractJson(text);
    if (!data || !data.name) throw new Error("Resposta da IA inválida");

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null && val !== "") el.value = val;
    };
    set("event-name", String(data.name).slice(0, 60));
    set("event-tag", String(data.tagLabel || data.name).slice(0, 24));
    if (data.tagColor && /^#[0-9a-fA-F]{6}$/.test(String(data.tagColor))) {
      set("event-color", data.tagColor);
    }
    set("event-banner-text", String(data.bannerText || "").slice(0, 120));
    set("event-desc", String(data.description || "").slice(0, 300));
    const disc = Math.max(0, Math.min(90, parseInt(data.discountPercent, 10) || 0));
    set("event-discount", String(disc));
    const auto = !!data.autoCoupon;
    if (document.getElementById("event-auto-coupon")) {
      document.getElementById("event-auto-coupon").value = auto ? "true" : "false";
    }
    if (auto && data.couponCode) {
      set("event-coupon-code", String(data.couponCode).toUpperCase().replace(/\s+/g, "").slice(0, 12));
    }
    const cp = Math.max(0, Math.min(90, parseInt(data.couponPercent, 10) || disc));
    set("event-coupon-percent", String(cp));
    if (typeof showToast === "function") showToast("Evento gerado pela IA (gemini-3.6-flash) — revise e salve.");
  } catch (err) {
    console.error(err);
    if (typeof showToast === "function") {
      showToast("IA do evento falhou: " + String(err?.message || err).slice(0, 140), "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Gerar com IA";
    }
  }
};
