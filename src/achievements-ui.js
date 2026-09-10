(function (root) {
  'use strict';
  root.AtlasAchievementsUI = { create({ Core, countries, getProgress, request, connected, schedule, changed = () => {}, unlocked = () => {} }) {
    const KEY = 'atlas195:conquistas:v1';
    let saved = null;
    let typedStreak = 0;
    let themes = 0;
    let status = '';
    let timer;
    const notices = [];
    const element = (tag, text, className) => {
      const node = document.createElement(tag);
      if (text) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    function read() {
      try {
        const value = JSON.parse(localStorage.getItem(KEY));
        return Core.validateAchievements(value) ? value : null;
      } catch (_) { return null; }
    }
    function align() {
      const blank = Core.createAchievements(getProgress());
      if (!saved || saved.generation !== blank.generation || saved.epoch !== blank.epoch) {
        saved = blank; typedStreak = 0; themes = 0;
        notices.length = 0;
        clearTimeout(timer); timer = null;
        document.getElementById('achievementNotice')?.remove();
      }
      const stored = read();
      if (stored && stored.generation === blank.generation && stored.epoch === blank.epoch) saved = Core.mergeAchievements(saved, stored);
    }
    function persist() {
      const stored = read();
      if (stored && (stored.generation > saved.generation || (stored.generation === saved.generation && stored.epoch > saved.epoch))) return;
      try { localStorage.setItem(KEY, JSON.stringify(saved)); }
      catch (_) { status = 'Não foi possível salvar as conquistas neste navegador.'; }
      const note = document.getElementById('achievementStatus');
      if (note) note.textContent = status;
    }
    function showNext() {
      document.getElementById('achievementNotice')?.remove();
      timer = null;
      if (!notices.length) return;
      const id = notices.shift();
      const item = Core.achievementCatalog.find(c => c.id === id);
      const notice = element('div', '', 'achievement-notice');
      notice.id = 'achievementNotice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.append(element('strong', `◆ ${item.name}`), element('span', `${item.rarity} · Conquista desbloqueada. Pode comemorar sem perder a próxima!`));
      document.querySelector('.app-status')?.append(notice);
      timer = setTimeout(showNext, 6000);
    }
    function record(event = {}, silent = false) {
      align();
      const now = new Date();
      const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      if (event.type === 'answer') typedStreak = event.correct && event.typed ? typedStreak + 1 : 0;
      if (event.type === 'theme') themes++;
      const result = Core.evaluateAchievements(saved, getProgress(), countries, { ...event, now: now.getTime(), date, typedStreak, count: themes });
      saved = result.state;
      persist();
      if (!silent) {
        if (result.added.length) unlocked();
        notices.push(...result.added);
        if (!timer) showNext();
      }
      if (result.added.length) schedule();
      return saved;
    }
    function render(container) {
      record({}, true);
      const section = element('section', '', 'source-card achievements');
      section.setAttribute('aria-labelledby', 'achievementsTitle');
      const title = element('h3', `Conquistas · ${saved.unlocked.length} de ${Core.achievementCatalog.length}`);
      title.id = 'achievementsTitle';
      section.append(title, element('p', '◆ Desbloqueada · ◇ Ainda não desbloqueada. Dominar significa atingir o nível máximo.'));
      const details = element('details');
      details.id = 'achievementDetails';
      const toggle = element('summary', 'Ver todas as conquistas');
      toggle.id = 'achievementsToggle';
      details.append(toggle);
      const list = element('ul', '', 'achievement-list');
      for (const item of Core.achievementCatalog) {
        const unlocked = saved.unlocked.includes(item.id);
        const row = element('li', '', unlocked ? 'achievement-earned' : '');
        row.append(element('strong', `${unlocked ? '◆' : '◇'} ${item.name}`),
          element('span', `${item.rarity} · ${unlocked ? 'Desbloqueada' : 'Não desbloqueada'}`, 'source-note'), element('p', item.description));
        list.append(row);
      }
      details.append(list);
      const note = element('p', status, 'source-note');
      note.id = 'achievementStatus'; note.setAttribute('role', 'status');
      section.append(details, note);
      container.append(section);
    }
    async function sync() {
      const user = connected();
      if (!user) return;
      align();
      const before = saved;
      try {
        const response = await request('/rest/v1/rpc/atlas_merge_conquistas', { method: 'POST', body: JSON.stringify({
          p_generation: before.generation, p_epoch: before.epoch, p_unlocked: before.unlocked,
        }) });
        if (!response.ok) throw new Error('sincronização indisponível');
        const rows = await response.json();
        const row = Array.isArray(rows) ? rows[0] : null;
        const remote = row && { ...Core.createAchievements(getProgress()), generation: row.generation, epoch: row.epoch, unlocked: row.unlocked };
        if (!Core.validateAchievements(remote)) throw new Error('conquistas inválidas');
        align();
        if (connected() !== user || remote.generation !== saved.generation || remote.epoch !== saved.epoch) return;
        saved = Core.mergeAchievements(saved, remote);
        status = 'Conquistas sincronizadas.';
        persist();
        // Novos desbloqueios durante o pedido precisam de outro envio.
        if (saved.unlocked.some(id => !remote.unlocked.includes(id))) schedule();
      } catch (_) {
        if (connected() !== user) return;
        status = 'Sem sincronizar conquistas agora. Elas continuam disponíveis neste navegador.';
        persist();
      }
    }
    window.addEventListener('storage', event => {
      if (event.key === KEY) { align(); record({}, true); changed(); }
    });
    return { record, render, sync };
  } };
})(globalThis);
