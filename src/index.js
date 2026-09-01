/**
 * docsify-plugin-persistent-checkbox
 *
 * Makes Docsify 5 task-list checkboxes interactive and persists their state
 * per page (localStorage/sessionStorage), keyed by stable content identity.
 *
 * Usage:
 *   window.$docsify = {
 *     plugins: [persistentCheckbox],           // ESM / manual registration
 *     persistentCheckbox: { progress: true },  // or `true` for defaults
 *   };
 *
 * The IIFE build auto-registers itself into window.$docsify.plugins.
 */

import { fnv1a32, routeHashKey } from './keys.js';
import { createStore } from './storage.js';
import { countForList, countForPage, directItemInputs, transformTaskLists } from './dom.js';
import { injectStyles, updateAllProgress, updateProgressForList } from './progress.js';

const DEFAULTS = {
  storage: 'local', // 'local' | 'session'
  keyStrategy: 'hash', // 'hash' | 'index'
  namespace: 'docsify-pc',
  progress: false,
  progressText: 'Progress: {done}/{total}',
  resetButton: false,
  resetLabel: 'Reset',
  onChange: null, // (ctx) => void
  onPageComplete: null, // (ctx) => void
};

/**
 * Delegated listeners live at document level and must survive SPA navigation.
 * They are module-level singletons so a re-init replaces (never duplicates)
 * them.
 * @type {{change?: Function, click?: Function}}
 */
const delegated = {};

export function normalizeConfig(raw) {
  if (!raw) return null; // disabled unless opted in
  const opts = raw === true ? {} : raw;
  return { ...DEFAULTS, ...opts };
}

function safeCall(fn, ctx) {
  if (typeof fn !== 'function') return;
  try {
    fn(ctx);
  } catch (err) {
    console.error('[persistent-checkbox]', err);
  }
}

/**
 * Docsify plugin entry.
 * @param {object} hook Docsify hook registrar
 * @param {object} vm   Docsify instance
 */
export function persistentCheckbox(hook, vm) {
  const cfg = normalizeConfig(vm?.config?.persistentCheckbox);
  if (!cfg) return; // plugin not enabled in config — stay inert

  const store = createStore({ namespace: cfg.namespace, storage: cfg.storage });
  let routeHash = routeHashKey(vm?.route?.path);
  let routeState = {};
  /** routeHash -> was fully complete (for onPageComplete transition) */
  const completeMemo = new Map();

  function refreshRoute() {
    routeHash = routeHashKey(vm?.route?.path);
    routeState = store.getRouteState(routeHash);
  }

  hook.afterEach((html) => {
    refreshRoute();
    const result = transformTaskLists(html, {
      keyStrategy: cfg.keyStrategy,
      progress: cfg.progress,
      resetButton: cfg.resetButton,
      resetLabel: cfg.resetLabel,
      stored: routeState,
    });
    if (result.count === 0 && /class="task-list"/.test(html)) {
      console.warn(
        '[persistent-checkbox] task list detected but transform matched nothing — ' +
          'docsify/marked markup may have changed; checkboxes remain disabled',
      );
    }
    return result.html;
  });

  hook.mounted(() => {
    injectStyles(document);

    if (delegated.change) document.removeEventListener('change', delegated.change);
    if (delegated.click) document.removeEventListener('click', delegated.click);

    delegated.change = (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.dataset.dpcKey) return;
      if (!input.matches('[data-dpc-key]')) return;

      const key = input.dataset.dpcKey;
      input.checked = !!input.checked;
      routeState[key] = input.checked;
      store.setItem(routeHash, key, input.checked);

      const list = input.closest('[data-dpc-list]');
      if (list) updateProgressForList(list, cfg.progressText);

      const ctx = pageContext();
      safeCall(cfg.onChange, { ...ctx, item: itemContext(input) });

      const isComplete = ctx.total > 0 && ctx.done === ctx.total;
      const wasComplete = completeMemo.get(routeHash) === true;
      if (isComplete && !wasComplete) safeCall(cfg.onPageComplete, ctx);
      completeMemo.set(routeHash, isComplete);
    };

    delegated.click = (event) => {
      const btn = event.target instanceof Element && event.target.closest('.dpc-progress-reset');
      if (!btn) return;
      const progress = btn.closest('[data-dpc-progress]');
      const list = progress && progress.nextElementSibling;
      if (!list || !list.matches('[data-dpc-list]')) return;

      for (const input of directItemInputs(list)) {
        const key = input.dataset.dpcKey;
        store.removeItem(routeHash, key);
        delete routeState[key];
        // restore the Markdown default
        input.checked = input.hasAttribute('data-dpc-default');
      }
      updateProgressForList(list, cfg.progressText);
      const ctx = pageContext();
      completeMemo.set(routeHash, ctx.total > 0 && ctx.done === ctx.total);
      safeCall(cfg.onChange, { ...ctx, item: null });
    };

    document.addEventListener('change', delegated.change);
    document.addEventListener('click', delegated.click);
  });

  hook.doneEach(() => {
    // Progress text is baked after insertion (same tick -> no flicker).
    if (cfg.progress) updateAllProgress(document, cfg.progressText);
    const { done, total } = countForPage(document);
    completeMemo.set(routeHash, total > 0 && done === total);
  });

  function itemContext(input) {
    return {
      key: input.dataset.dpcKey,
      checked: input.checked,
      label: (input.parentElement && input.parentElement.textContent.trim()) || '',
    };
  }

  function pageContext() {
    const { done, total } = countForPage(document);
    return { routePath: vm?.route?.path || '/', done, total };
  }
}

/** Route/key debugging helper exposed for tests & power users. */
persistentCheckbox._internals = { fnv1a32, countForList };

export default persistentCheckbox;
