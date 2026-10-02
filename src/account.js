(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Conta (opcional)
   *
   * O aparelho continua sendo o dono do progresso: a conta é uma cópia que
   * sincroniza. Tudo aqui falha em silêncio — sem rede, sem conta ou com o
   * servidor fora do ar, o treino segue exatamente como antes.
   *
   * O módulo não conhece o app: recebe por `deps` o que precisa (núcleo,
   * fila, configuração, leitura/escrita do progresso e o fabricante de
   * elementos) e devolve uma API pequena. Fica fora de app.js para ser
   * testado sem DOM e para o app principal não crescer sem fim.
   * ------------------------------------------------------------------ */

  const SESSION_KEY = 'atlas195:conta:v1';

  function create(deps) {
    const { Core, SyncQueue, config, ids } = deps;
    const host = deps.host || root;
    const el = deps.el;
    const getProgress = deps.getProgress || (() => null);
    const setProgress = deps.setProgress || (() => {});
    const onRemoteProgress = deps.onRemoteProgress || (() => {});
    const rerender = deps.rerender || (() => {});
    const options = { countryIds: ids };
    let sessionRevision = 0;
    let refreshing = null;

    const cloud = { session: null, status: null, lastSyncAt: null, queue: null, requestingLink: false,
      emailDraft: '', identityPending: false,
      nicknameDraft: null, nicknameStatus: null, savingNickname: false, nicknameRevision: 0 };

    function nicknameOf(user) {
      const value = user && user.user_metadata && user.user_metadata.atlas_nickname;
      return typeof value === 'string' && Array.from(value).length <= 40 ? value.trim() : '';
    }

    async function loadNickname() {
      const sessionVersion = sessionRevision;
      const session = cloud.session;
      const revision = cloud.nicknameRevision;
      if (!session || cloud.savingNickname) return;
      try {
        const response = await cloudRequest('/auth/v1/user');
        if (!response.ok) throw new Error('perfil indisponível');
        const user = await response.json();
        if (sessionVersion !== sessionRevision || !cloud.session || user.id !== cloud.session.user_id || session.user_id !== user.id
          || revision !== cloud.nicknameRevision) return;
        writeSession({ ...cloud.session, nickname: nicknameOf(user) }, true);
        cloud.nicknameStatus = null;
      } catch (_) {
        if (sessionVersion !== sessionRevision || revision !== cloud.nicknameRevision || !cloud.session || session.user_id !== cloud.session.user_id) return;
        cloud.nicknameStatus = { text: 'Não foi possível atualizar o apelido agora.', kind: 'error' };
      }
      rerender();
    }

    async function saveNickname() {
      if (!cloud.session?.user_id || cloud.savingNickname) return;
      const sessionVersion = sessionRevision;
      const value = (cloud.nicknameDraft ?? cloud.session.nickname ?? '').trim();
      if (Array.from(value).length > 40 || /[\u0000-\u001f\u007f]/u.test(value)) {
        cloud.nicknameStatus = { text: 'Use até 40 caracteres, sem quebras de linha ou caracteres de controle.', kind: 'error' };
        rerender();
        return;
      }
      const userId = cloud.session.user_id;
      cloud.nicknameRevision += 1;
      cloud.savingNickname = true;
      cloud.nicknameStatus = { text: 'Salvando apelido…' };
      rerender();
      try {
        const response = await cloudRequest('/auth/v1/user', {
          method: 'PUT', body: JSON.stringify({ data: { atlas_nickname: value || null } }),
        });
        if (!response.ok) throw new Error('gravação indisponível');
        const user = await response.json();
        if (sessionVersion !== sessionRevision || !cloud.session || cloud.session.user_id !== userId || user.id !== userId) return;
        writeSession({ ...cloud.session, nickname: nicknameOf(user) }, true);
        cloud.nicknameDraft = null;
        cloud.nicknameStatus = { text: value ? 'Apelido salvo.' : 'Apelido removido.', kind: 'ok' };
      } catch (_) {
        if (sessionVersion === sessionRevision && cloud.session && cloud.session.user_id === userId) {
          cloud.nicknameStatus = { text: 'Não foi possível salvar o apelido. Seu texto foi mantido; tente novamente.', kind: 'error' };
        }
      } finally {
        if (sessionVersion === sessionRevision) cloud.savingNickname = false;
        rerender();
      }
    }

    function enabled() {
      return Core.cloudReady(config, host.location && host.location.protocol);
    }

    function readSession() {
      try {
        const parsed = JSON.parse(host.localStorage.getItem(SESSION_KEY) || 'null');
        if (!parsed || typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') return null;
        return parsed;
      } catch (_) { return null; }
    }

    function writeSession(session, continuation = false) {
      if (!continuation) {
        sessionRevision += 1;
        refreshing = null;
        cloud.savingNickname = false;
        cloud.identityPending = false;
      }
      cloud.session = session;
      try {
        if (session) host.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        else host.localStorage.removeItem(SESSION_KEY);
      } catch (_) { /* modo privado: a sessão vale só enquanto a aba viver */ }
    }

    function setStatus(text, kind = '') {
      cloud.status = text ? { text, kind } : null;
      rerender();
    }

    async function cloudFetch(path, options = {}) {
      return host.fetch(`${config.url}${path}`, {
        ...options,
        headers: {
          apikey: config.anonKey,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          ...(cloud.session ? { Authorization: `Bearer ${cloud.session.access_token}` } : {}),
        },
      });
    }

    // O token de acesso expira; o de renovação vale muito mais. Uma resposta 401
    // dispara uma única tentativa de renovar antes de considerar a sessão perdida.
    async function refreshSession() {
      if (!cloud.session || !cloud.session.refresh_token) return false;
      if (refreshing) return refreshing;
      const session = cloud.session;
      const revision = sessionRevision;
      const pending = (async () => {
        const resposta = await host.fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        if (revision !== sessionRevision) return false;
        if (!resposta.ok) {
          // Indisponibilidade e limite de pedidos não invalidam a conta.
          if (resposta.status === 400 || resposta.status === 401) writeSession(null);
          return false;
        }
        const dados = await resposta.json();
        if (revision !== sessionRevision) return false;
        if (!dados.access_token || !dados.refresh_token
          || (session.user_id && dados.user?.id && dados.user.id !== session.user_id)) return false;
        writeSession({
          access_token: dados.access_token,
          refresh_token: dados.refresh_token,
          email: (dados.user && dados.user.email) || session.email,
          user_id: (dados.user && dados.user.id) || session.user_id,
          nickname: dados.user ? nicknameOf(dados.user) : cloud.session.nickname,
        }, true);
        return true;
      })();
      refreshing = pending;
      try { return await pending; }
      finally { if (refreshing === pending) refreshing = null; }
    }

    async function cloudRequest(path, options = {}) {
      const revision = sessionRevision;
      const token = cloud.session?.access_token;
      let resposta = await cloudFetch(path, options);
      if (revision !== sessionRevision) throw new Error('sessão alterada');
      if (resposta.status === 401) {
        const renewed = token !== cloud.session?.access_token || await refreshSession();
        if (revision !== sessionRevision) throw new Error('sessão alterada');
        if (renewed) resposta = await cloudFetch(path, options);
      }
      if (revision !== sessionRevision) throw new Error('sessão alterada');
      return resposta;
    }

    async function requestMagicLink(email) {
      const destino = `${host.location.origin}${host.location.pathname}`;
      const resposta = await host.fetch(
        `${config.url}/auth/v1/otp?redirect_to=${encodeURIComponent(destino)}`,
        {
          method: 'POST',
          headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, create_user: true }),
        },
      );
      if (resposta.ok) return { ok: true };
      let motivo = '';
      try { const erro = await resposta.json(); motivo = erro.msg || erro.error_description || erro.message || ''; } catch (_) { /* corpo vazio */ }
      // O plano em uso limita os e-mails de autenticação por hora; dizer isso é
      // mais útil do que "erro 429".
      if (resposta.status === 429) return { ok: false, motivo: 'Muitos pedidos de link em pouco tempo. Tente de novo daqui a alguns minutos.' };
      return { ok: false, motivo: motivo || 'Não foi possível enviar o link agora.' };
    }

    async function ensureCloudIdentity() {
      if (!cloud.session) return false;
      if (cloud.session.user_id && cloud.session.email) return true;
      const revision = cloud.nicknameRevision;
      const sessionVersion = sessionRevision;
      cloud.identityPending = true;
      rerender();
      try {
        const perfil = await cloudRequest('/auth/v1/user');
        if (!perfil.ok) return false;
        const usuario = await perfil.json();
        if (sessionVersion !== sessionRevision || !cloud.session || revision !== cloud.nicknameRevision
          || typeof usuario?.id !== 'string' || !usuario.id
          || typeof usuario.email !== 'string' || !usuario.email) return false;
        writeSession({ ...cloud.session, email: usuario.email, user_id: usuario.id, nickname: nicknameOf(usuario) }, true);
        return true;
      } catch (error) {
        if (sessionVersion !== sessionRevision) return false;
        throw error;
      } finally {
        if (sessionVersion === sessionRevision) cloud.identityPending = false;
        rerender();
      }
    }

    // O link do e-mail volta para o app com os tokens no fragmento da URL. Ele é
    // lido, guardado e apagado da barra de endereços, para o token não ficar no
    // histórico nem ser compartilhado sem querer num "copiar link".
    async function consumeAuthCallback() {
      const hash = host.location.hash || '';
      const bruto = hash.startsWith('#') ? hash.slice(1) : '';
      if (!bruto) return false;
      const parametros = new URLSearchParams(bruto);
      const acesso = parametros.get('access_token');
      const renovacao = parametros.get('refresh_token');
      const erro = parametros.get('error_description') || parametros.get('error');
      if (!acesso && !erro) return false;
      host.history.replaceState(null, '', `${host.location.pathname}${host.location.search}`);
      if (erro) {
        setStatus(`O link de acesso não valeu: ${erro}`, 'error');
        return false;
      }
      writeSession({ access_token: acesso, refresh_token: renovacao, email: null, user_id: null });
      await ensureCloudIdentity();
      return true;
    }

    async function pullRemoteProgress() {
      if (!cloud.session || !cloud.session.user_id) return null;
      const caminho = `/rest/v1/${config.tabela}?usuario=eq.${encodeURIComponent(cloud.session.user_id)}&select=envelope`;
      const resposta = await cloudRequest(caminho, { headers: { Accept: 'application/json' } });
      if (!resposta.ok) throw new Error(`leitura falhou (${resposta.status})`);
      const linhas = await resposta.json();
      if (!Array.isArray(linhas) || !linhas.length) return null;
      const decoded = Core.deserializeProgress(JSON.stringify(linhas[0].envelope), options);
      // Um envelope futuro ou inválido não equivale a uma conta vazia: nesse
      // caso, enviar o progresso local poderia apagar dados que não entendemos.
      if (decoded.recovered) throw new Error('Atualize o Atlas ou confira o backup da conta antes de sincronizar.');
      return decoded.progress;
    }

    async function pushRemoteProgress(envelope) {
      const resposta = await cloudRequest(`/rest/v1/${config.tabela}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          usuario: cloud.session.user_id,
          envelope: JSON.parse(envelope),
          atualizado_em: new Date().toISOString(),
        }),
      });
      if (!resposta.ok) throw new Error(`gravação falhou (${resposta.status})`);
    }

    async function syncOnce({ silencioso = false } = {}) {
      if (!enabled() || !cloud.session) return;
      const revision = sessionRevision;
      if (!silencioso) setStatus('Sincronizando…');
      try {
        if (!await ensureCloudIdentity()) throw new Error('identidade da conta indisponível');
        if (revision !== sessionRevision) return;
        const remoto = await pullRemoteProgress();
        if (revision !== sessionRevision) return;
        const plano = Core.planSync(getProgress(), remoto, options);
        if (plano.download) {
          setProgress(plano.merged);
          onRemoteProgress();
        }
        if (plano.upload) await pushRemoteProgress(Core.serializeProgress(plano.merged, options));
        if (revision !== sessionRevision) return;
        cloud.lastSyncAt = new Date();
        setStatus(plano.unchanged ? 'Tudo sincronizado.' : 'Progresso sincronizado com a conta.', 'ok');
      } catch (erro) {
        if (revision !== sessionRevision) return;
        // Falha de rede não pode virar obstáculo: o progresso local continua
        // salvo e a próxima tentativa acontece na próxima mudança.
        setStatus('Sem sincronizar agora. O progresso continua salvo neste aparelho.', 'error');
      }
    }

    function queue() {
      if (!cloud.queue) {
        cloud.queue = SyncQueue.create({ task: () => syncOnce({ silencioso: true }), delay: 6000 });
      }
      return cloud.queue;
    }

    function sync({ silencioso = false } = {}) {
      if (!enabled() || !cloud.session) return Promise.resolve(false);
      if (!silencioso) setStatus('Sincronizando…');
      return queue().run();
    }

    function schedule() {
      if (!enabled() || !cloud.session) return;
      queue().schedule();
    }

    async function signOut() {
      if (cloud.queue) cloud.queue.cancel();
      // Captura o token antes de limpar; nenhuma resposta pode reabrir a conta.
      const logout = cloud.session ? cloudFetch('/auth/v1/logout', { method: 'POST' }).catch(() => {}) : null;
      writeSession(null);
      cloud.nicknameDraft = null;
      cloud.nicknameStatus = null;
      cloud.nicknameRevision += 1;
      cloud.lastSyncAt = null;
      setStatus('Você saiu da conta. O progresso continua neste aparelho.', 'ok');
      await logout;
    }

    async function initialize() {
      if (!enabled()) return;
      try {
        writeSession(readSession());
        const entrou = await consumeAuthCallback();
        if (cloud.session) {
          if (!await ensureCloudIdentity()) throw new Error('perfil da conta indisponível');
          if (entrou) setStatus('Conta conectada. Juntando o progresso…', 'ok');
          if (!entrou) void loadNickname();
          await sync({ silencioso: !entrou });
        }
      } catch (_) {
        setStatus('Não foi possível concluir a conexão agora. O treino continua salvo neste aparelho.', 'error');
      }
    }

    function render(container) {
      if (!enabled()) return;
      const card = el('section', { className: 'source-card', attrs: { 'aria-labelledby': 'contaTitle' } });
      card.append(el('h3', { id: 'contaTitle', text: 'Conta (opcional)' }));

      if (!cloud.session) {
        card.append(el('p', {
          text: 'Entrar é opcional e serve só para levar o progresso a outro aparelho. '
            + 'Sem conta, nada sai daqui. Com conta, são enviados ao Supabase o seu e-mail, o apelido opcional e o seu progresso '
            + '— países, níveis, datas de revisão, recorde, tempo de estudo e confusões entre países. Nunca há anúncio, rastreio ou venda de dados.',
        }));
        const linha = el('div', { className: 'button-row' });
        const email = el('input', {
          id: 'contaEmail', className: 'search', attrs: {
            type: 'email', autocomplete: 'email', placeholder: 'seu@email.com',
            'aria-label': 'E-mail para receber o link de acesso',
          },
        });
        const entrar = el('button', {
          id: 'pedirLink', className: 'btn', type: 'button', text: 'Receber link de acesso',
          attrs: { 'aria-disabled': cloud.requestingLink ? 'true' : null },
        });
        email.value = cloud.emailDraft;
        email.addEventListener('input', () => { cloud.emailDraft = email.value; });
        const pedir = async () => {
          if (cloud.requestingLink) return;
          const valor = email.value.trim();
          cloud.emailDraft = email.value;
          if (!valor || !valor.includes('@')) {
            setStatus('Digite um e-mail válido para receber o link.', 'error');
            return;
          }
          cloud.requestingLink = true;
          setStatus('Enviando o link…');
          let resultadoStatus;
          try {
            const resultado = await requestMagicLink(valor);
            resultadoStatus = resultado.ok
              ? { text: `Link enviado para ${valor}. Abra o e-mail neste aparelho e clique no link.`, kind: 'ok' }
              : { text: resultado.motivo, kind: 'error' };
          } catch (_) {
            resultadoStatus = { text: 'Sem conexão para enviar o link agora. Tente novamente quando a rede voltar.', kind: 'error' };
          } finally {
            cloud.requestingLink = false;
            setStatus(resultadoStatus.text, resultadoStatus.kind);
          }
        };
        entrar.addEventListener('click', pedir);
        email.addEventListener('keydown', (evento) => { if (evento.key === 'Enter') { evento.preventDefault(); pedir(); } });
        linha.append(email, entrar);
        card.append(linha);
        card.append(el('p', {
          className: 'source-note',
          text: 'Sem senha: você recebe um link por e-mail e entra clicando nele.',
        }));
      } else if (!cloud.session.user_id || !cloud.session.email) {
        card.append(el('p', { text: cloud.identityPending
          ? 'Confirmando sua conexão… O treino continua disponível.'
          : 'A conexão ainda não foi confirmada. Tente novamente para acessar sua conta.' }));
        const retry = el('button', { id: 'retomarConta', className: 'btn ghost', type: 'button',
          text: 'Tentar novamente', attrs: { 'aria-disabled': cloud.identityPending ? 'true' : null } });
        retry.addEventListener('click', () => { if (!cloud.identityPending) void sync(); });
        const leave = el('button', { className: 'btn ghost', type: 'button', text: 'Sair da conta' });
        leave.addEventListener('click', signOut);
        card.append(retry, leave);
      } else {
        card.append(el('p', {
          text: `Conectado como ${cloud.session.email || 'sua conta'}. O progresso deste aparelho e o da conta são fundidos, nunca substituídos.`,
        }));
        const nicknameRow = el('form', { className: 'account-nickname' });
        const nickname = el('input', { id: 'contaApelido', className: 'search', attrs: {
          type: 'text', autocomplete: 'nickname', 'aria-describedby': 'apelidoAjuda',
          readonly: cloud.savingNickname ? '' : null,
        } });
        nickname.value = cloud.nicknameDraft ?? cloud.session.nickname ?? '';
        nickname.addEventListener('input', () => { cloud.nicknameDraft = nickname.value; });
        nicknameRow.append(el('label', { text: 'Apelido (opcional)', attrs: { for: 'contaApelido' } }), nickname,
          el('button', { id: 'salvarApelido', className: 'btn ghost', type: 'submit', text: 'Salvar apelido',
            attrs: { 'aria-disabled': cloud.savingNickname ? 'true' : null } }));
        nicknameRow.addEventListener('submit', (event) => { event.preventDefault(); void saveNickname(); });
        card.append(nicknameRow, el('p', { id: 'apelidoAjuda', className: 'source-note',
          text: 'Até 40 caracteres. Ao salvar, o apelido é enviado ao Supabase para aparecer nos seus aparelhos. Para removê-lo, apague o texto e salve. É necessário estar online para salvar.' }));
        if (cloud.nicknameStatus) card.append(el('p', {
          className: `note${cloud.nicknameStatus.kind === 'error' ? ' note-error' : ''}`,
          text: cloud.nicknameStatus.text, attrs: { role: 'status' },
        }));
        if (cloud.lastSyncAt) {
          card.append(el('p', {
            className: 'source-note',
            text: `Última sincronização às ${cloud.lastSyncAt.toLocaleTimeString('pt-BR')}.`,
          }));
        }
        const linha = el('div', { className: 'button-row' });
        const sincronizar = el('button', { className: 'btn ghost', type: 'button', text: 'Sincronizar agora' });
        sincronizar.addEventListener('click', () => { void loadNickname(); void sync(); });
        const sair = el('button', { className: 'btn ghost', type: 'button', text: 'Sair da conta' });
        sair.addEventListener('click', signOut);
        linha.append(sincronizar, sair);
        card.append(linha);
      }

      if (cloud.status) {
        card.append(el('p', {
          className: `note${cloud.status.kind === 'error' ? ' note-error' : ''}`,
          text: cloud.status.text, attrs: { role: 'status' },
        }));
      }
      container.append(card);
    }

    return Object.freeze({
      enabled, initialize, render, sync, schedule, signOut,
      // Expostos para os testes exercitarem os estados de rede sem DOM.
      cloud, nicknameOf, writeSession, saveNickname, loadNickname, refreshSession, ensureCloudIdentity,
    });
  }

  const api = { create, SESSION_KEY };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasAccount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
