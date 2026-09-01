# docsify-plugin-persistent-checkbox

Persistent checkbox state for [Docsify 5](https://docsify.js.org) task lists.
Turn `- [ ]` exercise lists into self-validation progress trackers that survive
reloads and SPA navigation — zero dependencies, ~4 kB min+gzip.

```markdown
- [ ] Read the chapter
- [ ] Do exercise 1
- [x] Already done in the source
```

👉 **[Live demo & stress test](https://gllmar.github.io/docsify-persistant-checkbox)** (serve this repo root to try locally: `npm run docs:serve`)

## Features

- **Interactive** — removes the `disabled` Docsify puts on task-list checkboxes
- **Persistent** — per-page state in `localStorage` (or `sessionStorage`)
- **Edit-resilient keys** — item identity is the hash of its visible text:
  reordering/inserting items never loses progress; duplicate texts get
  independent state; pin a stable ID with an invisible `{#my-id}` marker
- **Markdown as default** — `[x]` in the source seeds checked; a user's stored
  choice always wins; Reset restores the Markdown defaults
- **Per-task-list progress** — `done/total` line per list (nested lists counted
  separately), accessible (`role="status"`, `aria-live="polite"`)
- **Callbacks** — `onChange` / `onPageComplete` (fires on completion transition only)
- **Degrades gracefully** — storage blocked ⇒ session-only checkboxes, one warning
- Docsify **5.x** (hooks verified against docsify@5.0.0 source), zero dependencies

## Install

```html
<script>
  window.$docsify = {
    persistentCheckbox: true, // or an options object — see below
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/docsify@5"></script>
<script src="https://cdn.jsdelivr.net/npm/docsify-plugin-persistent-checkbox@1/dist/docsify-plugin-persistent-checkbox.min.js"></script>
```

ESM:

```js
import { persistentCheckbox } from 'docsify-plugin-persistent-checkbox';

window.$docsify = {
  plugins: [persistentCheckbox],
  persistentCheckbox: true,
};
```

## Options

```js
window.$docsify = {
  persistentCheckbox: {
    storage: 'local',            // 'local' | 'session'
    keyStrategy: 'hash',         // 'hash' | 'index'
    namespace: 'docsify-pc',     // storage key prefix
    progress: false,             // per-task-list "done/total" line
    progressText: 'Progress: {done}/{total}',
    resetButton: false,          // reset button per task list
    resetLabel: 'Reset',
    onChange(ctx) {},            // every toggle / reset
    onPageComplete(ctx) {},      // once, when a page becomes fully checked
  },
};
```

`ctx`: `{ routePath, done, total, item }` where `item` is
`{ key, checked, label }` (`null` for reset-triggered changes).

## Key stability semantics

| Edit in the Markdown source             | User state            |
| --------------------------------------- | --------------------- |
| Reorder items                           | preserved             |
| Insert new items                        | preserved             |
| Rename an item                          | reset (text = identity) |
| Rename an item carrying `{#stable-id}`  | preserved             |

## Development

```bash
npm install
npm test          # 49 unit + integration tests (real marked + docsify@5 renderers)
npm run build     # dist/ (IIFE + ESM)
npm run docs:serve
```

Spec-driven development: see [SPEC.md](SPEC.md) (requirements & decisions),
[DESIGN.md](DESIGN.md) (technical design), [TASKS.md](TASKS.md) (task board).

## Roadmap

- Cross-tab sync via the `storage` event (~15 lines, no deps)
- Optional per-page progress summary

## License

MIT
