'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function account() {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const code = app.slice(app.indexOf("  const SESSION_KEY ="), app.indexOf('  function renderBackup('));
  const saved = new Map();
  const context = vm.createContext({
    Core: {}, DATA: [], AtlasAchievementsUI: { create: () => ({}) },
    CLOUD: { url: 'https://example.invalid', anonKey: 'public' },
    state: { view: 'quiz' }, renderProgress() {},
    localStorage: { setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
  });
  vm.runInContext(code + '\nglobalThis.api = { cloud, nicknameOf, writeSession, saveNickname, loadNickname, refreshSession, ensureCloudIdentity };', context);
  context.api.writeSession({ user_id: 'one', email: 'test@example.invalid', access_token: 'a', refresh_token: 'r' });
  return { api: context.api, context };
}

test('apelido ausente ou inválido é um estado válido', () => {
  const { api } = account();
  for (const user of [null, {}, { user_metadata: { atlas_nickname: 12 } }]) assert.equal(api.nicknameOf(user), '');
});

test('perfil pendente não permite salvar; falha permite recuperar a identidade', async () => {
  const { api, context } = account();
  api.writeSession({ access_token: 'a', refresh_token: 'r' });
  let reject;
  let calls = 0;
  context.fetch = () => { calls++; return new Promise((_, fail) => { reject = fail; }); };
  const pending = api.ensureCloudIdentity();
  assert.equal(api.cloud.identityPending, true);
  await api.saveNickname();
  assert.equal(calls, 1);
  reject(new Error('offline'));
  await assert.rejects(pending, /offline/);
  assert.equal(api.cloud.identityPending, false);
  assert.equal(api.cloud.session.user_id, undefined);
  context.fetch = async () => ({ ok: true, json: async () => ({ id: 'one', email: 'test@example.invalid' }) });
  assert.equal(await api.ensureCloudIdentity(), true);
  assert.equal(api.cloud.session.user_id, 'one');
});

test('resposta de identidade atrasada não restaura uma sessão encerrada', async () => {
  const { api, context } = account();
  api.writeSession({ access_token: 'a', refresh_token: 'r' });
  let finish;
  context.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = api.ensureCloudIdentity();
  api.writeSession(null);
  finish({ ok: true, json: async () => ({ id: 'one', email: 'test@example.invalid' }) });
  assert.equal(await pending, false);
  assert.equal(api.cloud.session, null);
  assert.equal(api.cloud.identityPending, false);
});

test('perfil incompleto ou malformado não confirma a conexão', async () => {
  const { api, context } = account();
  api.writeSession({ access_token: 'a', refresh_token: 'r' });
  for (const user of [null, {}, { id: 123, email: 'test@example.invalid' }, { id: 'one', email: '' }]) {
    context.fetch = async () => ({ ok: true, json: async () => user });
    assert.equal(await api.ensureCloudIdentity(), false);
    assert.equal(api.cloud.session.user_id, undefined);
    assert.equal(api.cloud.identityPending, false);
  }
});

test('salvar e remover apelido envia somente metadata e preserva a sessão', async () => {
  const { api, context } = account();
  const requests = [];
  context.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ id: 'one', user_metadata: JSON.parse(options.body).data }) };
  };
  api.cloud.nicknameDraft = '  João 🌍  ';
  await api.saveNickname();
  assert.equal(api.cloud.session.nickname, 'João 🌍');
  assert.equal(api.cloud.session.email, 'test@example.invalid');
  assert.equal(requests[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(requests[0].options.body), { data: { atlas_nickname: 'João 🌍' } });
  api.cloud.nicknameDraft = '';
  await api.saveNickname();
  assert.equal(api.cloud.session.nickname, '');
  assert.equal(JSON.parse(requests[1].options.body).data.atlas_nickname, null);
});

test('falha mantém rascunho; limite impede envio e permite nova tentativa', async () => {
  const { api, context } = account();
  let calls = 0;
  context.fetch = async () => { calls++; throw new Error('offline'); };
  api.cloud.nicknameDraft = 'a'.repeat(41);
  await api.saveNickname();
  assert.equal(calls, 0);
  api.cloud.nicknameDraft = 'Rascunho';
  await api.saveNickname();
  assert.equal(api.cloud.nicknameDraft, 'Rascunho');
  assert.equal(api.cloud.savingNickname, false);
  assert.equal(api.cloud.nicknameStatus.kind, 'error');
});

test('renovação de token repete o salvamento sem perder apelido', async () => {
  const { api, context } = account();
  let puts = 0;
  context.fetch = async (url, options) => {
    if (url.includes('/token?')) return { ok: true, json: async () => ({ access_token: 'new', refresh_token: 'new-r', user: { id: 'one', email: 'test@example.invalid' } }) };
    puts++;
    if (puts === 1) return { status: 401 };
    assert.equal(options.headers.Authorization, 'Bearer new');
    return { ok: true, json: async () => ({ id: 'one', user_metadata: { atlas_nickname: 'Novo' } }) };
  };
  api.cloud.nicknameDraft = 'Novo';
  await api.saveNickname();
  assert.equal(puts, 2);
  assert.equal(api.cloud.session.nickname, 'Novo');
});

test('leitura antiga não desfaz salvamento e resposta após sair não recria sessão', async () => {
  const { api, context } = account();
  let finish;
  context.fetch = async (_, options) => options.method === 'PUT'
    ? { ok: true, json: async () => ({ id: 'one', user_metadata: { atlas_nickname: 'Novo' } }) }
    : new Promise(resolve => { finish = resolve; });
  const loading = api.loadNickname();
  api.cloud.nicknameDraft = 'Novo';
  await api.saveNickname();
  finish({ ok: true, json: async () => ({ id: 'one', user_metadata: { atlas_nickname: 'Antigo' } }) });
  await loading;
  assert.equal(api.cloud.session.nickname, 'Novo');
  const next = api.loadNickname();
  api.writeSession(null);
  finish({ ok: true, json: async () => ({ id: 'one' }) });
  await next;
  assert.equal(api.cloud.session, null);
});
