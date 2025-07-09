/* ******************************************************************************
 * Developed by Fundação CERTI - 2025
 * Author: che
 ****************************************************************************** */
const { expect } = require("chai");
const ContextRedisStore = require("../index.js");
const { REDIS_DISCONNECTED_FLAG } = require("../index.js");

let context;


function waitUntilReady(context) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for Redis')), 3000);
    context.client.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });
    context.client.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

describe('ContextRedisStore', () => {
  beforeEach(async () => {
    context = ContextRedisStore({
      host: "localhost",
      port: 6380,
      db: 0,
      prefix: "noderedtest:"
    });
    await context.open();
    await waitUntilReady(context);
    await context.delete('global');
    const keys = await context.keys('noderedtest:*');
    if (keys.length) await context.client.del(keys);
  });

  afterEach(async () => {
    await context?.close();
  });

  describe('When Redis is connected', () => {
    describe('Method: set/get', () => {
      it('Should set and get a value correctly', async () => {
        await context.set('context', 'keyName', 'keyValue');
        const value = await context.get('context', 'keyName');
        expect(value).to.equal('keyValue');
      });

      it('Should return null for nonexistent key', async () => {
        const value = await context.get('context', 'unknownKey');
        expect(value).to.equal(null);
      });

      it('Should delete key when value is null', async () => {
        await context.set('context', 'key_del', 'toBeDeleted');
        await context.set('context', 'key_del', null);
        const value = await context.get('context', 'key_del');
        expect(value).to.equal(null);
      });

      it('Should support callback usage', (done) => {
        context.set('ctx', 'cbKey', 'cbVal', (err, result) => {
          expect(err).to.be.null;
          expect(result).to.be.equal('OK');
          context.get('ctx', 'cbKey', (err2, val) => {
            expect(err2).to.be.null;
            expect(val).to.equal('cbVal');
            done();
          });
        });
      });
    });

    describe('Method: keys', () => {
      it('Should return all keys in the given scope', async () => {
        await context.clean([]);
        await context.set('context', 'key1', 'val1');
        await context.set('context', 'key2', 'val2');
        await context.set('context', 'key3', 'val3');
        const keys = await context.keys('context');
        expect(keys).to.have.members(['key1', 'key2', 'key3']);
      });
    });

    describe('Method: delete', () => {
      it('Should delete all keys in a scope', async () => {
        await context.set('context', 'k1', 'v1');
        await context.set('context', 'k2', 'v2');
        await context.set('global', 'g1', 'v3');

        await context.delete('context');

        const keysContext = await context.keys('context');
        const keysGlobal = await context.keys('global');

        expect(keysContext.length).to.equal(0);
        expect(keysGlobal.length).to.equal(1);
      });

      it('Should not throw when deleting nonexistent scope', async () => {
        await context.delete('unknown_scope');
      });
    });

    describe('Method: clean', () => {
      it('Should keep keys where all scope parts are in activeNodes', async () => {
        await context.set('key1:key2', 'a', '1');
        await context.set('key3:key4', 'b', '2');
        await context.set('key1', 'c', '3');
        await context.set('unrelated', 'd', '4');
        await context.set('global', 'd', '5');

        await context.clean(['key1', 'key2', 'key3']);

        expect(await context.keys('key1:key2')).to.include('a');
        expect(await context.keys('key3:key4')).to.be.empty;
        expect(await context.keys('key1')).to.include('c');
        expect(await context.keys('unrelated')).to.be.empty;
        expect(await context.keys('global')).to.include('d');
      });

      it('Should remove key if at least one scope part is not active', async () => {
        await context.set('part1:part2:part3', 'someKey', 'someVal');
        await context.clean(['part1', 'part2']);
        expect(await context.keys('part1:part2:part3')).to.be.empty;
      });

      it('Should not clean anything when all parts are in active nodes', async () => {
        await context.set('alpha:beta', 'k', 'v');
        await context.clean(['alpha', 'beta']);
        expect(await context.keys('alpha:beta')).to.include('k');
      });

      it('Should remove all keys when active list is empty', async () => {
        await context.set('sc1', 'k1', 'v1');
        await context.set('sc2:sc3', 'k2', 'v2');
        await context.clean([]);
        expect(await context.keys('sc1')).to.be.empty;
        expect(await context.keys('sc2:sc3')).to.be.empty;
      });

      it('Should not fail if no keys exist', async () => {
        await context.clean(['context']);
      });
    });
  });

  describe('When Redis is disconnected', () => {
    beforeEach(() => {
      context.failed = true;
      context.client = null;
    });

    it('Should return null on get', async () => {
      const value = await context.get('context', 'key');
      expect(value).to.be.equal(REDIS_DISCONNECTED_FLAG);
    });

    it('Should not throw on set', async () => {
      await context.set('context', 'key', 'value');
    });

    it('Should not throw on set with null', async () => {
      await context.set('context', 'key', null);
    });

    it('Should not throw on delete', async () => {
      await context.delete('context');
    });

    it('Should return empty array on keys', async () => {
      const keys = await context.keys('context');
      expect(keys).to.be.an('array').that.is.empty;
    });

    it('Should not throw on clean', async () => {
      await context.clean(['context']);
    });

    it('Should return fallback value on keys and get', async () => {
      const keys = await context.keys('x');
      expect(keys).to.deep.equal([]);

      const value = await context.get('x', 'y');
      expect(value).to.equal(REDIS_DISCONNECTED_FLAG);
    });
  });
});
