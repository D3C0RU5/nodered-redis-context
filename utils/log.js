/* ******************************************************************************
 * Developed by Fundação CERTI - 2025
 * Author: che
 ****************************************************************************** */

module.exports = {
  _shouldLog() {
    return process.env.NODE_ENV !== 'test';
  },

  _output(type, ...args) {
    if (!this._shouldLog()) return;

    const prefix = '[ContextRedis]';
    const fn = console[type] || console.log;
    fn(prefix, ...args);
  },

  log(...args) {
    this._output('log', ...args);
  },

  info(...args) {
    this._output('info', ...args);
  },

  warn(...args) {
    this._output('warn', ...args);
  },

  error(...args) {
    this._output('error', ...args);
  },

  debug(...args) {
    this._output('debug', ...args);
  }
};

