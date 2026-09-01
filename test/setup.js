/**
 * Test setup: happy-dom (v15) does not ship localStorage/sessionStorage,
 * so provide spec-shaped polyfills backed by Map when missing.
 */
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

if (typeof window !== 'undefined') {
  if (!window.localStorage) window.localStorage = makeStorage();
  if (!window.sessionStorage) window.sessionStorage = makeStorage();
}
