'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Account = require('../src/account.js');

// O módulo da conta recebe o "host" (fetch, localStorage, location) por
// injeção, então os estados de rede são simulados sem DOM nem serviço real.
function account(core, queue) {
  const saved = new Map();
  const host = {
    localStorage: { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
    location: { protocol: 'https:', origin: 'https://example.invalid', pathname: '/', search: '', hash: '' },
    history: { replaceState() {} },
    fetch: async () => { throw new Error('fetch não configurado'); },
  };
  const api = Account.create({
    Core: core || { cloudReady: () => true },
    SyncQueue: queue || { create: () => ({ run: async () => true, schedule() {}, cancel() {} }) },
    config: { url: 'https://example.invalid', anonKey: 'public', tabela: 't' },
    ids: [], host, el: () => { throw new Error('sem DOM'); },
    rerender() {},
  });
  api.writeSession({ user_id: 'one', email: 'test@example.invalid', access_token: 'a', refresh_token: 'r' });
  return { api, host, saved };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const renewed = () => ({ ok: true, json: async () => ({ access_token: 'new', refresh_token: 'new-r', user: { id: 'one' } }) });

test('renovações concorrentes usam um único pedido e preservam a sessão em falha temporária', async () => {
  const { api, host } = account();
  const response = deferred();
  let calls = 0;
  host.fetch = () => { calls++; return response.promise; };
  const first = api.refreshSession();
  const second = api.refreshSession();
  response.resolve(renewed());
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(calls, 1);
  for (const status of [429, 500, 503]) {
    host.fetch = async () => ({ ok: false, status });
    assert.equal(await api.refreshSession(), false);
    assert.equal(api.cloud.session.access_token, 'new');
  }
  host.fetch = async () => ({ ok: false, status: 400 });
  assert.equal(await api.refreshSession(), false);
  assert.equal(api.cloud.session, null);
});

test('sair é imediato e uma renovação atrasada não reconecta a conta', async () => {
  const { api, host, saved } = account();
  const refresh = deferred();
  const logout = deferred();
  host.fetch = (url, options) => {
    if (url.includes('/token?')) return refresh.promise;
    assert.equal(options.headers.Authorization, 'Bearer a');
    return logout.promise;
  };
  const pending = api.refreshSession();
  const leaving = api.signOut();
  assert.equal(api.cloud.session, null);
  assert.equal(saved.has(Account.SESSION_KEY), false);
  refresh.resolve(renewed());
  assert.equal(await pending, false);
  logout.resolve({ ok: true });
  await leaving;
  assert.equal(api.cloud.session, null);
});

test('trocar de sessão durante leitura remota impede fusão e envio pela outra conta', async () => {
  let planned = 0;
  const { api, host } = account({ cloudReady: () => true, planSync: () => { planned++; } }, require('../src/sync-queue.js'));
  const response = deferred();
  let reading;
  const started = new Promise(resolve => { reading = resolve; });
  let calls = 0;
  host.fetch = () => { calls++; reading(); return response.promise; };
  const pending = api.sync();
  await started;
  api.writeSession({ user_id: 'two', email: 'two@example.invalid', access_token: 'b', refresh_token: 's' });
  response.resolve({ ok: true, json: async () => [] });
  await pending;
  assert.equal(planned, 0);
  assert.equal(calls, 1);
  assert.equal(api.cloud.lastSyncAt, null);
});

test('um 401 atrasado usa o token já renovado sem iniciar outra renovação', async () => {
  const { api, host } = account();
  const oldProfile = deferred();
  let renewals = 0;
  let reads = 0;
  host.fetch = (url, options) => {
    if (url.includes('/token?')) { renewals++; return Promise.resolve(renewed()); }
    reads++;
    if (reads === 1) return oldProfile.promise;
    assert.equal(options.headers.Authorization, 'Bearer new');
    return Promise.resolve({ ok: true, json: async () => ({ id: 'one' }) });
  };
  const loading = api.loadNickname();
  await api.refreshSession();
  oldProfile.resolve({ status: 401 });
  await loading;
  assert.equal(reads, 2);
  assert.equal(renewals, 1);
});

test('um envelope remoto futuro ou inválido não é sobrescrito como se a conta estivesse vazia', async () => {
  const Core = require('../src/core.js');
  const Queue = require('../src/sync-queue.js');
  for (const envelope of [{ schemaVersion: 99 }, { schemaVersion: 3 }]) {
    const { api, host } = account(Core, Queue);
    let uploads = 0;
    host.fetch = async (url, options = {}) => {
      if (options.method === 'POST') uploads += 1;
      return { ok: true, json: async () => [{ envelope }] };
    };
    await api.sync();
    assert.equal(uploads, 0);
    assert.equal(api.cloud.status.kind, 'error');
  }
});

test('apelido ausente ou inválido é um estado válido', () => {
  const { api } = account();
  for (const user of [null, {}, { user_metadata: { atlas_nickname: 12 } }]) assert.equal(api.nicknameOf(user), '');
});

test('a sessão é guardada e apagada na chave própria', () => {
  const { api, saved } = account();
  assert.equal(JSON.parse(saved.get(Account.SESSION_KEY)).user_id, 'one');
  api.writeSession(null);
  assert.equal(saved.has(Account.SESSION_KEY), false);
});

test('perfil pendente não permite salvar; falha permite recuperar a identidade', async () => {
  const { api, host } = account();
  api.writeSession({ access_token: 'a', refresh_token: 'r' });
  let reject;
  let calls = 0;
  host.fetch = () => { calls++; return new Promise((_, fail) => { reject = fail; }); };
  const pending = api.ensureCloudIdentity();
  assert.equal(api.cloud.identityPending, true);
  await api.saveNickname();
  assert.equal(calls, 1);
  reject(new Error('offline'));
  await assert.rejects(pending, /offline/);
  assert.equal(api.cloud.identityPending, false);
  assert.equal(api.cloud.session.user_id, undefined);
  host.fetch = async () => ({ ok: true, json: async () => ({ id: 'one', email: 'test@example.invalid' }) });
  assert.equal(await api.ensureCloudIdentity(), true);
  assert.equal(api.cloud.session.user_id, 'one');
});

test('resposta de identidade atrasada não restaura uma sessão encerrada', async () => {
  const { api, host } = account();
  api.writeSession({ access_token: 'a', refresh_token: 'r' });
  let finish;
  host.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = api.ensureCloudIdentity();
  api.writeSession(null);
  finish({ ok: true, json: async () => ({ id: 'one', email: 'test@example.invalid' }) });
  assert.equal(await pending, false);
  assert.equal(api.cloud.session, null);
  assert.equal(api.cloud.identityPending, false);
});

test('perfil incompleto ou malformado não confirma a conexão', async () => {
  const { api, host } = account();
  api.writeSession({ access_token: 'a', refresh_token: 'r' });
  for (const user of [null, {}, { id: 123, email: 'test@example.invalid' }, { id: 'one', email: '' }]) {
    host.fetch = async () => ({ ok: true, json: async () => user });
    assert.equal(await api.ensureCloudIdentity(), false);
    assert.equal(api.cloud.session.user_id, undefined);
    assert.equal(api.cloud.identityPending, false);
  }
});

test('salvar e remover apelido envia somente metadata e preserva a sessão', async () => {
  const { api, host } = account();
  const requests = [];
  host.fetch = async (url, options) => {
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
  const { api, host } = account();
  let calls = 0;
  host.fetch = async () => { calls++; throw new Error('offline'); };
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
  const { api, host } = account();
  let puts = 0;
  host.fetch = async (url, options) => {
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
  const { api, host } = account();
  let finish;
  host.fetch = async (_, options) => options.method === 'PUT'
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

test('a sincronização funde o progresso e devolve o resultado ao app', async () => {
  const Core = require('../src/core.js');
  const IDS = ['BR', 'JP'];
  const options = { countryIds: IDS };
  let local = Core.recordAnswer(Core.createProgress(), 'BR', 'cap', true, options);
  const remoto = Core.recordAnswer(Core.createProgress(), 'JP', 'flag', true, options);
  const saved = new Map();
  const uploads = [];
  const host = {
    localStorage: { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
    location: { protocol: 'https:', origin: 'https://example.invalid', pathname: '/', search: '', hash: '' },
    history: { replaceState() {} },
    fetch: async (url, opts = {}) => {
      if (url.includes('/rest/v1/') && opts.method === 'POST') { uploads.push(JSON.parse(opts.body)); return { ok: true }; }
      if (url.includes('/rest/v1/')) return { ok: true, json: async () => [{ envelope: JSON.parse(Core.serializeProgress(remoto, options)) }] };
      return { ok: true, json: async () => ({ id: 'one', email: 'test@example.invalid', user_metadata: {} }) };
    },
  };
  let delivered = 0;
  const SyncQueue = require('../src/sync-queue.js');
  const api = Account.create({
    Core, SyncQueue, config: { url: 'https://example.invalid', anonKey: 'public', tabela: 't' }, ids: IDS, host,
    el: () => { throw new Error('sem DOM'); },
    getProgress: () => local, setProgress: (next) => { local = next; }, onRemoteProgress: () => { delivered++; }, rerender() {},
  });
  api.writeSession({ user_id: 'one', email: 'test@example.invalid', access_token: 'a', refresh_token: 'r' });
  await api.sync();
  assert.equal(delivered, 1, 'O app precisa ser avisado quando a conta traz algo novo.');
  assert.ok(Core.levelOf(local, 'BR', 'cap') > 0 && Core.levelOf(local, 'JP', 'flag') > 0, 'Os dois lados precisam sobreviver à fusão.');
  assert.equal(uploads.length, 1, 'O servidor recebe o que só existia no aparelho.');
  assert.equal(api.cloud.status.kind, 'ok');
});
