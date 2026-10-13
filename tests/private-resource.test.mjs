import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-source.mjs';

const { createPrivateResource } = await loadModule('../../app/lib/private-resource.js');

test('deduplicates requests and refreshes after expiry or explicit invalidation', async () => {
  let time = 0, calls = 0;
  const resource = createPrivateResource(async id => ({ id, revision: ++calls }), { ttlMs: 30, now: () => time });
  const first = resource.load('a');
  assert.equal(resource.load('a'), first);
  assert.equal((await first).revision, 1);
  time = 29;
  assert.equal((await resource.load('a')).revision, 1);
  time = 30;
  assert.equal((await resource.load('a')).revision, 2);
  assert.equal((await resource.load('a', { force: true })).revision, 3);
});

test('account changes abort old requests and reject late private responses', async () => {
  const requests = [];
  const resource = createPrivateResource((id, signal) => new Promise(resolve => requests.push({ id, signal, resolve })));
  const old = resource.load('a');
  const rejected = assert.rejects(old, { name: 'AbortError' });
  await Promise.resolve();
  const next = resource.load('b');
  await Promise.resolve();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].signal.aborted, false);
  requests[0].resolve({ id: 'a' });
  requests[1].resolve({ id: 'b' });
  await rejected;
  assert.deepEqual(await next, { id: 'b' });
  assert.deepEqual(await resource.load('b'), { id: 'b' });
});

test('logout clears cached data and failed requests can retry', async () => {
  let calls = 0;
  const resource = createPrivateResource(async id => {
    if (++calls === 1) throw new Error('network');
    return { id, revision: calls };
  });
  await assert.rejects(resource.load('a'), /network/);
  assert.equal((await resource.load('a')).revision, 2);
  resource.clear();
  assert.equal((await resource.load('a')).revision, 3);
  await assert.rejects(resource.load(null), /Session required/);
});
