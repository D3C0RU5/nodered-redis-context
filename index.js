/* ******************************************************************************
 * Developed by Fundação CERTI - 2025
 * Author: che
 ****************************************************************************** */

import redis from "redis";
import log from "./utils/log.js";

export const REDIS_DISCONNECTED_FLAG = "REDIS_DISCONNECTED";

function ContextRedisStore(config) {
  this.config = config;
  this.client = null;
  this.failed = null
  this.prefix = config.prefix || 'nodered:';
}

ContextRedisStore.prototype._makeKey = function (scope, key) {
  return `${this.prefix}${scope}:${key}`;
};

ContextRedisStore.prototype.open = async function () {
  try {
    this.client = redis.createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
        reconnectStrategy: retries => {
          const delay = Math.min(retries * 100, 3000);
          log.warn(`Redis reconnect attempt #${retries}, retrying in ${delay}ms`);
          return delay;
        }
      },
      password: this.config.password,
      database: this.config.db,
    });

    this.client.on('connect', () => {
      log.warn('Redis Connected successfully!!');
      this.failed = false
    });

    this.client.on('ready', () => {
      log.warn('Redis ready!!');
      this.failed = false
    });

    this.client.on('error', (err) => {
      log.error('Redis error:', err.message);
      this.failed = true
    });

    this.client.connect().catch(err => {
      log.error('Redis initial connect failed:', err.message);
      this.failed = true;
    });
  } catch (err) {
    log.error('Redis connection failed:', err.message);
    this.failed = true;
  }
};

ContextRedisStore.prototype.close = async function () {
  try {
    if (this.client && this.client.isOpen || this.failed) {
      await this.client?.quit();
      log.warn('Redis connection closed');
    }
  } catch (err) {
    log.error('Error closing Redis:', err.message);
    throw err;
  }
};

ContextRedisStore.prototype._checkClient = function () {
  if (this.failed) {
    throw new Error('Redis client marked as failed');
  }
  if (!this.client || !this.client.isOpen) {
    throw new Error('Redis client not connected');
  }
};

ContextRedisStore.prototype._safeExecute = async function (fn, callback = null, erroReturnValue = REDIS_DISCONNECTED_FLAG) {
  try {
    this._checkClient();
    const result = await fn();
    if (callback) return callback(null, result);
    return result;
  } catch (err) {
    if (this.failed) {
      if (callback) return callback(null, erroReturnValue);
      return erroReturnValue;
    }
    if (callback) return callback(err);
    throw err;
  }
};

ContextRedisStore.prototype.get = function (scope, key, callback = null) {
  return this._safeExecute(async () => {
    const redisKey = this._makeKey(scope, key);
    const val = await this.client.get(redisKey);
    if (val == null) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }, callback);
};


ContextRedisStore.prototype.set = function (scope, key, value, callback = null) {
  return this._safeExecute(async () => {
    const redisKey = this._makeKey(scope, key);
    const strVal = value === null || value === undefined ? null : JSON.stringify(value);

    if (strVal === null) {
      return await this.client.del(redisKey);
    } else {
      return await this.client.set(redisKey, strVal);
    }
  }, callback);
};

ContextRedisStore.prototype.delete = function (scope) {
  return this._safeExecute(async () => {
    const pattern = `${this.prefix}${scope}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.unlink(keys);
    }
    return;
  });
};


ContextRedisStore.prototype.keys = function (scope, callback = null) {
  return this._safeExecute(async () => {
    const pattern = `${this.prefix}${scope}:*`;
    const keys = await this.client.keys(pattern);
    const prefix = `${this.prefix}${scope}:`;
    return keys.map(k => k.replace(prefix, ''));
  }, callback, []);
};

ContextRedisStore.prototype.clean = function (activeNodes) {
  return this._safeExecute(async () => {
    const pattern = `${this.prefix}*`;
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return;

    const activeSet = new Set(activeNodes);
    activeSet.add('global');

    const keysToDelete = [];

    for (const key of keys) {
      const keyWithoutPrefix = key.slice(this.prefix.length);
      const scopeParts = keyWithoutPrefix.split(':');

      if (scopeParts.length <= 1) continue;

      const pathToValidate = scopeParts.slice(0, -1);

      const shouldDelete = pathToValidate.some(part => !activeSet.has(part));
      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length > 0) {
      await this.client.del(keysToDelete);
      log.warn(`Cleaned ${keysToDelete.length} keys for inactive nodes`);
    }
  });
};


export default function (config) {
  return new ContextRedisStore(config);
};