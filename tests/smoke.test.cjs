'use strict';

// Teste de fumaça em navegador real.
//
// Os demais testes rodam em Node, sem DOM, e por isso nenhum deles percebe o
// pior defeito possível aqui: o artefato carregar e o app não iniciar. Foi o que
// aconteceu quando os hashes da CSP passaram a divergir do conteúdo — o HTML
// chegava inteiro, o navegador bloqueava os três scripts e a página ficava presa
// em "Carregando regiões…". Este teste abre o artefato num Chrome de verdade,
// pelo mesmo caminho de uma visita comum (HTTP), e confere que o Atlas iniciou.
//
// Sem dependências: o Chrome é controlado por CDP sobre o WebSocket nativo do
// Node. Se não houver Chrome instalado, o teste é pulado — a não ser que
// ATLAS_REQUIRE_BROWSER=1 (usado no CI, onde o navegador é garantido).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'atlas-195.html');
const REQUIRE_BROWSER = process.env.ATLAS_REQUIRE_BROWSER === '1';
const HEADLESS_TIMEOUT = 45_000;

function chromeCandidates() {
  if (process.env.CHROME_PATH) return [process.env.CHROME_PATH];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA];
    return roots.filter(Boolean).flatMap((root) => [
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
}

function findChrome() {
  for (const candidate of chromeCandidates()) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch (_) { /* próximo */ }
  }
  return null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(label, probe, { timeout = 20_000, interval = 150 } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await probe();
      if (last) return last;
    } catch (error) { last = error.message; }
    await delay(interval);
  }
  throw new Error(`Tempo esgotado esperando ${label}. Último estado: ${JSON.stringify(last)}`);
}

function serveArtifact(html) {
  const body = Buffer.from(html, 'utf8');
  const server = http.createServer((request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(body.length),
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// Cliente CDP mínimo: envia comandos numerados e acumula os eventos que
// interessam (violação de CSP chega como entrada de Log com source "security").
function connect(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    const events = [];
    let nextId = 0;

    socket.addEventListener('message', (message) => {
      const payload = JSON.parse(message.data);
      if (payload.id !== undefined) {
        const entry = pending.get(payload.id);
        if (!entry) return;
        pending.delete(payload.id);
        if (payload.error) entry.reject(new Error(`${payload.error.message} (${entry.method})`));
        else entry.resolve(payload.result);
        return;
      }
      events.push(payload);
    });
    socket.addEventListener('error', () => reject(new Error('Falha ao conectar no Chrome via CDP.')));
    socket.addEventListener('open', () => {
      resolve({
        events,
        close: () => socket.close(),
        send(method, params) {
          const id = ++nextId;
          return new Promise((ok, fail) => {
            pending.set(id, { resolve: ok, reject: fail, method });
            socket.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
      });
    });
  });
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Erro ao avaliar expressão.');
  }
  return result.result.value;
}

async function launchChrome(binary) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-smoke-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    '--window-size=1280,900',
    'about:blank',
  ];
  // O sandbox do Chrome costuma falhar em contêineres de CI; localmente fica ligado.
  if (process.env.CI) args.unshift('--no-sandbox', '--disable-dev-shm-usage');

  const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  const portFile = path.join(profile, 'DevToolsActivePort');
  const port = await until('o Chrome abrir a porta de depuração', () => {
    if (child.exitCode !== null) throw new Error(`Chrome encerrou (${child.exitCode}): ${stderr.slice(-400)}`);
    const raw = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    return raw ? Number(raw) : null;
  }, { timeout: 20_000 });

  const cleanup = () => {
    try { child.kill(); } catch (_) { /* já morreu */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) { /* melhor esforço */ }
  };
  return { port, cleanup };
}

async function openPage(port) {
  const targets = await until('a lista de alvos do Chrome', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const list = await response.json();
    return list.find((target) => target.type === 'page') || null;
  }, { timeout: 15_000 });
  return connect(targets.webSocketDebuggerUrl);
}

const chrome = findChrome();

