'use strict';

// A conta é uma cópia do progresso, nunca a fonte. Estes testes fixam as duas
// regras que sustentam essa promessa: a área de conta só existe quando há
// backend e origem de rede, e a sincronização funde os dois lados em vez de
// escolher um — é o que impede criar conta apagar o que já estava no aparelho.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'cloud.json'), 'utf8'));
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'countries.base.json'), 'utf8')).map((c) => c.id);
const options = { countryIds: IDS };

test('a configuração de conta aponta para https e nomeia a tabela', () => {
  assert.match(config.url, /^https:\/\//, 'A URL do backend precisa ser https.');
  assert.equal(typeof config.anonKey, 'string');
  assert.ok(config.anonKey.length > 20, 'A chave pública parece incompleta.');
  assert.equal(typeof config.tabela, 'string');
  assert.ok(config.tabela.length > 0);
});

test('a área de conta só aparece com backend configurado e origem de rede', () => {
  assert.equal(Core.cloudReady(config, 'https:'), true);
  assert.equal(Core.cloudReady(config, 'http:'), true);
  // Aberto direto do disco não há origem: a área some e o treino segue local.
  assert.equal(Core.cloudReady(config, 'file:'), false);
  assert.equal(Core.cloudReady(null, 'https:'), false);
  assert.equal(Core.cloudReady({}, 'https:'), false);
  assert.equal(Core.cloudReady({ url: 'http://inseguro.exemplo', anonKey: 'x', tabela: 't' }, 'https:'), false);
  assert.equal(Core.cloudReady({ url: config.url, anonKey: config.anonKey }, 'https:'), false);
});

function comHabilidade(id, direcao, acertou) {
  return Core.recordAnswer(Core.createProgress(), id, direcao, acertou, options);
}

test('a primeira sincronização envia o progresso local sem pedir nada em troca', () => {
  const local = comHabilidade('BR', 'cap', true);
  const plano = Core.planSync(local, null, options);
  assert.equal(plano.upload, true, 'Sem linha no servidor, o local precisa subir.');
  assert.equal(plano.download, false);
  assert.equal(plano.merged, local);
});

test('entrar na conta funde os dois lados: nada do aparelho é perdido', () => {
  const local = comHabilidade('BR', 'cap', true);
  const remoto = comHabilidade('JP', 'flag', true);
  const plano = Core.planSync(local, remoto, options);

  assert.equal(plano.upload, true, 'O servidor precisa receber o que só existia no aparelho.');
  assert.equal(plano.download, true, 'O aparelho precisa receber o que só existia na conta.');
  assert.ok(Core.levelOf(plano.merged, 'BR', 'cap') > 0, 'O progresso local sumiu na fusão.');
  assert.ok(Core.levelOf(plano.merged, 'JP', 'flag') > 0, 'O progresso da conta sumiu na fusão.');
});

test('sem divergência não há tráfego', () => {
  const local = comHabilidade('BR', 'cap', true);
  const igual = Core.deserializeProgress(Core.serializeProgress(local, options), options).progress;
  const plano = Core.planSync(local, igual, options);
  assert.deepEqual(
    { upload: plano.upload, download: plano.download, unchanged: plano.unchanged },
    { upload: false, download: false, unchanged: true }
  );
});

test('um apagar de progresso feito na conta vence o aparelho desatualizado', () => {
  // resetProgress avança a geração; mergeProgress trata isso como "isto é mais
  // novo", e é o que impede um aparelho velho ressuscitar o que foi apagado.
  const antigo = comHabilidade('BR', 'cap', true);
  const apagado = Core.resetProgress(antigo, { countryIds: IDS, now: new Date().toISOString() });
  const plano = Core.planSync(antigo, apagado, options);
  assert.equal(plano.download, true, 'O aparelho precisa aceitar o apagamento vindo da conta.');
  assert.equal(Core.levelOf(plano.merged, 'BR', 'cap'), 0, 'O progresso apagado voltou.');
});

test('o progresso guardado na conta é o mesmo envelope validado do arquivo de backup', () => {
  const local = comHabilidade('BR', 'cap', true);
  const serializado = Core.serializeProgress(local, options);
  const devolta = Core.deserializeProgress(serializado, options);
  assert.equal(devolta.recovered, false);
  assert.equal(Core.serializeProgress(devolta.progress, options), serializado);
  // Envelope corrompido no servidor não pode contaminar o aparelho.
  assert.equal(Core.deserializeProgress('{"schemaVersion":2,"lixo":true}', options).recovered, true);
});
