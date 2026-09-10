(function (root) {
  'use strict';
  const LEVELS = ['desligado', 'baixo', 'médio'];
  const VOLUME = [0, 0.12, 0.23];
  const PRIORITY = { error: 1, correct: 2, achievement: 3 };
  const KEY = 'atlas195:som:v1';

  function sequence(kind, variant = 0) {
    if (kind === 'error') return [[196, 0, 0.12]];
    if (kind === 'achievement') return [[523.25, 0, 0.20], [659.25, 0.09, 0.20], [783.99, 0.18, 0.25]];
    const base = [523.25, 587.33, 659.25][variant % 3];
    return [[base, 0, 0.15], [base * 1.259921, 0.07, 0.19]];
  }

  // A mesma síntese serve para reprodução e amostras com OfflineAudioContext.
  function render(context, destination, kind, volume, variant = 0, start = context.currentTime) {
    const voices = [];
    for (const [frequency, offset, duration] of sequence(kind, variant)) {
      for (const [harmonic, strength] of [[1, 0.62], [2, 0.07]]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = start + offset;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * harmonic;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(volume * strength, at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        oscillator.connect(gain); gain.connect(destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(at); oscillator.stop(at + duration + 0.01);
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
    try {
      const stored = JSON.parse(host.localStorage.getItem(KEY));
      if (Number.isInteger(stored) && stored >= 0 && stored < 3) level = stored;
    } catch (_) { /* preferência inválida ou armazenamento indisponível */ }
    function updateButton() {
      if (!button) return;
      button.textContent = `Som: ${Constructor ? LEVELS[level] : 'indisponível'}`;
      button.disabled = !Constructor;
      button.setAttribute('aria-label', `Som ${LEVELS[level]}. Ativar som ${LEVELS[(level + 1) % 3]}.`);
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
      if (!pending || PRIORITY[kind] > PRIORITY[pending]) pending = kind;
      if (timer != null) return;
      const ticket = revision;
      timer = host.setTimeout(async () => {
        const sound = pending; pending = null; timer = null;
        if (!context) return; // aguarda um gesto; não acumula avisos de autoplay bloqueado
        if (!await unlock() || ticket !== revision || !level || doc.hidden) return;
        stop();
        try { voices = render(context, context.destination, sound, VOLUME[level], variant++ % 3); }
        catch (_) { /* áudio nunca impede uma resposta */ }
      }, 0);
    }
    function changeLevel() {
      stop(); level = (level + 1) % 3;
      try { host.localStorage.setItem(KEY, JSON.stringify(level)); } catch (_) { /* só nesta abertura */ }
      updateButton();
      if (level) { void unlock(); play('correct'); }
      else if (context?.state === 'running') void context.suspend().catch(() => {});
    }
    button?.addEventListener('click', changeLevel);
    doc.addEventListener('pointerdown', () => { void unlock(); }, { passive: true });
    doc.addEventListener('keydown', () => { void unlock(); });
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) {
        stop();
        if (context?.state === 'running') void context.suspend().catch(() => {});
      }
    });
    updateButton();
    return { play, stop };
  }
  const api = { create, render, sequence };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
