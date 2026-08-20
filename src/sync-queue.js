(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AtlasSyncQueue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Coordena uma tarefa assíncrona que pode receber novos pedidos enquanto já
  // está rodando. O pedido novo nunca se perde: ele vira mais uma execução assim
  // que a atual termina. Fica fora de app.js para ser testado sem DOM ou rede.
  function create(options) {
    options = options || {};
    if (typeof options.task !== 'function') throw new TypeError('task must be a function');
    var delay = Number.isFinite(options.delay) && options.delay >= 0 ? options.delay : 0;
    var setTimer = options.setTimer || setTimeout;
    var clearTimer = options.clearTimer || clearTimeout;
    var timer = 0;
    var running = false;
    var pending = false;

    function schedule(wait) {
      pending = true;
      if (timer) clearTimer(timer);
      timer = setTimer(function () {
        timer = 0;
        execute();
      }, Number.isFinite(wait) && wait >= 0 ? wait : delay);
    }

    async function execute() {
      if (running) {
        pending = true;
        return false;
      }
      if (timer) clearTimer(timer);
      timer = 0;
      pending = false;
      running = true;
      try {
        await options.task();
        return true;
      } finally {
        running = false;
        if (pending) schedule(0);
      }
    }

    function cancel() {
      if (timer) clearTimer(timer);
      timer = 0;
      pending = false;
    }

    function status() {
      return { running: running, pending: pending, scheduled: Boolean(timer) };
    }

    return Object.freeze({ schedule: schedule, run: execute, cancel: cancel, status: status });
  }

  return Object.freeze({ create: create });
});
