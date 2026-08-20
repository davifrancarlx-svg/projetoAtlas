'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Queue = require('../src/sync-queue.js');

function deferred() {
  let resolve;
  const promise = new Promise((ok) => { resolve = ok; });
  return { promise, resolve };
}

test('pedidos recebidos durante uma sincronização nunca são perdidos', async () => {
  const gates = [deferred(), deferred()];
  let runs = 0;
  const queue = Queue.create({
    task: async () => {
      const gate = gates[runs];
      runs += 1;
      await gate.promise;
    },
  });

  const first = queue.run();
  assert.equal(runs, 1);
  const overlapping = await queue.run();
  assert.equal(overlapping, false, 'a chamada concorrente deve virar uma nova rodada, não rodar em paralelo');
  assert.equal(queue.status().pending, true);

  gates[0].resolve();
  await first;
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(runs, 2, 'a alteração feita durante a primeira rodada precisa iniciar outra');
  gates[1].resolve();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(queue.status(), { running: false, pending: false, scheduled: false });
});

test('agendamento agrupa mudanças e cancelamento impede a tarefa', async () => {
  const timers = new Map();
  let nextTimer = 0;
  let runs = 0;
  const queue = Queue.create({
    delay: 6000,
    task: async () => { runs += 1; },
    setTimer: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });

  queue.schedule();
  queue.schedule();
  assert.equal(timers.size, 1, 'múltiplas respostas próximas devem compartilhar um temporizador');
  assert.equal([...timers.values()][0].delay, 6000);
  queue.cancel();
  assert.equal(timers.size, 0);
  assert.equal(runs, 0);
});

test('falha da tarefa libera a fila para uma nova tentativa', async () => {
  let runs = 0;
  const queue = Queue.create({ task: async () => {
    runs += 1;
    if (runs === 1) throw new Error('rede caiu');
  } });
  await assert.rejects(queue.run(), /rede caiu/);
  assert.equal(queue.status().running, false);
  await queue.run();
  assert.equal(runs, 2);
});
