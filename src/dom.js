/**
 * HTML transform (afterEach) + DOM helpers.
 *
 * Docsify 5 (marked@18) renders task lists in two shapes (verified against
 * docsify@5.0.0 src/core/render/compiler/taskList*.js + real marked output):
 *
 *  tight:  <ul class="task-list">
 *            <li class="task-list-item"><label><input disabled="" type="checkbox"> text</label></li>
 *          </ul>
 *  loose:  <ul> <li><p><input disabled="" type="checkbox"> text</p></li> </ul>
 *          (loose items get NO task-list-item class and NO label; mixed
 *          lists do get class="task-list")
 *
 * Both shapes are handled here. Nested task lists live INSIDE the parent
 * item's <label> (tight) and ordered lists keep their start attribute.
 */

import { fnv1a32, makeKeyGen, normalizeItemText } from './keys.js';
// tight item: <li class="task-list-item"><label><input ...>
// loose item: <li><p><input ...>   (docsify quirk: no label, no class)
const ITEM_RE =
  /(<li(?: class="task-list-item")?>(?:<label>)?(?:<p>)?<input)([^>]*type="checkbox"[^>]*)>(\s*)((?:(?!<\/?label|<\/?li[ >]|<\/?p[ >]|<[uo]l[ >])[\s\S])*)/g;

const MARKER_IN_HTML_RE = /\s*\{#([A-Za-z0-9_-]+)\}\s*/;

/**
 * Transform the rendered page HTML:
 *  - drop `disabled` from task-list checkboxes
 *  - bake restored state (checked) and Markdown default (data-dpc-default)
 *  - tag each input with data-dpc-key
 *  - tag each task list with data-dpc-list (balanced scan, nesting-safe)
 *  - insert a progress node before each task list (when enabled)
 *
 * @param {string} html
 * @param {object} opts
 * @param {'hash'|'index'} [opts.keyStrategy]
 * @param {boolean} [opts.progress]
 * @param {boolean} [opts.resetButton]
 * @param {string} [opts.resetLabel]
 * @param {Record<string, boolean>} [opts.stored]  route state: key -> checked
 * @returns {{ html: string, count: number, keys: string[] }}
 */
export function transformTaskLists(html, opts = {}) {
  const {
    keyStrategy = 'hash',
    progress = false,
    resetButton = false,
    resetLabel = 'Reset',
    stored = {},
  } = opts;

  const keyGen = makeKeyGen(keyStrategy);
  const keys = [];
  let count = 0;

  const out = html.replace(
    ITEM_RE,
    (match, inputOpen, attrs, gap, textFragment) => {
      count++;
      const sourceChecked = attrs.includes('checked');

      const { id, normalized } = normalizeItemText(textFragment);
      const identity = id
        ? `id:${id}`
        : fnv1a32(normalized || `${count}:${match.slice(0, 80)}`);
      const key = keyGen(identity);
      keys.push(key);

      // strip the {#id} marker from the visible label
      const cleanFragment = MARKER_IN_HTML_RE.test(textFragment)
        ? textFragment.replace(MARKER_IN_HTML_RE, ' ')
        : textFragment;

      const restored = Object.prototype.hasOwnProperty.call(stored, key)
        ? stored[key]
        : sourceChecked;

      let newAttrs = attrs
        .replace(/\s*disabled(?:="[^"]*")?/, '')
        .replace(/\s*checked(?:="[^"]*")?/, '');
      if (restored) newAttrs = ` checked=""${newAttrs}`;
      newAttrs = `${newAttrs} data-dpc-key="${key}"`;
      if (sourceChecked) newAttrs += ' data-dpc-default="1"';

      return `${inputOpen}${newAttrs}>${gap}${cleanFragment}`;
    },
  );

  return { html: count > 0 ? tagTaskLists(out, { progress, resetButton, resetLabel }) : out, count, keys };
}

/** Close-tag matcher for ul/ol (nesting-aware scan helper). */
const TAG_SCAN_RE = /<(\/?)(ul|ol)([^>]*)>/g;

/**
 * Tag task lists and insert progress nodes. A list is a "task list" if its
 * body contains a data-dpc-key input. Nesting-safe via depth tracking.
 */
function tagTaskLists(html, { progress, resetButton, resetLabel }) {
  /** @type {{pos: number, text: string}[]} */
  const edits = [];
  const openRe = /<(ul|ol)([^>]*)>/g;
  let m;

  while ((m = openRe.exec(html))) {
    // find the matching close tag for this list (tracks ul/ol nesting)
    const depths = { ul: 0, ol: 0 };
    let closeIdx = -1;
    let closeEnd = -1;
    TAG_SCAN_RE.lastIndex = m.index;
    let t;
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

    const body = html.slice(m.index, closeEnd);
    if (body.includes('data-dpc-key')) {
      if (progress) {
        edits.push({ pos: m.index, text: progressHtml(resetButton, resetLabel) });
      }
      // insert the list tag just before the opening tag's '>'
      edits.push({ pos: m.index + m[0].length - 1, text: ' data-dpc-list' });
    }
    // do NOT jump past closeEnd: nested lists must be processed too
  }

  edits.sort((a, b) => a.pos - b.pos);
  let result = '';
  let pos = 0;
  for (const e of edits) {
    result += html.slice(pos, e.pos) + e.text;
    pos = e.pos;
  }
  return result + html.slice(pos);
}

function progressHtml(resetButton, resetLabel) {
  const btn = resetButton
    ? `<button type="button" class="dpc-progress-reset">${escapeHtml(resetLabel)}</button>`
    : '';
  return (
    `<div class="dpc-progress" data-dpc-progress role="status" aria-live="polite">` +
    `<span class="dpc-progress-text"></span>${btn}</div>`
  );
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

/**
 * Collect the inputs of a list's DIRECT task items (nested task lists are
 * excluded — they have their own list/progress). Handles tight items
 * (`li > label > input`, `li > label > p > input`) and docsify's loose items
 * (`li > p > input`).
 */
export function directItemInputs(listEl) {
  const inputs = [];
  for (const li of listEl.children) {
    if (!(li instanceof Element) || li.tagName !== 'LI') continue;
    let container = li.children[0];
    if (container && container.tagName === 'LABEL') {
      let node = container.children[0];
      if (node && node.tagName === 'P') node = node.children[0];
      if (node && node.matches('input[data-dpc-key]')) inputs.push(node);
      continue;
    }
    // loose: <li><p><input ...>
    if (container && container.matches('input[data-dpc-key]')) inputs.push(container);
    else if (container && container.tagName === 'P') {
      const node = container.children[0];
      if (node && node.matches('input[data-dpc-key]')) inputs.push(node);
    }
    void container;
  }
  return inputs;
}

/** Find the progress node associated with a task list element. */
export function progressNodeFor(listEl) {
  const prev = listEl.previousElementSibling;
  return prev && prev.matches('[data-dpc-progress]') ? prev : null;
}

/**
 * Compute done/total for one list from the DOM.
 * @returns {{done: number, total: number}}
 */
export function countForList(listEl) {
  const inputs = directItemInputs(listEl);
  return { done: inputs.filter((i) => i.checked).length, total: inputs.length };
}

/**
 * Compute done/total across every transformed list in the document.
 * @returns {{done: number, total: number}}
 */
export function countForPage(root = document) {
  let done = 0;
  let total = 0;
  for (const list of root.querySelectorAll('[data-dpc-list]')) {
    const c = countForList(list);
    done += c.done;
    total += c.total;
  }
  return { done, total };
}
