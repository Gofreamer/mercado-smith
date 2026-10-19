const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness({ failures = {}, tokenError, initError } = {}) {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../js/features/admin/firebase-ai.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').split('const CATEGORIES')[0];
  const calls = { init: 0, tokens: 0, models: [] };
  const context = vm.createContext({
    console: { warn() {} },
    initializeApp: () => ({}),
    initializeAppCheck: () => { calls.init++; if (initError && calls.init === 1) throw initError; return {}; },
    ReCaptchaEnterpriseProvider: function(key) { assert.match(key, /^6L/); },
    getToken: async () => { calls.tokens++; if (tokenError) throw tokenError; return { token: 'mock' }; },
    GoogleAIBackend: function() {},
    getAI: () => ({}),
    getGenerativeModel: (_ai, { model }) => ({ generateContent: async () => {
      calls.models.push(model);
      if (failures[model]) throw new Error(failures[model]);
      return { response: { text: () => 'ok' } };
    } })
  });
  vm.runInContext(source, context);
  return { calls, run: () => vm.runInContext("jetStyleGenerate('prompt')", context), friendly: message => context.getFirebaseAIErrorMessage(new Error(message)) };
}

test('App Check valida antes da IA e inicializa apenas uma vez', async () => {
  const h = harness();
  assert.equal(await h.run(), 'ok');
  assert.equal(await h.run(), 'ok');
  assert.equal(h.calls.init, 1);
  assert.equal(h.calls.tokens, 2);
});

test('403 do projeto interrompe fallback sem repetir chamadas', async () => {
  const h = harness({ failures: { 'gemini-3.6-flash': '[403] Firebase AI Logic has been deactivated in this project' } });
  await assert.rejects(h.run(), /403/);
  assert.deepEqual(h.calls.models, ['gemini-3.6-flash']);
  assert.match(h.friendly('[403] Firebase AI Logic has been deactivated in this project'), /desativado no projeto/);
  assert.match(h.friendly('[403] permission denied'), /permissões/);
});

test('modelo indisponível permite fallback', async () => {
  const h = harness({ failures: { 'gemini-3.6-flash': '[404] model not found' } });
  assert.equal(await h.run(), 'ok');
  assert.deepEqual(h.calls.models, ['gemini-3.6-flash', 'gemini-2.5-flash']);
});

test('falha no token não envia pedido para nenhum modelo', async () => {
  const h = harness({ tokenError: new Error('appCheck/recaptcha-error') });
  await assert.rejects(h.run(), /recaptcha/);
  assert.deepEqual(h.calls.models, []);
  assert.match(h.friendly('appCheck/recaptcha-error'), /validar o App Check/);
});

test('falha de inicialização pode ser recuperada na próxima tentativa', async () => {
  const h = harness({ initError: new Error('appCheck initialization failed') });
  await assert.rejects(h.run(), /initialization/);
  assert.equal(await h.run(), 'ok');
  assert.equal(h.calls.init, 2);
});
