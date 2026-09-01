# docsify-plugin-persistent-checkbox

Persistent checkbox state for [Docsify 5](https://docsify.js.org) task lists.
Turn `- [ ]` exercise lists into self-validation progress trackers that survive
reloads and SPA navigation.

**Pure vanilla JS — one file, no build step, zero dependencies**
(~24 kB source / ~7.5 kB gzipped — generously commented, no minifier needed).

```markdown
- [ ] Read the chapter
- [ ] Do exercise 1
- [x] Already done in the source
```

Each task list gets a **theme-colored progress bar** with the `done/total`
number inside, plus an optional **🔄 emoji reset button**:

```
[██████████░░░░░░░░░░]  3/10   🔄
```

👉 **[Live demo & stress test](https://gllmar.github.io/docsify-persistant-checkbox)** (serve this repo root to try locally: `npm run docs:serve`)

## Install

### From your repo (GitHub Pages) — no build, no npm

The plugin lives in the repo root (`docsify-plugin-persistent-checkbox.js`);
reference it directly, or hot-link it from GitHub through jsDelivr:

```html
<script>
  window.$docsify = {
    persistentCheckbox: true, // or an options object — see below
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/docsify@5"></script>
<!-- self-hosted: -->
<script src="./docsify-plugin-persistent-checkbox.js"></script>
<!-- or via jsDelivr from this repo's main branch: -->
<script src="https://cdn.jsdelivr.net/gh/gllmar/docsify-persistant-checkbox@main/docsify-plugin-persistent-checkbox.js"></script>
```

### npm / ESM

```js
import { persistentCheckbox } from 'docsify-plugin-persistent-checkbox';
// (tiny wrapper around the same single file)

window.$docsify = {
  plugins: [persistentCheckbox],
  persistentCheckbox: true,
};
```

## Features

- **Interactive** — removes the `disabled` Docsify puts on task-list checkboxes
- **Persistent** — per-page state in `localStorage` (or `sessionStorage`)
- **Edit-resilient keys** — item identity is the hash of its visible text:
  reordering/inserting items never loses progress; duplicate texts get
  independent state; pin a stable ID with an invisible `{#my-id}` marker
- **Markdown as default** — `[x]` in the source seeds checked; a user's stored
  choice always wins; 🔄 restores the Markdown defaults
- **Theme-colored progress bars** — one per task list (nested lists counted
  separately), number inside the bar, `role="progressbar"` + `aria-valuenow`,
  respects your docsify `--theme-color` variable
- **Callbacks** — `onChange` / `onPageComplete` (fires on completion transition only)
- **Degrades gracefully** — storage blocked ⇒ session-only checkboxes, one warning
- Docsify **5.x** (hooks verified against docsify@5.0.0 source), zero dependencies

## Options

```js
window.$docsify = {
  persistentCheckbox: {
    storage: 'local',            // 'local' | 'session'
    keyStrategy: 'hash',         // 'hash' | 'index'
    namespace: 'docsify-pc',     // storage key prefix
    progress: false,             // theme-colored progress bar per task list
    progressText: '{done}/{total}', // text inside the bar
    resetButton: false,          // emoji reset button per task list
    resetIcon: '🔄',              // any emoji/character
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
npm test          # 54 tests — unit, integration, and e2e vs the real docsify@5 dist
npm run docs:serve
```

There is **no build step**: `docsify-plugin-persistent-checkbox.js` in the repo
root *is* the product. The test suite loads that exact file.

Spec-driven development: see [SPEC.md](SPEC.md) (requirements & decisions),
[DESIGN.md](DESIGN.md) (technical design), [TASKS.md](TASKS.md) (task board).

## Roadmap

- Cross-tab sync via the `storage` event (~15 lines, no deps)

## License

MIT
