'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const APP = 'https://atlas.test/atlas-195.html';
function worker({ offline = false, quota = false, old = false } = {}) {
  const stores = new Map(), handlers = {}, messages = [];
  if (old) stores.set('atlas-195-old', new Map([[APP, new Response('old')]]));
  const url = input => new URL(typeof input === 'string' ? input : input.url, APP).href;
  const fetch = async input => {
    if (offline) throw new Error('offline');
    return new Response(url(input) === APP ? 'new' : 'icon');
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async input => {
      for (const store of stores.values()) if (store.has(url(input))) return store.get(url(input)).clone();
    },
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      const put = async (input, response) => { if (quota) throw new Error('quota'); store.set(url(input), response.clone()); };
      return {
        match: async input => store.get(url(input))?.clone(),
        put,
        add: async input => put(input, await fetch(input)),
      };
    },
  };
  const self = {
    location: new URL(APP.replace('atlas-195.html', 'sw.js')),
    addEventListener: (name, fn) => { handlers[name] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [{ postMessage: m => messages.push(m) }] },
  };
  const source = fs.readFileSync(path.join(__dirname,'../src/sw.js'),'utf8')
    .replace('{{VERSION}}','new').replace('{{ASSETS}}',JSON.stringify(['./atlas-195.html','./icon-192.png']));
  vm.runInNewContext(source,{self,caches,fetch,URL,Request,Response});
  return {
    stores, messages,
    lifecycle: name => { let pending; handlers[name]({waitUntil: p => { pending = p; }}); return pending; },
    navigate: () => { let response; handlers.fetch({request:{url:APP,method:'GET',mode:'navigate'},respondWith:p=>{response=p;}}); return response; },
  };
}

test('uma atualização sem rede não se instala por cima da versão offline existente',async()=>{
  const w=worker({offline:true,old:true});
  await assert.rejects(w.lifecycle('install'));
  assert.ok(w.stores.get('atlas-195-old').has(APP));
  assert.equal(await (await w.navigate()).text(),'old');
});

test('ativação sem HTML novo preserva a cópia anterior e não anuncia atualização pronta',async()=>{
  const w=worker({old:true});
  await w.lifecycle('activate');
  assert.ok(w.stores.has('atlas-195-old'));
  assert.equal(w.messages.length,0);
});

test('atualização bem-sucedida serve o HTML novo e só então descarta o antigo',async()=>{
  const w=worker({old:true});
  await w.lifecycle('install');
  await w.lifecycle('activate');
  assert.equal(w.stores.has('atlas-195-old'),false);
  assert.equal(await (await w.navigate()).text(),'new');
  assert.equal(w.messages.length,1);
});

test('falta de espaço no cache não transforma uma resposta online válida em erro',async()=>{
  const w=worker({quota:true});
  const response=await w.navigate();
  assert.equal(response.status,200);
  assert.equal(await response.text(),'new');
});

test('primeiro acesso sem rede e sem cache informa indisponibilidade',async()=>{
  const response=await worker({offline:true}).navigate();
  assert.equal(response.status,503);
});
