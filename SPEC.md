# SPEC — docsify-plugin-persistent-checkbox

> Spec-Driven Development. Status: **APPROVED** (v1 decisions locked, see §6)
> Target: Docsify **5.x** (verified against `docsify@5.0.0` source)

## 1. Problem

Docsify renders Markdown task lists (`- [ ] item`) as checkbox inputs, but they
are `disabled` and their state resets on every page navigation. Users cannot
use them to track progress (e.g. self-validated exercises in a tutorial).

## 2. Goal

A zero-dependency Docsify 5 plugin that makes task-list checkboxes
**interactive** and **persistent** across page reloads and route navigation,
scoped per page, with optional progress feedback.

### Non-goals (v1)

- Server-side / cross-device sync (localStorage only).
- Editing the Markdown source state (`[x]` ↔ `[ ]`) in the `.md` file.
- Support for Docsify ≤ 4 (best-effort only, not tested).

## 3. User stories

1. As a reader, I check an exercise checkbox; after navigating away and back
   (or after a full reload), it is still checked.
2. As a reader, I see how many items I completed on the page (optional,
   configurable), e.g. `Progress: 3/10`.
3. As a docs author, I enable the plugin with one line in `window.$docsify`
   and need zero Markdown changes.
4. As a docs author, I can offer a "Reset progress" affordance per page
   (optional, opt-in).
5. As a plugin author integrating further, I can subscribe to change events
   (callback) to react to completion (e.g. confetti, unlock next chapter).

## 4. Functional requirements

### FR1 — Enable interactivity
- All task-list checkboxes rendered by Docsify on content pages become
  clickable (`disabled` attribute removed).
- Clicking toggles the checked state immediately.

### FR2 — Persist state
- State is persisted in `localStorage` (default) or `sessionStorage` (option).
- Scope of a key: **page route + item identity** (see FR4).
- State is restored after every route render (SPA navigation and reload).

### FR3 — Storage namespace
- All keys live under a configurable namespace, default `docsify-pc`.
- Key format: `<namespace>:<route-hash>:<item-key>`
  (`route-hash` avoids oversized/odd keys from long paths).

### FR4 — Item identity (stable across edits)
- Default strategy `hash` (default): item key = fast non-crypto hash (FNV-1a,
  32-bit, hex) of the **normalized item text** + an occurrence counter for
  duplicate texts on the same page (`#2`, `#3`, …).
  - Reordering items in the list must NOT lose state.
  - Inserting a new item before others must NOT lose their state.
  - Renaming an item's text intentionally resets its state (documented
    behavior — text *is* the identity).
- Optional strategy `index`: positional (`0`, `1`, …) — faster but fragile;
  provided for authors who prefer it.
- Optional per-item explicit override: authors may append an invisible marker
  `{#exercise-1}` in the item text; the plugin strips it from the visible
  label and uses `exercise-1` as the key (survives text edits).

### FR5 — Options (`window.$docsify.persistentCheckbox`)

| Option          | Type      | Default            | Description |
|-----------------|-----------|--------------------|-------------|
| `storage`       | `'local' \| 'session'` | `'local'` | Storage backend |
| `keyStrategy`   | `'hash' \| 'index'`    | `'hash'`  | Item identity strategy |
| `namespace`     | `string`  | `'docsify-pc'`     | Storage key prefix |
| `progress`      | `boolean \| object` | `true`  | Theme-colored progress bar per task list, number inside |
| `progressText`  | `string`  | `'{done}/{total}'` | Text inside the bar |
| `resetButton`   | `boolean` | `true`             | Render an emoji reset button per task list |
| `resetIcon`     | `string`  | `'🔄'`              | Emoji/character for the reset button |
| `onChange`      | `(ctx) => void` | —            | Called after any toggle. `ctx = { routePath, done, total, item: {key, text, checked} }` |
| `onPageComplete`| `(ctx) => void` | —            | Called once when `done === total` (and only then) |

