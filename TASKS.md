# TASKS — docsify-plugin-persistent-checkbox

> Ordered; each task is independently verifiable. Check off as completed.

## Phase 0 — Scaffold ✅
- [x] T0.1 `package.json` (type module, exports map, scripts: build/test/docs:serve), esbuild + vitest + happy-dom devDeps
- [x] T0.2 Directory skeleton: `src/ demo/ test/`, `.gitignore`
- [x] T0.3 esbuild config producing IIFE + ESM dist with banner comment

## Phase 1 — Core (green field, unit-tested) ✅
- [x] T1.1 `src/keys.js`: `fnv1a32`, `normalizeItemText`, `extractIdMarker`, `makeKeyGen` — 12 unit tests (FNV vectors, duplicates, `{#id}` stripping)
- [x] T1.2 `src/storage.js`: safe wrapper, route index, `clearKeys()` — 5 tests incl. throwing-storage degradation
- [x] T1.3 `src/dom.js`: `transformTaskLists()` + balanced list scan + counting helpers — 16 tests against real docsify@5 markup fixtures
- [x] T1.4 `src/progress.js`: per-list progress, `{done}/{total}` template, reset button, styles

## Phase 2 — Plugin wiring ✅
- [x] T2.1 `src/index.js`: option parsing, `afterEach` transform, delegated `change`/`click` listeners (re-init safe), callbacks with error containment
- [x] T2.2 Reset action: per-list clear, Markdown-default restore, progress rerender
- [x] T2.3 Storage-unavailable degradation path (warn once, session-only)

## Phase 3 — Tests ✅ (52 passing)
- [x] T3.1 Integration harness (docsify-like hooks + happy-dom): render → click → persist → restore
- [x] T3.2 SPA navigation isolation tests
- [x] T3.3 Reorder/insert preservation, duplicate independence, `{#id}` rename survival
- [x] T3.4 Options matrix: `storage: 'session'`, `keyStrategy: 'index'`, `progress`, `progressText`, `resetButton`
- [x] T3.5 Callback tests: context shape, transition-only `onPageComplete`, throwing handlers contained
- [x] T3.6 **E2E against real docsify@5 dist** in happy-dom (stubbed XHR): real markdown pipeline, real hash-router navigation

## Phase 4 — Demo & docs ✅
- [x] T4.1 Demo site at repo root (GitHub Pages ready): `index.html`, `.nojekyll`, `_sidebar.md`, `demo/exercises.md`, `demo/stress.md` (25-item lists, nesting, loose lists, `<details>`, ordered lists, entities, unicode, code fences), `demo/options.md`
- [x] T4.2 `README.md`: install (CDN + npm), options table, key-stability semantics, compat note (docsify@^5)
- [x] T4.3 `index.d.ts` for options + plugin registration

## Phase 5 — Release readiness
- [ ] T5.1 Manual acceptance checklist run (SPEC §5) against `npm run docs:serve` in a real browser
- [x] T5.2 Size check: 3.6 kB min+gzip ✅ (≤ 5 kB budget); zero runtime deps
- [x] T5.3 Lint/format, LICENSE, version `0.1.0`
