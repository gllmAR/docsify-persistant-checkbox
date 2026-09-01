// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { internals } from './load-plugin.js';
import {
  BASIC,
  ENTITIES_AND_FORMATTING,
  LOOSE,
  NESTED_AND_DUPES,
  ORDERED,
  renderDoc,
} from './fixtures.js';

const { fnv1a32, transformTaskLists, directItemInputs, countForList } = internals();

function parse(html) {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

function inputsOf(host) {
  return [...host.querySelectorAll('input[data-dpc-key]')];
}

describe('transformTaskLists', () => {
  it('enables checkboxes and tags keys (real docsify markup)', () => {
    const { html, count } = transformTaskLists(renderDoc(BASIC), {
      keyStrategy: 'hash',
      stored: {},
    });
    expect(count).toBe(3);
    const host = parse(html);
    const inputs = inputsOf(host);
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      expect(input.disabled).toBe(false);
      expect(input.getAttribute('type')).toBe('checkbox');
      expect(input.dataset.dpcKey).toBeTruthy();
    }
  });

  it('keys are text-derived: reordering does not change keys', () => {
    const t1 = transformTaskLists(renderDoc(BASIC), { keyStrategy: 'hash', stored: {} });
    const reordered = '- [ ] third\n- [x] seeded\n- [ ] first\n';
    const t2 = transformTaskLists(renderDoc(reordered), { keyStrategy: 'hash', stored: {} });
    expect(t1.keys.sort()).toEqual(t2.keys.sort());
  });

  it('duplicate texts get distinct stable keys', () => {
    const t = transformTaskLists(renderDoc(NESTED_AND_DUPES), { keyStrategy: 'hash', stored: {} });
    const dupKeys = t.keys.filter((k) => k.startsWith(fnv1a32('dup')));
    expect(dupKeys).toHaveLength(3);
    expect(new Set(dupKeys).size).toBe(3);
  });

  it('inserting a new item preserves existing keys', () => {
    const before = transformTaskLists(renderDoc(BASIC), { keyStrategy: 'hash', stored: {} });
    const after = transformTaskLists(renderDoc('- [ ] NEW\n' + BASIC), {
      keyStrategy: 'hash',
      stored: {},
    });
    for (const k of before.keys) expect(after.keys).toContain(k);
    expect(after.keys).toHaveLength(4);
  });

  it('{#id} marker: stripped from label, used as key, survives renames', () => {
    const before = transformTaskLists(renderDoc(NESTED_AND_DUPES), { keyStrategy: 'hash', stored: {} });
    expect(before.keys).toContain('id:stable-1');

    const renamed = NESTED_AND_DUPES.replace('marker {#stable-1}', 'completely different text now {#stable-1}');
    const after = transformTaskLists(renderDoc(renamed), { keyStrategy: 'hash', stored: {} });
    expect(after.keys).toContain('id:stable-1');

    const host = parse(before.html);
    expect(host.innerHTML).not.toContain('{#');
  });

  it('bakes restored state and records Markdown default', () => {
    const t1 = transformTaskLists(renderDoc(BASIC), { keyStrategy: 'hash', stored: {} });
    const [k1, k2] = t1.keys;
    const t2 = transformTaskLists(renderDoc(BASIC), {
      keyStrategy: 'hash',
      stored: { [k1]: true, [k2]: false },
    });
    const host = parse(t2.html);
    const [i1, i2, i3] = inputsOf(host);
    expect(i1.checked).toBe(true); // stored true
    expect(i2.checked).toBe(false); // stored false overrides seeded [x]
    expect(i2.hasAttribute('data-dpc-default')).toBe(true); // Markdown default was checked
    expect(i3.checked).toBe(false); // no state, source unchecked
  });

  it('handles nested task lists: keys independent, parent text excludes children', () => {
    const t = transformTaskLists(renderDoc(NESTED_AND_DUPES), { keyStrategy: 'hash', stored: {} });
    const host = parse(t.html);
    // 5 top + 1 nested = 6 inputs
    expect(inputsOf(host)).toHaveLength(6);
    const dupHash = fnv1a32('dup');
    const nestedKey = t.keys.find((k) => k === fnv1a32('nested child'));
    expect(nestedKey).toBeTruthy();
    expect(t.keys).toContain(dupHash);
  });

  it('handles ordered task lists (ol, start attr)', () => {
    const t = transformTaskLists(renderDoc(ORDERED), { keyStrategy: 'hash', stored: {} });
    const host = parse(t.html);
    expect(host.querySelector('ol[data-dpc-list]')).toBeTruthy();
    expect(host.querySelector('ol').getAttribute('start')).toBe('2');
    expect(inputsOf(host)).toHaveLength(2);
  });

  it('handles loose task lists (input inside <p>)', () => {
    const t = transformTaskLists(renderDoc(LOOSE), { keyStrategy: 'hash', stored: {} });
    expect(t.count).toBe(2);
    const host = parse(t.html);
    expect(inputsOf(host)).toHaveLength(2);
  });

  it('identity survives entities and inline formatting', () => {
    const t = transformTaskLists(renderDoc(ENTITIES_AND_FORMATTING), { keyStrategy: 'hash', stored: {} });
    // marked keeps raw inline HTML (<tag>) as a tag: it is stripped from identity.
    // decoded entity text ('a & b') participates in identity.
    expect(t.keys).toContain(fnv1a32('a & b "quoted"'));
    expect(t.keys).toContain(fnv1a32('bold and code'));
  });

  it('index strategy: positional keys', () => {
    const t = transformTaskLists(renderDoc(BASIC), { keyStrategy: 'index', stored: {} });
    expect(t.keys).toEqual(['0', '1', '2']);
  });

  it('adds a progress bar + emoji reset button before each task list when enabled', () => {
    const t = transformTaskLists(renderDoc(NESTED_AND_DUPES), {
      keyStrategy: 'hash',
      progress: true,
      resetButton: true,
      stored: {},
    });
    const host = parse(t.html);
    // one per list: outer + nested
    expect(host.querySelectorAll('[data-dpc-progress]')).toHaveLength(2);

    const bar = host.querySelector('.dpc-progress-bar');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.querySelector('.dpc-progress-fill')).toBeTruthy();

    const btn = host.querySelector('.dpc-progress-reset');
    expect(btn.textContent).toBe('🔄');
    expect(btn.getAttribute('aria-label')).toBe('Reset progress');
  });

  it('no progress nodes when disabled', () => {
    const t = transformTaskLists(renderDoc(BASIC), { keyStrategy: 'hash', stored: {} });
    expect(t.html).not.toContain('data-dpc-progress');
  });

  it('leaves non-task HTML untouched', () => {
    const html = '<p>hello</p><ul><li>plain</li></ul>';
    const t = transformTaskLists(html, { keyStrategy: 'hash', stored: {} });
    expect(t.html).toBe(html);
    expect(t.count).toBe(0);
  });
});

describe('DOM counting helpers', () => {
  it('countForList counts direct items only (nested excluded)', () => {
    const t = transformTaskLists(renderDoc(NESTED_AND_DUPES), {
      keyStrategy: 'hash',
      progress: true,
      stored: {},
    });
    const host = parse(t.html);
    const outer = host.querySelector('ul[data-dpc-list]');
    const nested = outer.querySelector('ul[data-dpc-list]');

    // check one direct + one nested
    inputsOf(host).find((i) => i.dataset.dpcKey === fnv1a32('dup')).checked = true;
    inputsOf(host).find((i) => i.dataset.dpcKey === fnv1a32('nested child')).checked = true;

    expect(countForList(outer)).toEqual({ done: 2, total: 5 }); // dup + seeded [x] default
    expect(countForList(nested)).toEqual({ done: 1, total: 1 });
  });

  it('directItemInputs works for loose lists', () => {
    const t = transformTaskLists(renderDoc(LOOSE), { keyStrategy: 'hash', stored: {} });
    const host = parse(t.html);
    const list = host.querySelector('[data-dpc-list]');
    expect(directItemInputs(list)).toHaveLength(2);
  });
});
