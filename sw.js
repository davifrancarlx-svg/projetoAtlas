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

const VERSION = '6cda0aac1252';
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

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('atlas-195-') && name !== CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
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
        return await fetch(request);
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
      cache.put(request, response.clone());
    }
    return response;
  })());
});