test('o Atlas inicia num navegador real e responde a uma pergunta', { timeout: HEADLESS_TIMEOUT }, async (t) => {
  if (typeof WebSocket === 'undefined') {
    const aviso = 'WebSocket nativo indisponível; o teste de fumaça precisa de Node 22 ou superior.';
    if (REQUIRE_BROWSER) assert.fail(aviso);
    return t.skip(aviso);
  }
  if (!chrome) {
    const aviso = 'Chrome/Chromium não encontrado; defina CHROME_PATH para rodar o teste de fumaça.';
    if (REQUIRE_BROWSER) assert.fail(aviso);
    return t.skip(aviso);
  }

  const build = spawnSync(process.execPath, ['scripts/build.cjs'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  assert.equal(build.status, 0, `O build falhou antes do teste de fumaça.\n${build.stderr}`);

  const { server, port: httpPort } = await serveArtifact(fs.readFileSync(ARTIFACT, 'utf8'));
  const { port: debugPort, cleanup } = await launchChrome(chrome);
  let client;
  try {
    client = await openPage(debugPort);
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.enable');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/atlas-195.html` });

    // 1. Os scripts embutidos precisam executar. Com a CSP divergindo do
    //    conteúdo, o HTML chega inteiro e nada disso existe.
    const dados = await until('os dados do Atlas carregarem', async () => {
      const estado = await evaluate(client, `JSON.stringify({
        temDados: typeof DATA !== 'undefined',
        paises: typeof DATA !== 'undefined' ? DATA.length : 0,
        temNucleo: typeof AtlasCore !== 'undefined',
      })`);
      const parsed = estado && JSON.parse(estado);
      return parsed && parsed.temDados && parsed.temNucleo ? parsed : null;
    });
    assert.equal(dados.paises, 195, 'O artefato precisa expor os 195 países ao navegador.');

    // 2. A inicialização precisa terminar: o seletor sai do placeholder e o
    //    painel recebe a primeira pergunta.
    const iniciado = await until('a interface terminar de iniciar', async () => {
      const estado = await evaluate(client, `JSON.stringify({
        regioes: [...document.getElementById('regSel').options].map(o => o.textContent),
        painel: document.getElementById('panel').textContent.trim().length,
      })`);
      const parsed = estado && JSON.parse(estado);
      const pronto = parsed
        && parsed.regioes.length > 1
        && !parsed.regioes.some((texto) => texto.includes('Carregando'))
        && parsed.painel > 0;
      return pronto ? parsed : null;
    });
    assert.ok(iniciado.regioes.includes('Mundo inteiro'), 'O filtro de região não foi populado.');

    // 3. Interação de ponta a ponta. O modo é fixado em "Regiões" porque ele é
    //    o único sempre respondido por alternativa: no sorteio livre a pergunta
    //    pode cair em "Localização", que se responde clicando no mapa, e o teste
    //    passaria a depender de sorte.
    await evaluate(client, `document.querySelector('[data-mode="reg"]').click()`);
    const alternativas = await until('as alternativas da pergunta aparecerem', async () => {
      const total = await evaluate(client, `document.querySelectorAll('[data-answer]').length`);
      return total > 0 ? total : null;
    });
    assert.ok(alternativas >= 2, 'A pergunta de região precisa oferecer alternativas.');

    const veredito = await evaluate(client, `(() => {
      document.querySelector('[data-answer]').click();
      const texto = document.getElementById('panel').textContent;
      return /Correto|incorreta|Tempo esgotado/.test(texto) ? 'ok' : 'sem veredito';
    })()`);
    assert.equal(veredito, 'ok', 'Responder uma pergunta não produziu veredito.');

    // 3a. Acertar uma pergunta como "capital → país" precisa enquadrar o país no
    //     mapa. Antes, o mapa nunca era tocado nessas direções: um país pequeno
    //     (Maurício, San Marino...) ficava marcado em verde no zoom do mundo
    //     inteiro, invisível. Reseta para o mundo antes de cada rodada e mede o
    //     viewBox do SVG, sem depender de nenhuma variável interna do app.js.
    await evaluate(client, `document.querySelector('[data-mode="cap"]').click()`);
    let enquadrou = 0;
    const RODADAS_ENQUADRAMENTO = 5;
    for (let i = 0; i < RODADAS_ENQUADRAMENTO; i += 1) {
      await evaluate(client, `document.getElementById('zRst').click()`);
      const larguraMundo = await evaluate(client, `Number(document.getElementById('map').getAttribute('viewBox').split(/\\s+/)[2])`);
      assert.equal(larguraMundo, 1018, 'O botão de restaurar visão precisa voltar ao mundo inteiro.');

      await until('a pergunta de capitais oferecer alternativa', async () => (
        await evaluate(client, `document.querySelectorAll('[data-answer]').length > 0`)
      ));
      await evaluate(client, `document.querySelector('[data-answer]').click()`);
      await until('o veredito aparecer', async () => (
        await evaluate(client, `/Correto|incorreta/.test(document.getElementById('panel').textContent)`)
      ));

      const larguraDepois = await evaluate(client, `Number(document.getElementById('map').getAttribute('viewBox').split(/\\s+/)[2])`);
      if (larguraDepois < larguraMundo - 5) enquadrou += 1;
      await evaluate(client, `document.getElementById('nextQuestion')?.click()`);
    }
    assert.ok(
      enquadrou >= RODADAS_ENQUADRAMENTO - 1,
      `O mapa só enquadrou o país em ${enquadrou}/${RODADAS_ENQUADRAMENTO} respostas de capitais.`
    );

    // 3b. A prova precisa fechar a série e entregar a nota. É o único fluxo do
    //     app com fim definido, e quebrá-lo deixaria o usuário preso num
    //     contador que nunca chega ao resultado.
    await evaluate(client, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Progresso').click()`);
    await until('o botão de prova aparecer', async () => (
      await evaluate(client, `Boolean([...document.querySelectorAll('button')].find(b => b.textContent.trim() === '10 perguntas'))`)
    ));
    await evaluate(client, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '10 perguntas').click()`);

    const nota = await until('a prova terminar e mostrar a nota', async () => {
      const estado = await evaluate(client, `(() => {
        const painel = document.getElementById('panel').textContent;
        // A nota sai do título: no painel inteiro o "4 de 10" gruda no "40%".
        if (/Prova concluída/.test(painel)) {
          const titulo = document.getElementById('questionTitle');
          return 'fim:' + (titulo ? titulo.textContent.trim() : '(sem titulo)');
        }
        const alternativa = document.querySelector('[data-answer]');
        if (alternativa) alternativa.click();
        const proxima = document.getElementById('nextQuestion');
        if (proxima) proxima.click();
        return null;
      })()`);
      return estado;
    }, { timeout: 15_000, interval: 60 });
    assert.match(nota, /^fim:\d+ de 10$/, `A prova de 10 não fechou com nota sobre 10. Recebido: ${nota}`);

    // 3c. O botão de tema precisa trocar a pintura de verdade, não só o estado
    //     interno: é o navegador que resolve tokens, media query e atributo na
    //     raiz, e só aqui dá para ver a cor final.
    const estadoDoTema = async () => JSON.parse(await evaluate(client, `JSON.stringify({
      tema: document.documentElement.dataset.theme || 'auto',
      fundo: getComputedStyle(document.body).backgroundColor,
      rotulo: document.getElementById('themeToggle').getAttribute('aria-label'),
      salvo: JSON.parse(localStorage.getItem('atlas195:prefs:v2') || '{}').theme || 'auto'
    })`));
    const clicarTema = async () => evaluate(client, `document.getElementById('themeToggle').click()`);

    const inicial = await estadoDoTema();
    assert.equal(inicial.tema, 'auto', 'O tema começa no automático.');

    await clicarTema();
    const claro = await estadoDoTema();
    assert.equal(claro.tema, 'light', 'O primeiro clique precisa fixar o tema claro.');
    assert.equal(claro.salvo, 'light', 'A escolha de tema precisa ir para as preferências.');

    await clicarTema();
    // A cor pintada só re-resolve no quadro seguinte à troca do token, então a
    // leitura espera a mudança em vez de exigir que ela já tenha acontecido.
    const fundoEscuro = await until('o tema escuro pintar o fundo', async () => {
      const atual = await estadoDoTema();
      return atual.fundo !== claro.fundo ? atual.fundo : null;
    });
    const escuro = await estadoDoTema();
    assert.equal(escuro.tema, 'dark', 'O segundo clique precisa fixar o tema escuro.');
    assert.notEqual(fundoEscuro, claro.fundo, 'Claro e escuro pintaram o mesmo fundo.');

    await clicarTema();
    const voltou = await estadoDoTema();
    assert.equal(voltou.tema, 'auto', 'O terceiro clique precisa voltar para o automático.');
    [inicial, claro, escuro, voltou].forEach((passo) => {
      assert.match(
        passo.rotulo,
        /^Tema .+\. Ativar tema .+\.$/,
        'O rótulo do botão precisa dizer o estado atual e o próximo.'
      );
    });

    // 4. Nenhuma violação de CSP: é o sintoma exato do defeito que motivou o teste.
    const violacoes = client.events
      .filter((evento) => evento.method === 'Log.entryAdded')
      .map((evento) => evento.params.entry)
      .filter((entrada) => entrada.source === 'security' || /Content Security Policy/i.test(entrada.text || ''));
    assert.deepEqual(violacoes.map((entrada) => entrada.text), [], 'O navegador registrou violação de CSP.');
  } finally {
    if (client) client.close();
    cleanup();
    await new Promise((resolve) => server.close(resolve));
  }
});
