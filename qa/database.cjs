'use strict';
// PostgreSQL em WASM, descartado ao terminar. Nunca conecta ao backend remoto.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const one = '00000000-0000-4000-8000-000000000001';
const two = '00000000-0000-4000-8000-000000000002';
async function main() {
  const db = new PGlite();
  let checks = 0;
  const denied = async (sql, code) => {
    await assert.rejects(db.exec(sql), error => error.code === code);
    checks++;
  };
  try {
    // Substitutos mínimos dos papéis e da identidade JWT do Supabase.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      insert into auth.users values ('${one}'), ('${two}');
    `);
    const folder = path.join(__dirname, '../supabase/migrations');
    // Reaplicação também precisa funcionar.
    for (let pass = 0; pass < 2; pass++) {
      for (const file of fs.readdirSync(folder).filter(f => f.endsWith('.sql')).sort()) {
        await db.exec(fs.readFileSync(path.join(folder, file), 'utf8'));
      }
    }
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${one}';
      insert into public.progresso_atlas (usuario,envelope) values ('${one}', '{"schemaVersion":2}');
      update public.progresso_atlas set envelope = '{"schemaVersion":3}';
      update public.progresso_atlas set envelope = '{"schemaVersion":3,"sameVersion":true}';`);
    for (const envelope of ['{"schemaVersion":2}', '{}', '{"schemaVersion":null}', '{"schemaVersion":"3"}']) {
      await denied(`update public.progresso_atlas set envelope = '${envelope}'`, '23514');
    }
    await denied(`update public.progresso_atlas set envelope = '[]'`, '23514');
    await denied(`update public.progresso_atlas set envelope = jsonb_build_object('schemaVersion',3,'data',repeat('x',2097152))`, '23514');
    await denied('truncate public.progresso_atlas', '42501');
    await db.exec(`set request.jwt.claim.sub = '${two}'`);
    assert.equal((await db.query('select * from public.progresso_atlas')).rows.length, 0);
    checks++;
    for (const sql of ['update public.progresso_atlas set envelope = \'{"schemaVersion":99}\' returning usuario', 'delete from public.progresso_atlas returning usuario']) {
      assert.equal((await db.query(sql)).rows.length, 0);
      checks++;
    }
    await denied(`insert into public.progresso_atlas (usuario,envelope) values ('${one}', '{}')`, '42501');
    await db.exec(`insert into public.progresso_atlas (usuario,envelope) values ('${two}', '{"schemaVersion":3}')`);
    assert.equal((await db.query('select * from public.progresso_atlas')).rows.length, 1);
    checks++;
    await db.exec(`delete from public.progresso_atlas where usuario='${two}'; set request.jwt.claim.sub = '${one}'`);
    const row = (await db.query('select envelope from public.progresso_atlas')).rows[0];
    assert.deepEqual(row.envelope, { schemaVersion: 3, sameVersion: true });
    checks++;
    await db.exec(`update public.progresso_atlas set envelope = '{"schemaVersion":4}';
      update public.progresso_atlas set envelope = '{"schemaVersion":4,"skills":{}}'`);
    await denied(`update public.progresso_atlas set envelope = '{"schemaVersion":3}'`, '23514');
    await db.exec('reset role; set role anon');
    for (const sql of ['select * from public.progresso_atlas', 'truncate public.progresso_atlas',
      `insert into public.progresso_atlas (usuario,envelope) values ('${two}','{}')`,
      "update public.progresso_atlas set envelope='{}'", 'delete from public.progresso_atlas']) {
      await denied(sql, '42501');
    }
    console.log(`${checks} verificações de banco passaram; migrações reaplicadas; banco descartável.`);
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
