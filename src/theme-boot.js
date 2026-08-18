// Roda antes da primeira pintura da página.
//
// A escolha de tema vive nas preferências, que só são lidas quando o app
// inicializa — tarde demais: quem fixou o tema oposto ao do sistema veria a
// paleta errada por um instante antes da troca. Este trecho aplica só o
// atributo na raiz; toda a lógica de tema continua em app.js, com esta a
// única duplicação: o nome da chave de preferências.
(function () {
  'use strict';
  try {
    var salvo = JSON.parse(localStorage.getItem('atlas195:prefs:v2') || 'null');
    var tema = salvo && salvo.theme;
    if (tema === 'light' || tema === 'dark') document.documentElement.dataset.theme = tema;
  } catch (_) {
    // Navegação privada ou preferência corrompida: segue no automático.
  }
})();
