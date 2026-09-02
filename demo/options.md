# Options & usage

## Install

### CDN (recommended)

**One line, zero config** — the plugin auto-enables itself with defaults
(progress bar + 🔄 reset) whatever the script order:

```html
<script src="https://gllmar.github.io/docsify-persistant-checkbox/docsify-plugin-persistent-checkbox.js"></script>
```

Full example with optional customization:

```html
<!-- 1. docsify config (optional — customization or `false` to disable) -->
<script>
  window.$docsify = {
    persistentCheckbox: {
      // any options, see below
    },
  };
</script>
<!-- 2. docsify -->
<script src="https://cdn.jsdelivr.net/npm/docsify@5"></script>
<!-- 3. this plugin, from our GitHub Pages upstream -->
<script src="https://gllmar.github.io/docsify-persistant-checkbox/docsify-plugin-persistent-checkbox.js"></script>
```

### npm / ESM

```js
import { persistentCheckbox } from 'docsify-plugin-persistent-checkbox';

window.$docsify = {
  plugins: [persistentCheckbox],
};
```

The plugin is enabled as soon as it's loaded (script tag **or** manual
registration); set `persistentCheckbox: false` to disable.

## All options

```js
window.$docsify = {
  persistentCheckbox: {
    storage: 'local',            // 'local' | 'session'
    keyStrategy: 'hash',         // 'hash' | 'index'
    namespace: 'docsify-pc',     // storage key prefix
    progress: true,              // theme-colored progress bar per task list
    progressText: '{done}/{total}', // text inside the bar
    resetButton: true,           // emoji reset button per task list
    resetIcon: '🔄',
    onChange(ctx) {},            // fires on every toggle / reset
    onPageComplete(ctx) {},      // fires once when a page becomes fully checked
  },
};
```

## Progress bar

Each task list gets its own progress bar:

- the **fill** uses the docsify theme color (`var(--theme-color)`, fallback `#42b983`)
- the **number** sits inside the bar (`{done}/{total}` template, configurable)
- the bar carries `role="progressbar"` with live `aria-valuenow`/`aria-valuemax`
- the 🔄 button (configurable emoji) sits **left of the bar** and restores the
  Markdown defaults for that list only

## Key stability semantics

- Default strategy `hash`: an item's identity is the **hash of its visible text**.
  Reordering or inserting items preserves state. Renaming an item resets its state.
- Pin a stable identity with an invisible marker: `- [ ] My exercise {#ex-1}`.
  The marker is stripped from the rendered label and survives renames.
- `index` strategy keys items positionally (fragile across edits).

## Callback context

```js
onChange({
  routePath: '/demo/exercises',
  done: 2, total: 5,
  item: { key: 'a1b2c3d4', checked: true, label: 'Do the thing' },
  // item is null when the change came from a reset button
})
```

`onPageComplete(ctx)` receives the same context **without** `item`, and fires
only on the transition to fully-checked (not again on reload).
