'use strict';
// A barra de opções de treino abre sozinha no computador e no tablet e fica
// recolhida no celular, onde ocuparia a primeira tela inteira. Abrir ou
// recolher pelo botão é escolha da pessoa e fica guardada. O campo antigo
// `filtersCollapsed` era gravado junto com qualquer outra preferência enquanto
// o padrão era fechado, então não vale como escolha.
const assert = require('node:assert/strict');

const PREFS = 'atlas195:prefs:v2';

module.exports = async (client, evaluate, until) => {
  const ev = (code) => evaluate(client, code);
  const tela = (width, height) => client.send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: width < 821 });
  const barra = async () => JSON.parse(await ev(`JSON.stringify({
    aberta: document.getElementById('controls').getBoundingClientRect().height > 0,
    expandida: document.getElementById('filterToggle').getAttribute('aria-expanded'),
    escolha: JSON.parse(localStorage.getItem('${PREFS}') || '{}').filtersHidden ?? null,
  })`));
  const recarregar = async () => {
    await client.send('Page.reload');
    await until('app pronto', () => ev("Boolean(document.getElementById('questionTitle')) && !document.getElementById('appShell').classList.contains('is-initializing')"));
  };
  const alternar = () => ev("document.getElementById('filterToggle').click()");

  try {
    // Quem usou a versão anterior tem `filtersCollapsed: true` gravado sem ter
    // escolhido nada: no computador a barra abre mesmo assim.
    await ev(`(() => {
      const prefs = JSON.parse(localStorage.getItem('${PREFS}') || '{}');
      delete prefs.filtersHidden; prefs.filtersCollapsed = true; prefs.focusMode = false;
      localStorage.setItem('${PREFS}', JSON.stringify(prefs));
    })()`);
    await tela(1280, 900);
    await recarregar();
    assert.deepEqual(await barra(), { aberta: true, expandida: 'true', escolha: null });

    // No celular, sem escolha, ela recolhe; a mudança de tamanho basta.
    await tela(390, 844);
    await until('a barra recolher no celular', async () => !(await barra()).aberta);
    assert.equal((await barra()).expandida, 'false');

    // Abrir no celular é escolha: fica guardada e sobrevive ao recarregar.
    await alternar();
    assert.deepEqual(await barra(), { aberta: true, expandida: 'true', escolha: false });
    await recarregar();
    assert.equal((await barra()).aberta, true, 'A escolha de abrir precisa valer depois de recarregar.');

    // Recolher no computador também é lembrado.
    await tela(1280, 900);
    await alternar();
    assert.deepEqual(await barra(), { aberta: false, expandida: 'false', escolha: true });
    await recarregar();
    assert.equal((await barra()).aberta, false, 'A escolha de recolher precisa valer depois de recarregar.');

    // O foco esconde a barra só enquanto dura; ao sair, ela volta ao que a
    // pessoa escolheu, e a escolha não muda.
    await alternar();
    await ev("document.querySelector('[data-view=quiz]').click(); document.getElementById('focusToggle').click()");
    assert.equal((await barra()).aberta, false, 'O modo foco esconde a barra.');
    await ev("document.getElementById('focusToggle').click()");
    assert.deepEqual(await barra(), { aberta: true, expandida: 'true', escolha: false });
  } finally {
    await ev(`(() => {
      const prefs = JSON.parse(localStorage.getItem('${PREFS}') || '{}');
      delete prefs.filtersHidden; delete prefs.filtersCollapsed; prefs.focusMode = false;
      localStorage.setItem('${PREFS}', JSON.stringify(prefs));
    })()`);
    await tela(1280, 900);
    await recarregar();
  }
};
