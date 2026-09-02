// @vitest-environment happy-dom
import { loadPlugin } from './load-plugin.js';

const persistentCheckbox = loadPlugin();

/**
 * Minimal docsify-like harness (shared by integration & sync tests):
 *  - a fake hook registrar capturing afterEach/mounted/doneEach
 *  - a fake vm with config + route
 *  - simulates a route render: afterEach(html) -> innerHTML -> doneEach()
 */
export function createHarness(config) {
  const host = document.createElement('main');
  document.body.innerHTML = '';
  document.body.appendChild(host);

  const hooks = { afterEach: [], mounted: [], doneEach: [] };
  const hook = {
    afterEach: (fn) => hooks.afterEach.push(fn),
    mounted: (fn) => hooks.mounted.push(fn),
    doneEach: (fn) => hooks.doneEach.push(fn),
  };
  const vm = {
    config,
    route: { path: '/' },
  };
  persistentCheckbox(hook, vm);

  return {
    vm,
    host,
    /** render a markdown source at a route */
    render(markdown, path) {
      if (path !== undefined) vm.route.path = path;
      let html = markdown;
      for (const fn of hooks.afterEach) html = fn(html) ?? html;
      host.innerHTML = html;
      for (const fn of hooks.doneEach) fn();
      return host;
    },
    mounted() {
      for (const fn of hooks.mounted) fn();
    },
  };
}

export const inputs = (host) => [...host.querySelectorAll('input[data-dpc-key]')];

export function toggle(input) {
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Simulate a storage write from ANOTHER tab (storage events don't fire locally). */
export function storageEventFromOtherTab(key, newValue) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}
