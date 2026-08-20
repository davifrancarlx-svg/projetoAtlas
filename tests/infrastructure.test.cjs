'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('a infraestrutura Supabase versiona tabela, limites e quatro políticas RLS', () => {
  const migration = read('supabase/migrations/202608200001_progresso_atlas.sql');
  assert.match(migration, /create table if not exists public\.progresso_atlas/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /octet_length\(envelope::text\) <= 2097152/i);
  ['select', 'insert', 'update', 'delete'].forEach((operation) => {
    assert.match(migration, new RegExp(`for ${operation}`, 'i'), `política ${operation} ausente`);
  });
  assert.equal((migration.match(/auth\.uid\(\)/g) || []).length, 5);
  assert.match(migration, /revoke all[^;]+from anon/i);
});

test('o CI confere todos os arquivos publicáveis gerados', () => {
  const workflow = read('.github/workflows/ci.yml');
  ['atlas-195.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png',
    'icon-maskable-512.png', 'apple-touch-icon.png', 'release-manifest.json']
    .forEach((file) => assert.match(workflow, new RegExp(file.replace('.', '\\.')), `${file} ficou fora do CI`));
  assert.match(workflow, /npm run check/);
});

test('a interface preserva recursos essenciais de acessibilidade', () => {
  const html = read('src/index.template.html');
  const css = read('src/styles.css');
  const app = read('src/app.js');
  assert.match(html, /class="skip-link"/);
  assert.match(html, /role="listbox"/);
  assert.match(app, /aria-activedescendant/);
  assert.match(css, /--tap:\s*44px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(app, /event\.key === 'Home' \|\| event\.key === 'End'/);
  assert.match(app, /\^\\p\{L\}\$\/u/);
});

test('falhas de rede da conta são recuperáveis pela interface', () => {
  const app = read('src/app.js');
  assert.match(app, /async function ensureCloudIdentity/);
  assert.match(app, /if \(!await ensureCloudIdentity\(\)\)/);
  assert.match(app, /Sem conexão para enviar o link agora/);
  assert.match(app, /disabled: cloud\.requestingLink/);
  assert.match(app, /finally \{\s*cloud\.requestingLink = false;/);
  assert.match(app, /SyncQueue\.create/);
});
