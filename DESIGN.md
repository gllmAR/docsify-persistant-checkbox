# DESIGN — docsify-plugin-persistent-checkbox

> Companion to [SPEC.md](SPEC.md). Verified against `docsify@5.0.0`.

## 1. Ground truth from Docsify 5 source

- v5 renders Markdown with **marked** (`marked@^18`). `src/core/render/compiler/taskListItem.js`
  wraps task items as:
  ```html
  <li class="task-list-item"><label><input type="checkbox" disabled> item text</label></li>
  ```
  (`<input … type="checkbox" …>` comes from marked's `checkbox` renderer, which
  emits `disabled`.)
- Plugin API (src/core/init/lifecycle.js): `init, mounted, beforeEach, afterEach,
  doneEach, ready`. A plugin is a function `(hook, vm) => void` pushed to
  `window.$docsify.plugins`. Hooks may be sync (return value replaces data) or
  use the `(data, next)` form. Errors are caught when `catchPluginErrors` is on
  (default on).
- Route path: `vm.route.path` (e.g. `/guide/exercises`), changes on SPA nav.
- v5 is ESM-first but ships `dist/docsify.js` (IIFE) — plugin should ship both
  ESM and IIFE builds.

## 2. Architecture

```
src/
  index.js        # plugin entry: option parsing, hook registration
  keys.js         # route-hash + item keys (FNV-1a, occurrence counter, {#id} override)
  storage.js      # safe storage wrapper (get/set/remove/bulk, try/catch)
  dom.js          # HTML transform (afterEach) + event delegation (mounted/doneEach)
  progress.js     # progress line + reset button rendering
```

Single plugin function, no state on `window` except the registration itself.
Per-page state is recomputed on every render (no caches to invalidate).

## 3. Data flow

```
afterEach(html, next)          DOM (content patched)      user clicks
  ├─ parse & tag checkboxes ─► ├─ restore state ─────────► ├─ delegated 'change'
  │  strip `disabled`, add     │  (read storage, set       │  handler on main content
  │  data-dpc-key,             │   checked before paint)   ├─ persist new state
  │  data-dpc-text             │                           ├─ update progress DOM
  └─ (keyStrategy/ids)         └─ render progress line     └─ fire callbacks
```

### 3.1 HTML transform — `afterEach` hook (string, sync)

Regex/`DOMParser`-free approach: we transform the **HTML string** so no
re-serialization fidelity issues arise:

1. Match task items: `<li class="task-list-item"><label>(<input[^>]*type="checkbox"[^>]*>)\s*(rest)</li>`.
2. For each occurrence (per page render):
   - Extract item text = `rest` with tags stripped, normalized
     (trim, collapse whitespace).
   - Pull `{#my-id}` marker out of the text if present (regex `\{#([\w-]+)\}`),
     remove it from the label HTML, use it as the key.
   - Compute key per `keyStrategy`:
     - `hash`: `fnv1a32(normalizedText).toString(16)` + (`#k` for k-th duplicate)
     - `index`: occurrence index `i`
   - Emit input as: `<input type="checkbox" data-dpc-key="<key>">`
     (drop `disabled`; keep `checked` from Markdown — it becomes the default).
3. If `progress` enabled, prepend a progress placeholder node before **every**
   task list (per-list progress — resolved decision).

Running in `afterEach` (rather than `doneEach` DOM surgery) means the restored
state can be applied the moment content is inserted → **no flicker**: the
`mounted`/`doneEach` handler reads storage and patches the freshly inserted
inputs in the same tick Docsify calls it.

### 3.2 Events — `mounted` + delegation

- One `change` listener (delegated, `document`-level, registered once in
  `mounted`) plus one `click` listener for reset buttons.
- Handler: `event.target` matches `input[type=checkbox][data-dpc-key]` →
  persist `{key: checked}` for current route; update progress; fire callbacks.
- No per-item listeners → survives `doneEach` content swaps, works inside
  `<details>` and other plugin containers.
- Keyboard accessibility comes free: native inputs inside `<label>` are
  space-toggleable.

### 3.3 Storage layer — `storage.js`

- `safeGet(backend, key)` / `safeSet` / `safeRemove` — all wrapped in
  try/catch; first failure logs one `[persistent-checkbox] storage unavailable`
  warning and flips a module flag so later calls are no-ops (no log spam).
- `storage: 'local' | 'session'` maps to `localStorage` / `sessionStorage`
  (guard `typeof Storage !== 'undefined'`).
- Key format: `<namespace>:<routeHash>:<itemKey>`.
- Route hash: `fnv1a32(vm.route.path)` hex — keeps keys short and stable
  across base-path changes; store `routePath` once under
  `<namespace>:<routeHash>` meta key purely for the reset/debug tooling
  (also used to enumerate-and-delete on reset).
