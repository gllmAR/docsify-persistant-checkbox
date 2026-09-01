import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { internals } from './load-plugin.js';

const { createStore } = internals();

describe('createStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and reads route-scoped state', () => {
    const store = createStore({ namespace: 'test' });
    expect(store.available).toBe(true);

    store.setItem('r1', 'abc', true);
    store.setItem('r1', 'def', false);
    store.setItem('r2', 'abc', true);

    expect(store.getRouteState('r1')).toEqual({ abc: true, def: false });
    expect(store.getRouteState('r2')).toEqual({ abc: true });
  });

  it('removeItem drops the value and the index entry', () => {
    const store = createStore({ namespace: 'test' });
    store.setItem('r1', 'a', true);
    store.setItem('r1', 'b', true);
    store.removeItem('r1', 'a');
    expect(store.getRouteState('r1')).toEqual({ b: true });
  });

  it('clearKeys removes only the given route', () => {
    const store = createStore({ namespace: 'test' });
    store.setItem('r1', 'a', true);
    store.setItem('r2', 'a', true);
    store.clearKeys('r1', ['a']);
    expect(store.getRouteState('r1')).toEqual({});
    expect(store.getRouteState('r2')).toEqual({ a: true });
  });

  it('degrades gracefully when storage throws, warning exactly once', () => {
    const warn = vi.fn();
    const throwing = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
      removeItem() {
        throw new Error('SecurityError');
      },
    };
    vi.stubGlobal('localStorage', throwing);

    const store = createStore({ namespace: 'test', warn });
    expect(store.available).toBe(false);

    expect(() => {
      store.setItem('r', 'k', true);
      store.setItem('r', 'k2', false);
      expect(store.getRouteState('r')).toEqual({});
      store.clearKeys('r', ['k']);
    }).not.toThrow();

    expect(warn).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('uses sessionStorage when configured', () => {
    const store = createStore({ namespace: 's', storage: 'session' });
    store.setItem('r', 'k', true);
    expect(window.sessionStorage.getItem('s:r:k')).toBe('1');
    expect(window.localStorage.getItem('s:r:k')).toBeNull();
  });
});
