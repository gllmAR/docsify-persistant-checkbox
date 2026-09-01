# Exercises demo

Check the boxes below, then **reload the page or navigate away and back** — your progress is persisted in `localStorage`, scoped per page.

## Warm-up

- [ ] Read this page
- [ ] Enable the plugin in `index.html`
- [x] This one was pre-checked in Markdown (`[x]`) — you can uncheck it, that persists too

## Exercises

- [ ] Write a docsify plugin function `(hook, vm) => void`
- [ ] Register it in `window.$docsify.plugins`
- [ ] Test with a reload
- [ ] Test with a SPA navigation (sidebar link round-trip)

## Duplicates & stable IDs

These two items have the **same text** — they get independent state:

- [ ] Do the thing
- [ ] Do the thing

Renaming an item resets its state (the text *is* its identity) — unless you pin a stable ID with an invisible `{#id}` marker. Both items below were renamed but kept their state:

- [ ] My exercise got renamed but kept its state {#ex-a}
- [ ] Me too {#ex-b}

## Progress & reset

Each list shows its own `done/total` line. A **Reset** button restores the Markdown defaults for that list only.