- Reading a page's state: enumerate via a per-route index key
  `<namespace>:<routeHash>:__keys__` (JSON array of item keys) — avoids
  full-storage scans.

### 3.4 Progress bar — theme color, number inside

- Per-task-list node inserted immediately before each
  `<ul|ol class="task-list">` (lists tagged `data-dpc-list` so the node can
  find its list as `nextElementSibling`):
  ```html
  <div class="dpc-progress" data-dpc-progress role="status" aria-live="polite">
    <button class="dpc-progress-reset" aria-label="Reset progress">🔄</button>
    <div class="dpc-progress-bar" role="progressbar" aria-valuemin="0"
         aria-valuemax="N" aria-valuenow="D">
      <div class="dpc-progress-fill" style="width:P%"></div>
      <span class="dpc-progress-text">D/N</span>
    </div>
  </div>
  ```
- The **fill** uses `var(--theme-color, #42b983)` so the bar adopts whatever
  docsify theme is active; the track is neutral translucent gray that works
  on light and dark themes; the number is centered inside the bar (white,
  subtle text-shadow for contrast at 0%).
- Counted with a "direct items only" DOM walk (`li.task-list-item > label >
  input`, or `> p > input` for loose lists) so nested task lists are not
  double-counted — they carry their own progress node.
- Filled in `doneEach` (same tick as content insertion → no flicker) and
  updated live on toggle / reset.
- Reset button: removes the stored keys of its list's direct items, restores
  each input to its Markdown default (`data-dpc-default` baked at transform
  time), updates the progress node. Nested lists are untouched.
- Text template `{done}`/`{total}` substitution; bar gets a
  `dpc-progress-complete` class when the list is fully checked.

## 4. Key algorithms

### FNV-1a 32-bit (no deps, fast, adequate distribution)
```js
function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
```

### Duplicate handling
Per render pass, maintain `Map<textHash, count>`; key = `hash` when count==1
else `hash#count`. Deterministic given identical document order → stable
across reloads. (Order-based, so hash strategy is stable under reordering of
*distinct* items; duplicates rely on stable relative order — documented.)

## 5. Edge cases & mitigations

| Case | Handling |
|---|---|
| Storage throws | degrade to session-only, one warn |
| Duplicate item text | occurrence counter suffix |
| Item renamed | new hash → new key (old key orphaned; lazily ignored) |
| `{#id}` present | id wins, marker stripped from label |
| `[x]` in source | `checked` kept as default; user change overrides via storage |
| Storage value not boolean (tampered) | coerce with `=== 'true'` / boolean check |
| `onChange` throws | try/catch, `console.error('[persistent-checkbox]', e)` |
| No task lists on page | all hooks no-op cheaply (regex miss) |
| Docsify search indexing | progress node uses `class`, search plugin indexes rendered text — acceptable (v5 search renders from md, not DOM → not affected) |
| Sidebar / navbar checkboxes | only transform content area HTML (afterEach covers content; nav is separate — out of scope) |

## 6. Build & packaging

- **No build step.** The product is a single vanilla-JS IIFE,
  `docsify-plugin-persistent-checkbox.js`, at the repo root — loaded with a
  plain `<script>` tag (script-tag, jsDelivr/gh, npm all work; `esm.js` is a
  one-line ESM wrapper; CommonJS guard included).
- Tests load that exact file (via `window.eval` in happy-dom) so CI covers
  the artifact users receive.
- Demo: `docs/` (docsify serve), `index.html` with plugin enabled, 2 pages
  with exercise lists (incl. duplicates + `{#id}` example).

## 7. Test strategy

- **Unit** (vitest, happy-dom): keys.js (FNV vectors, duplicates, `{#id}`),
  storage.js (mock storage throwing), HTML transform (fixture HTML strings).
- **Integration** (happy-dom + real docsify@5 ESM core): mount a docsify
  instance, assert rendered DOM, simulate clicks + storage, simulate SPA nav.
- **Manual**: `docsify serve docs` acceptance checklist from SPEC §5.

## 8. Risks

- `afterEach` string regex must track Docsify's exact task-list markup. If
  marked's `checkbox` output changes, transform fails open: checkboxes stay
  disabled. Mitigation: tolerant regex + a `doneEach` fallback that re-checks
  for untagged enabled-task inputs (cheap querySelectorAll guard) and logs a
  warning if the HTML transform missed everything.
- Docsify 5 is new; hook behavior may shift in 5.x patches → pin compat note
  in README (`docsify@^5.0.0`).