- The plugin is **enabled with defaults as soon as the script is loaded**
  (single-line install): loading the script IS the opt-in. The config key is
  optional customization; `persistentCheckbox: false` explicitly disables.
- Registration must work whatever the script order (before or after the
  `$docsify` config block and the docsify script).

### FR6 — Progress display (when `progress` enabled)
- **One progress bar per task list** (decision §6.1): a theme-colored fill
  (`var(--theme-color)`) in a rounded track, with the `done/total` number
  rendered **inside** the bar; accessible (`role="progressbar"`,
  `aria-valuenow`/`aria-valuemax`, wrapped in `role="status" aria-live="polite"`).
- Nested task lists get their own bar; direct items only are counted.
- Updates live on every toggle.
- If `resetButton` is enabled, an **emoji button** (default 🔄, configurable)
  restores the stored keys of the task list it belongs to (nested lists keep
  their state).

### FR7 — Events / callbacks
- `onChange` fires on every user toggle (after persistence).
- `onPageComplete` fires on the transition to fully-complete only,
  **triggered by user interaction** (not re-fired on subsequent loads of an
  already-complete page).
- Callbacks must never break rendering when they throw (wrapped in try/catch,
  errors logged via `console.error` with a `[persistent-checkbox]` prefix).

### FR8 — Resilience
- Storage unavailable (Safari private mode, disabled cookies): plugin must
  degrade to plain interactive checkboxes (session-only state), no crashes,
  a single `console.warn`.
- Duplicate item texts on one page: each gets its own independent state
  (occurrence counter).
- Items inside collapsed/embedded contexts (e.g. in `<details>`, tabs from
  other plugins) still work — delegation-based events, no per-element
  listeners at render time.

### FR9 — Docsify lifecycle correctness
- Works across SPA navigation: re-applies on every route (`doneEach`/post-
  render), including the initial load.
- Restored state is applied **before paint of the interaction** as much as the
  Docsify lifecycle allows (state applied in the same tick the content is
  patched, no visible flicker requirement — see Design).

## 5. Acceptance criteria

All verified by the automated suite (`npx vitest run`, 55 tests) unless noted:

- [x] Demo page: check boxes → reload → state restored; progress bar reflects `done/total` (integration + e2e vs real docsify@5 dist)
- [x] SPA navigation to another page and back preserves state (integration, e2e hash-router)
- [x] Reordering/inserting items preserves state for untouched items; hash strategy (unit + integration)
- [x] Duplicate-text items behave independently (unit + integration)
- [x] `keyStrategy: 'index'` and `storage: 'session'` options work (integration)
- [x] `{#id}` override: rename item text with an id marker → state preserved (unit + integration)
- [x] With storage blocked, page renders, checkboxes toggle, warn logged once (storage degradation tests)
- [x] Reset (🔄) clears only its task list's keys, restores Markdown defaults (integration)
- [x] `onChange`/`onPageComplete` receive the documented context; throwing handlers contained; `onPageComplete` fires on transition only (integration)
- [x] Zero dependencies; single vanilla file ~24 kB source / ~8 kB gzip, no build step; ESM wrapper shipped (`esm.js`)
- [x] Single-line install via GitHub Pages upstream; auto-registration order-independent; enabled by default, `false` disables (e2e script-tag path)
- [x] (human, confirmed) visual click-through of the live demo in a real browser — user verified 2025

## 6. Resolved decisions

1. **Progress scope** → one summary per task list (nested lists counted
   separately).
2. **`[x]` seeding** → yes: source Markdown is the default state; stored user
   overrides win. A "reset" restores the Markdown default.
3. **Cross-tab sync** → deferred post-v1. Planned approach: `storage` event
   listener (~15 lines, no polling, no deps) that re-reads changed keys and
   patches the matching checkbox + progress. BroadcastChannel only if
   same-document iframe sync is ever needed; IndexedDB is over-engineering
   for this data.
4. **Demo hosting** → GitHub Pages from repo root: root `index.html`, root
   `.nojekyll`, committed `dist/` builds, stress-test demo pages.
