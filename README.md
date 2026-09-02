# docsify-plugin-persistent-checkbox

Persistent checkbox state for [Docsify 5](https://docsify.js.org) task lists.
Turn `- [ ]` exercise lists into self-validation progress trackers that survive
reloads and SPA navigation.

**Pure vanilla JS — one file, no build step, zero dependencies** (~24 kB
source / ~7.5 kB gzipped).

```
🔄  [██████████░░░░░░░░░░]  3/10
```

👉 **[Live demo & stress test](https://gllmar.github.io/docsify-persistant-checkbox)**

## Install

One line, from this repo's GitHub Pages (works with any docsify site, any
script order):

```html
<script src="https://gllmar.github.io/docsify-persistant-checkbox/docsify-plugin-persistent-checkbox.js"></script>
```

That's it — the plugin enables itself with defaults. To customize or disable:

```html
<script>
  window.$docsify = {
    persistentCheckbox: { /* options below */ },
    // persistentCheckbox: false, // disable
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/docsify@5"></script>
<script src="https://gllmar.github.io/docsify-persistant-checkbox/docsify-plugin-persistent-checkbox.js"></script>
```

npm/ESM: `import { persistentCheckbox } from 'docsify-plugin-persistent-checkbox'`
(a one-line wrapper around the same file), then add it to `$docsify.plugins`.

## What you get

- **Interactive checkboxes** — removes the `disabled` Docsify puts on task lists
- **Persistent per page** — `localStorage` (or `sessionStorage`), scoped by route
- **Edit-resilient identity** — an item's key is the hash of its visible text:
  reordering/inserting items never loses progress; duplicate texts get
  independent state; pin a stable key with an invisible `{#my-id}` marker
- **Markdown is the default** — `[x]` in the source seeds checked; the user's
  stored choice always wins; 🔄 restores the Markdown defaults
- **Theme-colored progress bar per task list** — fill follows
  `var(--theme-color)`, number inside the bar, nested lists counted separately;
  `role="progressbar"` + live `aria-valuenow`/`aria-valuemax`
- **Callbacks** — `onChange` on every toggle/reset, `onPageComplete` on the
  transition to fully-checked (not re-fired on reload)
- **Degrades gracefully** — storage blocked ⇒ session-only checkboxes, one warning

Requires Docsify 5.x (hooks verified against docsify@5.0.0).

## Options

All optional, via `window.$docsify.persistentCheckbox`:

| Option | Default | Description |
| --- | --- | --- |
| `storage` | `'local'` | `'local'` or `'session'` |
| `keyStrategy` | `'hash'` | `'hash'` (text-derived, edit-resilient) or `'index'` (positional) |
| `namespace` | `'docsify-pc'` | Storage key prefix |
| `progress` | `true` | Progress bar per task list |
| `progressText` | `'{done}/{total}'` | Text inside the bar |
| `resetButton` | `true` | Emoji reset button per task list |
| `resetIcon` | `'🔄'` | Any emoji/character |
| `onChange(ctx)` | — | Every toggle / reset |
| `onPageComplete(ctx)` | — | Page becomes fully checked |

`ctx` = `{ routePath, done, total, item }` with
`item = { key, checked, label }` (`null` when triggered by reset).

## Key stability semantics

| Markdown edit | User state |
| --- | --- |
| Reorder items | preserved |
| Insert new items | preserved |
| Rename an item | reset (text = identity) |
| Rename an item carrying `{#stable-id}` | preserved |

## Development

```bash
npm install
npm test          # 55 tests — unit, integration, e2e vs real docsify@5 dist
npm run docs:serve
```

No build step: `docsify-plugin-persistent-checkbox.js` at the repo root *is*
the product, and the test suite loads that exact file.
See [SPEC.md](SPEC.md), [DESIGN.md](DESIGN.md), [TASKS.md](TASKS.md).

## Roadmap

- Cross-tab sync via the `storage` event (~15 lines, no deps)

## License

MIT
