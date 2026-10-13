// One in-memory resource per mounted session provider. Never persisted to browser storage.
export function createPrivateResource(fetcher, { ttlMs = 30000, now = Date.now } = {}) {
  let key, data, fetchedAt = 0, pending, controller, generation = 0;
  function clear() {
    generation++;
    controller?.abort();
    key = undefined; data = undefined; pending = undefined; fetchedAt = 0;
  }
  function load(userId, { force = false } = {}) {
    if (!userId) return Promise.reject(new Error('Session required'));
    if (key !== userId || force) { clear(); key = userId; }
    if (pending) return pending;
    if (data !== undefined && now() - fetchedAt < ttlMs) return Promise.resolve(data);
    const current = generation;
    const requestController = new AbortController();
    controller = requestController;
    pending = Promise.resolve().then(() => fetcher(userId, requestController.signal)).then(result => {
      if (current !== generation) { const error = new Error('Session changed'); error.name = 'AbortError'; throw error; }
      data = result; fetchedAt = now(); return result;
    }).finally(() => { if (current === generation) pending = undefined; });
    return pending;
  }
  return { load, clear };
}
