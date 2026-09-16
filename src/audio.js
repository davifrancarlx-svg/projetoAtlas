(function (root) {
  'use strict';
  const LEVELS = ['desligado', 'baixo', 'médio'];
  const VOLUME = [0, 0.12, 0.23];
  const PRIORITY = { error: 1, correct: 2, complete: 3 };
  const KEY = 'atlas195:som:v1';
  // Chave separada de propósito: o volume é preferência antiga e já gravada em
  // milhares de aparelhos. Guardar tudo junto exigiria migrar o que já funciona.
  const KEY_STYLE = 'atlas195:som:estilo:v1';

  // Pentatônica maior de dó. Qualquer par dela soa consonante, então dá para
  // variar a nota a cada acerto sem sair do tom e sem formar melodia — que é o
  // que cansa numa série de trinta perguntas. Os pares sobem por intervalos
  // diferentes (terça, quarta), o que dá variedade sem parecer escala.
  const PAIRS = [
    [523.25, 659.25], [587.33, 783.99], [659.25, 880],
    [783.99, 1046.5], [880, 1174.66],
  ];

  // Entre estilos muda só o timbre: as notas e os tempos são os mesmos, para
  // "acertei" e "errei" não trocarem de significado ao trocar de estilo.
  // `parciais` são os harmônicos e seus pesos; é deles que sai o caráter.
  const STYLES = [
    { id: 'sino', nome: 'Sino', tipo: 'sine', ataque: 0.006, cauda: 1, parciais: [[1, 0.62], [2, 0.07]] },
    { id: 'marimba', nome: 'Marimba', tipo: 'sine', ataque: 0.003, cauda: 0.62, parciais: [[1, 0.6], [2, 0.04], [4, 0.08]] },
    { id: 'corda', nome: 'Corda', tipo: 'triangle', ataque: 0.004, cauda: 0.9, parciais: [[1, 0.58], [2, 0.1], [3, 0.035]] },
    { id: 'sopro', nome: 'Sopro', tipo: 'sine', ataque: 0.05, cauda: 1.3, parciais: [[1, 0.55], [2, 0.05], [3, 0.02]] },
  ];
  const SCOPES = [['tudo', 'Acertos e erros'], ['erro', 'Só os erros']];

  function styleOf(id) {
    return STYLES.find((estilo) => estilo.id === id) || STYLES[0];
  }

  // Nada passa de meio segundo: som de resposta que dura mais atrapalha a
  // pergunta seguinte em vez de avisar a anterior.
  function sequence(kind, variant = 0) {
    // O erro cai uma terça menor, grave e curto. Cair é o gesto que a gente lê
    // como "não" sem precisar de aspereza: nenhum estilo usa serra ou quadrada.
    if (kind === 'error') return [[196, 0, 0.14], [164.81, 0.075, 0.2]];
    // Fim de série: tônica, quinta e oitava. Resolve, e por isso soa como
    // fechamento — toca uma vez por série, nunca numa resposta.
    if (kind === 'complete') return [[523.25, 0, 0.16], [783.99, 0.085, 0.18], [1046.5, 0.17, 0.3]];
    const par = PAIRS[variant % PAIRS.length];
    return [[par[0], 0, 0.15], [par[1], 0.07, 0.19]];
  }

  // A mesma síntese serve para reprodução e amostras com OfflineAudioContext.
  function render(context, destination, kind, volume, options) {
    options = options || {};
    const estilo = styleOf(options.estilo);
    const start = options.start === undefined ? context.currentTime : options.start;
    // O fim de série tem três notas somadas; sem esta folga o pico passa do
    // que as outras duas atingem e ele soa mais alto que o resto.
    const nivel = kind === 'complete' ? volume * 0.8 : volume;
    const voices = [];
    for (const [frequency, offset, duration] of sequence(kind, options.variant || 0)) {
      // Cauda própria de cada estilo: a marimba é seca, o sopro se dissolve.
      const fim = Math.max(duration * estilo.cauda, estilo.ataque + 0.03);
      for (const [harmonic, strength] of estilo.parciais) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = start + offset;
        oscillator.type = estilo.tipo;
        oscillator.frequency.value = frequency * harmonic;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(nivel * strength, at + estilo.ataque);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + fim);
        oscillator.connect(gain); gain.connect(destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(at); oscillator.stop(at + fim + 0.01);
        voices.push({ stop() {
          gain.gain.cancelAndHoldAtTime(context.currentTime);
          gain.gain.linearRampToValueAtTime(0.0001, context.currentTime + 0.012);
          oscillator.stop(context.currentTime + 0.013);
        } });
      }
    }
    return voices;
  }

  function create(host = root) {
    const doc = host.document;
    const button = doc.getElementById('soundToggle');
    const Constructor = host.AudioContext || host.webkitAudioContext;
    let level = 0, context, voices = [], pending, timer, variant = 0, revision = 0;
    let pref = { estilo: STYLES[0].id, escopo: 'tudo' };
    let campos = null;
    try {
      const stored = JSON.parse(host.localStorage.getItem(KEY));
      if (Number.isInteger(stored) && stored >= 0 && stored < 3) level = stored;
    } catch (_) { /* preferência inválida ou armazenamento indisponível */ }
    try {
      const salvo = JSON.parse(host.localStorage.getItem(KEY_STYLE));
      if (salvo && STYLES.some((estilo) => estilo.id === salvo.estilo)) pref.estilo = salvo.estilo;
      if (salvo && SCOPES.some((escopo) => escopo[0] === salvo.escopo)) pref.escopo = salvo.escopo;
    } catch (_) { /* idem: preferência ruim vira a padrão, nunca um erro */ }
    function savePref() {
      try { host.localStorage.setItem(KEY_STYLE, JSON.stringify(pref)); } catch (_) { /* só nesta abertura */ }
    }
    function updateButton() {
      if (button) {
        button.textContent = `Som: ${Constructor ? LEVELS[level] : 'indisponível'}`;
        button.disabled = !Constructor;
        button.setAttribute('aria-label', `Som ${LEVELS[level]}. Ativar som ${LEVELS[(level + 1) % 3]}.`);
      }
      // O painel e o botão do topo ficam visíveis ao mesmo tempo na aba
      // Progresso: mexer num tem de aparecer no outro na hora.
      if (!campos) return;
      campos.volume.value = String(level);
      campos.nota.textContent = level
        ? 'Trocar de estilo toca uma amostra.'
        : 'O som está desligado: escolha um volume para ouvir as amostras.';
    }
    function stop() {
      revision++;
      host.clearTimeout(timer); timer = null; pending = null;
      for (const voice of voices) { try { voice.stop(); } catch (_) { /* já terminou */ } }
      voices = [];
    }
    async function unlock() {
      if (!level || !Constructor || doc.hidden) return false;
      try {
        context ||= new Constructor();
        if (context.state === 'suspended') await context.resume();
        return context.state === 'running';
      } catch (_) { return false; }
    }
    function play(kind) {
      if (!level || doc.hidden || !PRIORITY[kind]) return;
      // Quem escolheu "só os erros" continua ouvindo o fim de série: ele toca
      // uma vez por série e é justamente o aviso que não dá para ver sozinho.
      if (kind === 'correct' && pref.escopo === 'erro') return;
      if (!pending || PRIORITY[kind] > PRIORITY[pending]) pending = kind;
      if (timer != null) return;
      const ticket = revision;
      timer = host.setTimeout(async () => {
        const sound = pending; pending = null; timer = null;
        if (!context) return; // aguarda um gesto; não acumula avisos de autoplay bloqueado
        if (!await unlock() || ticket !== revision || !level || doc.hidden) return;
        stop();
        try {
          voices = render(context, context.destination, sound, VOLUME[level],
            { variant: variant++ % PAIRS.length, estilo: pref.estilo });
        } catch (_) { /* áudio nunca impede uma resposta */ }
      }, 0);
    }
    // Amostra do que a pessoa vai ouvir de verdade: se ela desligou os acertos,
    // ouvir o acerto ao escolher o estilo seria propaganda enganosa.
    function sample() { void unlock(); play(pref.escopo === 'erro' ? 'error' : 'correct'); }
    function setLevel(novo) {
      stop(); level = ((novo % 3) + 3) % 3;
      try { host.localStorage.setItem(KEY, JSON.stringify(level)); } catch (_) { /* só nesta abertura */ }
      updateButton();
      if (level) sample();
      else if (context?.state === 'running') void context.suspend().catch(() => {});
    }
    function seletor(linha, id, rotulo, opcoes, valor) {
      const label = doc.createElement('label');
      label.htmlFor = id; label.textContent = rotulo;
      const select = doc.createElement('select');
      select.id = id; select.disabled = !Constructor;
      for (const [value, texto] of opcoes) {
        const option = doc.createElement('option');
        option.value = value; option.textContent = texto;
        select.append(option);
      }
      select.value = valor;
      linha.append(label, select);
      return select;
    }
    function panel(container) {
      if (!container) return;
      const section = doc.createElement('section');
      section.className = 'pgroup';
      const titulo = doc.createElement('h3');
      titulo.id = 'somTitle'; titulo.textContent = 'Som';
      section.setAttribute('aria-labelledby', 'somTitle');
      const linha = doc.createElement('div');
      linha.className = 'button-row';
      const volume = seletor(linha, 'somVolume', 'Volume', LEVELS.map((nome, i) => [String(i), nome]), String(level));
      const estilo = seletor(linha, 'somEstilo', 'Estilo', STYLES.map((item) => [item.id, item.nome]), pref.estilo);
      const escopo = seletor(linha, 'somEscopo', 'Tocar em', SCOPES, pref.escopo);
      const nota = doc.createElement('p');
      nota.className = 'section-copy study-summary';
      volume.addEventListener('change', () => setLevel(Number(volume.value)));
      estilo.addEventListener('change', () => { pref.estilo = estilo.value; savePref(); sample(); });
      escopo.addEventListener('change', () => { pref.escopo = escopo.value; savePref(); sample(); });
      section.append(titulo, linha, nota);
      container.append(section);
      campos = { volume, nota };
      updateButton();
    }
    button?.addEventListener('click', () => setLevel(level + 1));
    doc.addEventListener('pointerdown', () => { void unlock(); }, { passive: true });
    doc.addEventListener('keydown', () => { void unlock(); });
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) {
        stop();
        if (context?.state === 'running') void context.suspend().catch(() => {});
      }
    });
    updateButton();
    return { play, stop, panel };
  }
  const api = { create, render, sequence, STYLES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
