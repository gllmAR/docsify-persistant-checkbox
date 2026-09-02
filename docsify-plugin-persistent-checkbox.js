/*!
 * docsify-plugin-persistent-checkbox v0.2.0
 * Persistent, per-page checkbox state for Docsify 5 task lists.
 * Exercises, self-validation, progress tracking.
 *
 * Zero dependencies. No build step. Plain JS — load it with a <script> tag.
 *
 * Usage:
 *   <script>
 *     window.$docsify = { persistentCheckbox: true }; // or an options object
 *   </script>
 *   <script src=".../docsify-plugin-persistent-checkbox.js"></script>
 *
 * The plugin auto-registers itself into window.$docsify.plugins.
 * Manual ESM registration: import './esm.js' or use window.DocsifyPersistentCheckbox.
 *
 * License: MIT
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    storage: 'local', // 'local' | 'session'
    keyStrategy: 'hash', // 'hash' | 'index'
    namespace: 'docsify-pc',
    progress: true, // theme-colored progress bar per task list
    progressText: '{done}/{total}', // text inside the bar
    resetButton: true, // emoji reset button per task list
    resetIcon: '\uD83D\uDD04', // 🔄
    onChange: null, // (ctx) => void
    onPageComplete: null, // (ctx) => void
  };

  /**
   * Delegated listeners live at document level and must survive SPA
   * navigation. They are singletons so a re-init replaces (never
   * duplicates) them.
   */
  var delegated = {};

  /* ------------------------------------------------------------------ *
   * Keys & hashing — item identity
   * ------------------------------------------------------------------ */

  var FNV_OFFSET = 0x811c9dc5;

  /** FNV-1a 32-bit hash, zero-padded 8-char hex. */
  function fnv1a32(str) {
    var h = FNV_OFFSET;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    var out = h.toString(16);
    while (out.length < 8) out = '0' + out;
    return out;
  }

  var ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  function decodeEntities(str) {
    return str
      .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, function (m, name) {
        return ENTITIES['&' + name + ';'];
      })
      .replace(/&#(\d+);/g, function (m, code) {
        return String.fromCodePoint(Number(code));
      })
      .replace(/&#x([0-9a-fA-F]+);/g, function (m, code) {
        return String.fromCodePoint(parseInt(code, 16));
      });
  }

  function stripTags(str) {
    return str.replace(/<[^>]*>/g, '');
  }

  var MARKER_RE = /\s*\{#([A-Za-z0-9_-]+)\}\s*/;

  /** Extract a `{#my-id}` identity marker from raw item text. */
  function extractIdMarker(rawText) {
    var m = rawText.match(MARKER_RE);
    if (!m) return { id: null, text: rawText };
    return { id: m[1], text: rawText.replace(MARKER_RE, ' ') };
  }

  /**
   * Normalize an item's raw HTML fragment into canonical identity text:
   * strip tags (inline tags keep their content), decode entities, strip
   * {#id} markers, collapse whitespace.
   */
  function normalizeItemText(rawHtmlFragment) {
    var r = extractIdMarker(decodeEntities(stripTags(rawHtmlFragment)));
    return { id: r.id, normalized: r.text.replace(/\s+/g, ' ').trim() };
  }

  /**
   * Page-scoped key generator; call once per task item in document order.
   * 'hash': identity text hash, duplicates get deterministic `#n` suffixes.
   * 'index': positional keys (fragile across edits).
   */
  function makeKeyGen(strategy) {
    if (strategy === 'index') {
      var i = 0;
      return function () {
        return String(i++);
      };
    }
    var seen = {};
    return function (identity) {
      var count = (seen[identity] || 0) + 1;
      seen[identity] = count;
      return count === 1 ? identity : identity + '#' + count;
    };
  }

  function routeHashKey(path) {
    return fnv1a32(path || '/');
  }

  /* ------------------------------------------------------------------ *
   * Safe storage — degrades to session-only interactivity
   * ------------------------------------------------------------------ */

  var ROUTE_INDEX_SUFFIX = '__keys__';

  function createStore(opts) {
    opts = opts || {};
    var ns = opts.namespace || 'docsify-pc';
    var warn = opts.warn || function (msg) { console.warn(msg); };
    var backend = null;
    var unavailable = false;

    try {
      if (typeof Storage !== 'undefined') {
        backend = opts.storage === 'session'
          ? global.sessionStorage
          : global.localStorage;
        if (backend) backend.getItem('__dpc_probe__'); // may throw in private mode
      }
    } catch (e) {
      backend = null;
    }

    if (!backend) {
      unavailable = true;
      warn('[persistent-checkbox] storage unavailable — checkbox state will not persist');
    }

    function guard(fn) {
      if (unavailable) return;
      try {
        fn(backend);
      } catch (err) {
        unavailable = true;
        warn('[persistent-checkbox] storage unavailable — checkbox state will not persist');
        if (console.debug) console.debug(err);
      }
    }

    function keyOf(routeHash, itemKey) {
      return ns + ':' + routeHash + ':' + itemKey;
    }
    function indexKey(routeHash) {
      return ns + ':' + routeHash + ':' + ROUTE_INDEX_SUFFIX;
    }

    return {
      get available() {
        return !unavailable;
      },

      /** @returns {Object<string, boolean>} itemKey -> checked */
      getRouteState: function (routeHash) {
        if (unavailable) return {};
        try {
          var rawIndex = backend.getItem(indexKey(routeHash));
          if (!rawIndex) return {};
          var keys;
          try {
            keys = JSON.parse(rawIndex);
          } catch (e) {
            return {};
          }
          if (!Array.isArray(keys)) return {};
          var state = {};
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (typeof k !== 'string') continue;
            var v = backend.getItem(keyOf(routeHash, k));
            if (v === '1') state[k] = true;
            else if (v === '0') state[k] = false;
          }
          return state;
        } catch (e) {
          return {};
        }
      },

      setItem: function (routeHash, itemKey, checked) {
        guard(function (store) {
          store.setItem(keyOf(routeHash, itemKey), checked ? '1' : '0');
          var keys = [];
          try {
            var raw = store.getItem(indexKey(routeHash));
            keys = raw ? JSON.parse(raw) : [];
          } catch (e) {
            keys = [];
          }
          if (Array.isArray(keys) && keys.indexOf(itemKey) === -1) {
            keys.push(itemKey);
            store.setItem(indexKey(routeHash), JSON.stringify(keys));
          }
        });
      },

      removeItem: function (routeHash, itemKey) {
        guard(function (store) {
          store.removeItem(keyOf(routeHash, itemKey));
          try {
            var raw = store.getItem(indexKey(routeHash));
            var keys = raw ? JSON.parse(raw) : [];
            if (Array.isArray(keys)) {
              var next = [];
              for (var i = 0; i < keys.length; i++) {
                if (keys[i] !== itemKey) next.push(keys[i]);
              }
              store.setItem(indexKey(routeHash), JSON.stringify(next));
            }
          } catch (e) {
            /* index cleanup is best-effort */
          }
        });
      },

      /** Remove the given item keys for a route (other routes untouched). */
      clearKeys: function (routeHash, itemKeys) {
        guard(function (store) {
          for (var i = 0; i < itemKeys.length; i++) {
            store.removeItem(keyOf(routeHash, itemKeys[i]));
          }
          store.removeItem(indexKey(routeHash));
        });
      },
    };
  }

  /* ------------------------------------------------------------------ *
   * HTML transform (docsify afterEach) + DOM helpers
   * ------------------------------------------------------------------ */

  // tight item: <li class="task-list-item"><label><input ...>
  // loose item: <li><p><input ...>   (docsify/marked quirk: no label, no class)
  var ITEM_RE =
    /(<li(?: class="task-list-item")?>(?:<label>)?(?:<p>)?<input)([^>]*type="checkbox"[^>]*)>(\s*)((?:(?!<\/?label|<\/?li[ >]|<\/?p[ >]|<[uo]l[ >])[\s\S])*)/g;

  var MARKER_IN_HTML_RE = /\s*\{#([A-Za-z0-9_-]+)\}\s*/;
  var TAG_SCAN_RE = /<(\/?)(ul|ol)([^>]*)>/g;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /**
   * Transform rendered page HTML:
   *  - drop `disabled` from task-list checkboxes
   *  - bake restored state (checked) and Markdown default (data-dpc-default)
   *  - tag each input with data-dpc-key
   *  - tag each task list with data-dpc-list (nesting-safe balanced scan)
   *  - insert a progress bar node before each task list (when enabled)
   */
  function transformTaskLists(html, opts) {
    opts = opts || {};
    var keyStrategy = opts.keyStrategy || 'hash';
    var progress = !!opts.progress;
    var resetButton = !!opts.resetButton;
    var resetIcon = opts.resetIcon || DEFAULTS.resetIcon;
    var stored = opts.stored || {};

    var keyGen = makeKeyGen(keyStrategy);
    var keys = [];
    var count = 0;

    var out = html.replace(
      ITEM_RE,
      function (match, inputOpen, attrs, gap, textFragment) {
        count++;
        var sourceChecked = attrs.indexOf('checked') !== -1;

        var norm = normalizeItemText(textFragment);
        var identity = norm.id
          ? 'id:' + norm.id
          : fnv1a32(norm.normalized || count + ':' + match.slice(0, 80));
        var key = keyGen(identity);
        keys.push(key);

        // strip the {#id} marker from the visible label
        var cleanFragment = MARKER_IN_HTML_RE.test(textFragment)
          ? textFragment.replace(MARKER_IN_HTML_RE, ' ')
          : textFragment;

        var restored = Object.prototype.hasOwnProperty.call(stored, key)
          ? stored[key]
          : sourceChecked;

        var newAttrs = attrs
          .replace(/\s*disabled(?:="[^"]*")?/, '')
          .replace(/\s*checked(?:="[^"]*")?/, '');
        if (restored) newAttrs = ' checked=""' + newAttrs;
        newAttrs = newAttrs + ' data-dpc-key="' + key + '"';
        if (sourceChecked) newAttrs += ' data-dpc-default="1"';

        return inputOpen + newAttrs + '>' + gap + cleanFragment;
      },
    );

    if (count > 0) {
      out = tagTaskLists(out, {
        progress: progress,
        resetButton: resetButton,
        resetIcon: resetIcon,
      });
    }

    return { html: out, count: count, keys: keys };
  }

  /**
   * Tag task lists and insert progress bars. A list is a "task list" if its
   * body contains a data-dpc-key input. Nesting-safe via depth tracking;
   * position-based edits so nested lists are processed too.
   */
  function tagTaskLists(html, opts) {
    var edits = [];
    var openRe = /<(ul|ol)([^>]*)>/g;
    var m;

    while ((m = openRe.exec(html))) {
      var depths = { ul: 0, ol: 0 };
      var closeIdx = -1;
      var closeEnd = -1;
      TAG_SCAN_RE.lastIndex = m.index;
      var t;
      while ((t = TAG_SCAN_RE.exec(html))) {
        if (t[1]) {
          depths[t[2]]--;
          if (t[2] === m[1] && depths[t[2]] === 0) {
            closeIdx = t.index;
            closeEnd = TAG_SCAN_RE.lastIndex;
            break;
          }
        } else {
          depths[t[2]]++;
        }
      }
      if (closeIdx < 0) break; // malformed HTML: bail out, keep as-is

      var body = html.slice(m.index, closeEnd);
      if (body.indexOf('data-dpc-key') !== -1) {
        if (opts.progress) {
          edits.push({ pos: m.index, text: progressHtml(opts.resetButton, opts.resetIcon) });
        }
        // insert the list tag just before the opening tag's '>'
        edits.push({ pos: m.index + m[0].length - 1, text: ' data-dpc-list' });
      }
      // do NOT jump past closeEnd: nested lists must be processed too
    }

    edits.sort(function (a, b) {
      return a.pos - b.pos;
    });
    var result = '';
    var pos = 0;
    for (var i = 0; i < edits.length; i++) {
      result += html.slice(pos, edits[i].pos) + edits[i].text;
      pos = edits[i].pos;
    }
    return result + html.slice(pos);
  }

  function progressHtml(resetButton, resetIcon) {
    var btn = resetButton
      ? '<button type="button" class="dpc-progress-reset" title="Reset progress" ' +
        'aria-label="Reset progress">' +
        escapeHtml(resetIcon) +
        '</button>'
      : '';
    // emoji sits LEFT of the progress bar
    return (
      '<div class="dpc-progress" data-dpc-progress role="status" aria-live="polite">' +
      btn +
      '<div class="dpc-progress-bar" role="progressbar" aria-valuemin="0" ' +
      'aria-valuemax="0" aria-valuenow="0">' +
      '<div class="dpc-progress-fill" style="width:0%"></div>' +
      '<span class="dpc-progress-text"></span>' +
      '</div>' +
      '</div>'
    );
  }

  /**
   * Collect the inputs of a list's DIRECT task items (nested task lists are
   * excluded — they have their own list/progress). Handles tight items
   * (`li > label > input`, `li > label > p > input`) and loose items
   * (`li > p > input`).
   */
  function directItemInputs(listEl) {
    var inputs = [];
    var children = listEl.children;
    for (var i = 0; i < children.length; i++) {
      var li = children[i];
      if (!li || li.tagName !== 'LI') continue;
      var container = li.children[0];
      if (container && container.tagName === 'LABEL') {
        var node = container.children[0];
        if (node && node.tagName === 'P') node = node.children[0];
        if (node && node.matches('input[data-dpc-key]')) inputs.push(node);
        continue;
      }
      // loose: <li><p><input ...>
      if (container && container.matches('input[data-dpc-key]')) {
        inputs.push(container);
      } else if (container && container.tagName === 'P') {
        var inner = container.children[0];
        if (inner && inner.matches('input[data-dpc-key]')) inputs.push(inner);
      }
    }
    return inputs;
  }

  /** Find the progress node associated with a task list element. */
  function progressNodeFor(listEl) {
    var prev = listEl.previousElementSibling;
    return prev && prev.matches('[data-dpc-progress]') ? prev : null;
  }

  /** done/total for one list from the DOM. */
  function countForList(listEl) {
    var inputs = directItemInputs(listEl);
    var done = 0;
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) done++;
    }
    return { done: done, total: inputs.length };
  }

  /** done/total across every transformed list under `root`. */
  function countForPage(root) {
    root = root || document;
    var done = 0;
    var total = 0;
    var lists = root.querySelectorAll('[data-dpc-list]');
    for (var i = 0; i < lists.length; i++) {
      var c = countForList(lists[i]);
      done += c.done;
      total += c.total;
    }
    return { done: done, total: total };
  }

  /* ------------------------------------------------------------------ *
   * Progress bar (theme-colored) — per task list
   * ------------------------------------------------------------------ */

  function renderProgressText(template, done, total) {
    return String(template)
      .replace(/\{done\}/g, String(done))
      .replace(/\{total\}/g, String(total));
  }

  /** Render done/total into a list's progress bar (fill width + number). */
  function updateProgressForList(listEl, template) {
    var node = progressNodeFor(listEl);
    if (!node) return;
    var c = countForList(listEl);
    var bar = node.querySelector('.dpc-progress-bar');
    if (!bar) return;
    var pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
    bar.setAttribute('aria-valuemax', String(c.total));
    bar.setAttribute('aria-valuenow', String(c.done));
    var fill = bar.querySelector('.dpc-progress-fill');
    if (fill) fill.style.width = pct + '%';
    var text = bar.querySelector('.dpc-progress-text');
    if (text) text.textContent = renderProgressText(template, c.done, c.total);
    bar.classList.toggle('dpc-progress-complete', c.total > 0 && c.done === c.total);
  }

  /** Update every progress bar under `root` (defaults to document). */
  function updateAllProgress(root, template) {
    root = root || document;
    var lists = root.querySelectorAll('[data-dpc-list]');
    for (var i = 0; i < lists.length; i++) {
      updateProgressForList(lists[i], template);
    }
  }

  /** Minimal default styling, injected once. Uses the docsify theme color. */
  function injectStyles(doc) {
    doc = doc || document;
    if (doc.getElementById('dpc-styles')) return;
    var style = doc.createElement('style');
    style.id = 'dpc-styles';
    style.textContent = [
      '.dpc-progress{display:flex;align-items:center;gap:.55em;margin:.25em 0 .9em;}',
      '.dpc-progress-bar{position:relative;flex:1;min-width:8em;max-width:16em;height:1.25em;' +
        'background:rgba(128,128,128,.18);border-radius:.65em;overflow:hidden;}',
      '.dpc-progress-fill{height:100%;width:0;background:var(--theme-color,#42b983);' +
        'border-radius:.65em;transition:width .25s ease;}',
      '.dpc-progress-bar.dpc-progress-complete .dpc-progress-fill{opacity:.85;}',
      '.dpc-progress-text{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;' +
        'align-items:center;justify-content:center;font-size:.72em;font-weight:600;' +
        'color:#fff;text-shadow:0 0 3px rgba(0,0,0,.6);letter-spacing:.03em;}',
      '.dpc-progress-reset{cursor:pointer;font:inherit;font-size:1em;line-height:1;' +
        'background:none;border:none;padding:.05em .3em;border-radius:.3em;opacity:.7;' +
        'transition:opacity .15s ease,transform .15s ease;}',
      '.dpc-progress-reset:hover,.dpc-progress-reset:focus{opacity:1;transform:scale(1.15);}' +
        '.dpc-progress-reset:focus-visible{outline:2px solid var(--theme-color,#42b983);}',
      'li.task-list-item>label{cursor:pointer;}',
      'li.task-list-item>label>input[type="checkbox"],' +
        'li.task-list-item>label>p>input[type="checkbox"],' +
        'li>p>input[type="checkbox"]{cursor:pointer;margin-right:.35em;}',
    ].join('\n');
    doc.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Plugin entry
   * ------------------------------------------------------------------ */

  /**
   * Config resolution. Loading the script IS the opt-in: the plugin is
   * enabled with defaults unless `persistentCheckbox: false` is set.
   * `true` or an object merges over the defaults.
   */
  function normalizeConfig(raw) {
    if (raw === false || raw === null) return null; // explicit opt-out
    var opts = raw && typeof raw === 'object' ? raw : {};
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
    for (var k2 in opts) cfg[k2] = opts[k2];
    return cfg;
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
   * Docsify plugin entry: function(hook, vm).
   */
  function persistentCheckbox(hook, vm) {
    var raw = vm && vm.config && vm.config.persistentCheckbox;
    // loaded script = opt-in; only an explicit `false` disables
    var cfg = raw === false || raw === null ? null : normalizeConfig(raw);
    if (!cfg) return;

    var doc = (vm && vm.config && vm.config.el && document) || document;
    var store = createStore({ namespace: cfg.namespace, storage: cfg.storage });
    var routeHash = routeHashKey(vm && vm.route && vm.route.path);
    var routeState = {};
    /** routeHash -> was fully complete (for onPageComplete transition) */
    var completeMemo = {};

    function refreshRoute() {
      routeHash = routeHashKey(vm && vm.route && vm.route.path);
      routeState = store.getRouteState(routeHash);
    }

    hook.afterEach(function (html) {
      refreshRoute();
      var result = transformTaskLists(html, {
        keyStrategy: cfg.keyStrategy,
        progress: cfg.progress,
        resetButton: cfg.resetButton,
        resetIcon: cfg.resetIcon,
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

    hook.mounted(function () {
      injectStyles(doc);

      if (delegated.change) document.removeEventListener('change', delegated.change);
      if (delegated.click) document.removeEventListener('click', delegated.click);

      delegated.change = function (event) {
        var input = event.target;
        if (!input || input.tagName !== 'INPUT' || !input.dataset || !input.dataset.dpcKey) {
          return;
        }
        var key = input.dataset.dpcKey;
        routeState[key] = !!input.checked;
        store.setItem(routeHash, key, !!input.checked);

        var list = input.closest('[data-dpc-list]');
        if (list) updateProgressForList(list, cfg.progressText);

        var ctx = pageContext();
        safeCall(cfg.onChange, mixin(ctx, { item: itemContext(input) }));

        var isComplete = ctx.total > 0 && ctx.done === ctx.total;
        var wasComplete = completeMemo[routeHash] === true;
        if (isComplete && !wasComplete) safeCall(cfg.onPageComplete, ctx);
        completeMemo[routeHash] = isComplete;
      };

      delegated.click = function (event) {
        var target = event.target;
        var btn = target && target.closest && target.closest('.dpc-progress-reset');
        if (!btn) return;
        var progress = btn.closest('[data-dpc-progress]');
        var list = progress && progress.nextElementSibling;
        if (!list || !list.matches('[data-dpc-list]')) return;

        var inputs = directItemInputs(list);
        for (var i = 0; i < inputs.length; i++) {
          var input = inputs[i];
          var key = input.dataset.dpcKey;
          store.removeItem(routeHash, key);
          delete routeState[key];
          // restore the Markdown default
          input.checked = input.hasAttribute('data-dpc-default');
        }
        updateProgressForList(list, cfg.progressText);
        var ctx = pageContext();
        completeMemo[routeHash] = ctx.total > 0 && ctx.done === ctx.total;
        safeCall(cfg.onChange, mixin(ctx, { item: null }));
      };

      document.addEventListener('change', delegated.change);
      document.addEventListener('click', delegated.click);
    });

    hook.doneEach(function () {
      // Progress bars are filled after content insertion (same tick -> no flicker).
      if (cfg.progress) updateAllProgress(document, cfg.progressText);
      var c = countForPage(document);
      completeMemo[routeHash] = c.total > 0 && c.done === c.total;
    });

    function itemContext(input) {
      return {
        key: input.dataset.dpcKey,
        checked: input.checked,
        label:
          (input.parentElement && input.parentElement.textContent.trim()) || '',
      };
    }

    function pageContext() {
      var c = countForPage(document);
      return {
        routePath: (vm && vm.route && vm.route.path) || '/',
        done: c.done,
        total: c.total,
      };
    }
  }

  function mixin(base, extra) {
    var out = {};
    for (var k in base) out[k] = base[k];
    for (var k2 in extra) out[k2] = extra[k2];
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Export & registration (script tag / CommonJS / ESM wrapper)
   * ------------------------------------------------------------------ */

  persistentCheckbox.normalizeConfig = normalizeConfig;
  persistentCheckbox.version = '0.2.0';
  persistentCheckbox._internals = {
    // keys
    fnv1a32: fnv1a32,
    decodeEntities: decodeEntities,
    stripTags: stripTags,
    extractIdMarker: extractIdMarker,
    normalizeItemText: normalizeItemText,
    makeKeyGen: makeKeyGen,
    routeHashKey: routeHashKey,
    // storage
    createStore: createStore,
    // dom
    transformTaskLists: transformTaskLists,
    directItemInputs: directItemInputs,
    progressNodeFor: progressNodeFor,
    countForList: countForList,
    countForPage: countForPage,
    // progress
    renderProgressText: renderProgressText,
    updateProgressForList: updateProgressForList,
    updateAllProgress: updateAllProgress,
    // config
    normalizeConfig: normalizeConfig,
  };

  global.DocsifyPersistentCheckbox = persistentCheckbox;

  /**
   * Auto-register into the docsify config. Single-line usage:
   *   <script src=".../docsify-plugin-persistent-checkbox.js"></script>
   * Works whether this script tag comes before or after the $docsify
   * config block (docsify only reads plugins at init, on DOM ready).
   */
  function register() {
    if (!global.$docsify) return false;
    var plugins = global.$docsify.plugins || (global.$docsify.plugins = []);
    if (plugins.indexOf(persistentCheckbox) === -1) plugins.push(persistentCheckbox);
    return true;
  }

  if (!register()) {
    var doc = global.document;
    if (doc && doc.addEventListener) {
      var onReady = function () {
        doc.removeEventListener('DOMContentLoaded', onReady);
        register();
      };
      doc.addEventListener('DOMContentLoaded', onReady);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = persistentCheckbox;
  }
})(
  typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
      ? globalThis
      : this,
);
