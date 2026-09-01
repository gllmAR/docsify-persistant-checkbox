/**
 * Safe storage wrapper.
 *
 * All access is try/catch-guarded. If storage is unavailable (Safari private
 * mode, blocked cookies, quota), the plugin degrades to session-only
 * interactivity: a single console warning, afterwards every call is a no-op.
 *
 * Layout:
 *   <ns>:<routeHash>          -> JSON array of item keys (route index)
 *   <ns>:<routeHash>:<key>    -> '1' | '0'
 */

const ROUTE_INDEX_SUFFIX = '__keys__';

export function createStore({ namespace, storage = 'local', warn = console.warn } = {}) {
  const ns = namespace || 'docsify-pc';
  let backend = null;
  let unavailable = false;

  try {
    if (typeof Storage !== 'undefined') {
      backend = storage === 'session' ? sessionStorage : localStorage;
      // Probe: some environments expose the object but throw on access.
      backend.getItem('__dpc_probe__');
    }
  } catch {
    backend = null;
  }

  if (!backend) {
    unavailable = true;
    warn('[persistent-checkbox] storage unavailable — checkbox state will not persist');
  }

  function guard(fn, fallback) {
    if (unavailable) return fallback;
    try {
      return fn(backend);
    } catch (err) {
      unavailable = true;
      warn('[persistent-checkbox] storage unavailable — checkbox state will not persist', err);
      return fallback;
    }
  }

  const keyOf = (routeHash, itemKey) => `${ns}:${routeHash}:${itemKey}`;
  const indexKey = (routeHash) => `${ns}:${routeHash}:${ROUTE_INDEX_SUFFIX}`;

  return {
    get available() {
      return !unavailable;
    },

    /** @returns {Record<string, boolean>} itemKey -> checked */
    getRouteState(routeHash) {
      return guard((store) => {
        const rawIndex = store.getItem(indexKey(routeHash));
        if (!rawIndex) return {};
        let keys;
        try {
          keys = JSON.parse(rawIndex);
        } catch {
          return {};
        }
        if (!Array.isArray(keys)) return {};
        const state = {};
        for (const k of keys) {
          if (typeof k !== 'string') continue;
          const v = store.getItem(keyOf(routeHash, k));
          if (v === '1') state[k] = true;
          else if (v === '0') state[k] = false;
        }
        return state;
      }, {});
    },

    setItem(routeHash, itemKey, checked) {
      guard((store) => {
        store.setItem(keyOf(routeHash, itemKey), checked ? '1' : '0');
        const raw = store.getItem(indexKey(routeHash));
        let keys = [];
        try {
          keys = raw ? JSON.parse(raw) : [];
        } catch {
          keys = [];
        }
        if (Array.isArray(keys) && !keys.includes(itemKey)) {
          keys.push(itemKey);
          store.setItem(indexKey(routeHash), JSON.stringify(keys));
        }
      });
    },

    removeItem(routeHash, itemKey) {
      guard((store) => {
        store.removeItem(keyOf(routeHash, itemKey));
        const raw = store.getItem(indexKey(routeHash));
        try {
          const keys = raw ? JSON.parse(raw) : [];
          if (Array.isArray(keys)) {
            const next = keys.filter((k) => k !== itemKey);
            store.setItem(indexKey(routeHash), JSON.stringify(next));
          }
        } catch {
          /* index cleanup is best-effort */
        }
      });
    },

    /** Remove the given item keys for a route (does not touch other routes). */
    clearKeys(routeHash, itemKeys) {
      guard((store) => {
        for (const k of itemKeys) store.removeItem(keyOf(routeHash, k));
        store.removeItem(indexKey(routeHash));
      });
    },
  };
}
