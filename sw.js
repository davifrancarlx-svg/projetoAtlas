'use strict';

// Service worker do Atlas 195.
//
// O artefato é o app inteiro num arquivo só, então o cache aqui é simples de
// propósito: guarda esse arquivo e os ícones, e responde qualquer navegação com
// ele. É o que faz o Atlas abrir sem rede — no metrô, em viagem, no avião — e o
// que evita rebaixar alguns megabytes a cada visita.
//
// VERSION é o hash do artefato, injetado no build: publicar uma versão nova
// troca o nome do cache e o antigo é descartado no activate.

const VERSION = '01eeb09068a2';
const CACHE = `atlas-195-${VERSION}`;
const ASSETS = [
  "./atlas-195.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];
const APP_URL = new URL('./atlas-195.html', self.location).href;

// A instalação leva só os arquivos pequenos. Baixar os cinco megabytes do
// artefato aqui deixaria a instalação inteira dependente de uma única requisição
// grande — e addAll é tudo ou nada: um tropeço, numa aba em segundo plano ou
// numa rede ruim, aborta a instalação e o app fica sem offline nenhum. O
// artefato entra no cache pelo fetch, na primeira vez que for realmente usado.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const anteriores = names.filter((name) => name.startsWith('atlas-195-') && name !== CACHE);
    await Promise.all(anteriores.map((name) => caches.delete(name)));
    await self.clients.claim();

    // A aba aberta neste instante ainda está rodando a versão antiga: ela foi
    // servida do cache antes desta troca acontecer. Sem avisar, a pessoa recarrega,
    // não vê mudança nenhuma e conclui que a publicação falhou. O aviso só faz
    // sentido quando havia mesmo uma versão anterior — numa primeira instalação
    // não existe "versão nova", e o alerta seria ruído.
    if (!anteriores.length) return;
    const abas = await self.clients.matchAll({ type: 'window' });
    abas.forEach((aba) => aba.postMessage({ atlas: 'versao-nova', versao: VERSION }));
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Abrir o app instalado, recarregar ou cair na raiz leva sempre ao artefato.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match(APP_URL);
      if (cached) return cached;
      try {
        const response = await fetch(APP_URL);
        // É aqui que o artefato entra no cache: uma vez aberto com rede, as
        // próximas aberturas funcionam sem ela.
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(APP_URL, response.clone());
        }
        return response;
      } catch (_) {
        return new Response('O Atlas ainda não foi baixado para uso offline. Abra uma vez com internet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
