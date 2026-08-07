/* Global Smith — Firebase AI Logic (mesmo padrão do Jet League) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js";
// App Check desativado de propósito — não importamos nem inicializamos

const aiFirebaseConfig = {
  apiKey: "AIzaSyCBttq3QfezqC5y2KRI4kSs5VoUnAP90Zk",
  authDomain: "mercado-smith.firebaseapp.com",
  databaseURL: "https://mercado-smith-default-rtdb.firebaseio.com",
  projectId: "mercado-smith",
  storageBucket: "mercado-smith.firebasestorage.app",
  messagingSenderId: "1084544496126",
  appId: "1:1084544496126:web:6a3e7bdff7e246e88bd0af"
};

let aiApp = null;

function getAIApp() {
  if (!aiApp) aiApp = initializeApp(aiFirebaseConfig, "gsAI");
  return aiApp;
}

async function jetStyleGenerate(prompt, modelName = "gemini-3.6-flash") {
  const ai = getAI(getAIApp(), { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, { model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

const CATEGORIES = [
  "equipamentos", "consumiveis", "servicos", "comida",
  "ilegais", "exoticos", "utilidades", "informacoes"
];

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

function applyProductToForm(product, catHint) {
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

  if (typeof adminResetProductForm === "function") adminResetProductForm();

  document.getElementById("admin-product-name").value = String(product.name || "").slice(0, 80);
  document.getElementById("admin-product-desc").value = String(product.description || "");
  document.getElementById("admin-product-price").value = isNaN(price) ? "" : Math.round(price * 100) / 100;
  document.getElementById("admin-product-category").value = category;
  document.getElementById("admin-product-delivery").value = deliveryDays;
  document.getElementById("admin-product-stock").value = stock === null ? "" : stock;

  document.getElementById("admin-product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.generateProductWithFirebaseAI = async function generateProductWithFirebaseAI() {
  const promptEl = document.getElementById("ai-prompt");
  const toneEl = document.getElementById("ai-tone");
  const catHintEl = document.getElementById("ai-category-hint");
  const btn = document.getElementById("btn-ai-generate");

  const idea = (promptEl?.value || "").trim();
  const tone = toneEl?.value || "premium";
  const catHint = catHintEl?.value || "";

  if (!idea) {
    showToast("Descreva a ideia do item.", "error");
    promptEl?.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Gerando...";
  }
  if (typeof setAiStatus === "function") setAiStatus("Firebase AI gerando (gemini-3.6-flash)...", "loading");

  const toneMap = {
    premium: "premium, corporativo, sofisticado, Global Smith",
    sombrio: "sombrio, underground, noir, ameaçador",
    tecnologico: "tecnológico, cyber, high-tech, futurista",
    luxo: "luxo extremo, exclusivo, ostentação, elite",
    ilegal: "mercado negro, ilegal, discreto, arriscado"
  };

  const prompt = `Você cria produtos para o marketplace in-world "Global Smith" (RPG, tom corporativo premium).
Responda APENAS com JSON válido, sem markdown:
{"name":"string max 60","description":"2-4 frases em pt-BR","price":number,"category":"uma de: ${CATEGORIES.join(", ")}","deliveryDays":number,"stock":number|null}

Ideia: ${idea}
Tom: ${toneMap[tone] || tone}
${catHint ? `Categoria preferida: ${catHint}` : "Escolha a categoria adequada."}
Regras: português BR; sem emojis no nome; category exatamente uma das chaves; deliveryDays 0 = imediato.`;

  try {
    // Mesmo modelo padrão do Jet League; fallback se indisponível
    let text = "";
    try {
      text = await jetStyleGenerate(prompt, "gemini-3.6-flash");
    } catch (e1) {
      console.warn("gemini-3.6-flash falhou, tentando gemini-2.5-flash", e1);
      text = await jetStyleGenerate(prompt, "gemini-2.5-flash");
    }

    const product = extractJson(text);
    if (!product || !product.name) {
      console.error("Firebase AI raw:", text);
      throw new Error("A IA não retornou um produto válido. Tente de novo.");
    }

    applyProductToForm(product, catHint);
    if (typeof setAiStatus === "function") {
      setAiStatus("Pronto via Firebase AI. Revise e adicione o produto.", "ok");
    }
    showToast("Item gerado (Firebase AI)");
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
      btn.textContent = "Gerar com IA (Firebase)";
    }
  }
};
