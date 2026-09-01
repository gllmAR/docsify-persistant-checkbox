# Stress test

This page hammers the plugin's assumptions: many items, duplicates, nesting, loose lists (blank lines between items), raw HTML containers, entities, formatting, unicode, and multiple lists per page.

## 1. Long list (25 items)

- [ ] Item 01 — lorem ipsum dolor sit amet
- [ ] Item 02 — consectetur adipiscing elit
- [ ] Item 03 — sed do eiusmod tempor incididunt
- [ ] Item 04 — ut labore et dolore magna aliqua
- [ ] Item 05 — ut enim ad minim veniam
- [ ] Item 06 — quis nostrud exercitation ullamco
- [ ] Item 07 — laboris nisi ut aliquip ex ea commodo
- [ ] Item 08 — duis aute irure dolor in reprehenderit
- [ ] Item 09 — in voluptate velit esse cillum
- [ ] Item 10 — eu fugiat nulla pariatur 🎉
- [ ] Item 11 — 除yoruba 乂馮乂 unicode ✅
- [ ] Item 12 — "double quotes" & 'single quotes'
- [ ] Item 13 — a & b < rendered as text >
- [ ] Item 14 — **bold** _italic_ ~~strike~~
- [ ] Item 15 — inline `code` and [a link](https://docsify.js.org)
- [ ] Item 16 — repeated phrase
- [ ] Item 17 — repeated phrase
- [ ] Item 18 — repeated phrase
- [ ] Item 19 — trailing marker {#stress-a}
- [x] Item 20 — seeded checked {#stress-b}
- [ ] Item 21
- [ ] Item 22
- [ ] Item 23
- [ ] Item 24
- [ ] Item 25

## 2. Nested task lists (two levels)

- [ ] Parent A
  - [ ] Child A.1
  - [ ] Child A.2
    - [ ] Grandchild A.2.a
- [ ] Parent B
  - [ ] Child B.1

Each list (outer, inner, innermost) has its own progress line and counts only its direct items.

## 3. Loose list (blank lines between items)

Docsify/marked renders these *without* the usual `task-list-item` wrapper — the plugin handles them too:

- [ ] Loose one

- [ ] Loose two

- [x] Loose three (seeded)

## 4. Inside `<details>` (raw HTML block)

<details>
<summary>Open me — the checkboxes below must work</summary>

- [ ] Hidden checkbox one
- [ ] Hidden checkbox two

</details>

## 5. Ordered task list

2. [ ] Ordered item one (list starts at 2)
3. [ ] Ordered item two
4. [ ] Ordered item three

## 6. Code fences must not be touched

```
- [ ] this is inside a code fence, NOT a checkbox
<input disabled type="checkbox"> raw html here
```

- [ ] A checkbox right after the fence

## 7. Mixed content

| Exercise | Status |
| --- | --- |
| alpha | manual |

> Blockquote with a list:
>
> - [ ] Checkbox inside blockquote

1. Normal ordered item
2. Another one
   - [ ] Task item nested in a normal list

- [ ] Final item
