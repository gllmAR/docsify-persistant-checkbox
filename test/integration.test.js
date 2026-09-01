// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fnv1a32 } from '../src/keys.js';
import { persistentCheckbox } from '../src/index.js';
import { BASIC, NESTED_AND_DUPES, renderDoc } from './fixtures.js';

/**
 * Minimal docsify-like harness:
 *  - a fake hook registrar capturing afterEach/mounted/doneEach
 *  - a fake vm with config + route
 *  - simulates a route render: afterEach(html) -> innerHTML -> doneEach()
 */
function createHarness(config) {
  const host = document.createElement('main');
  document.body.innerHTML = '';
  document.body.appendChild(host);

  const hooks = { afterEach: [], mounted: [], doneEach: [] };
  const hook = {
    afterEach: (fn) => hooks.afterEach.push(fn),
    mounted: (fn) => hooks.mounted.push(fn),
    doneEach: (fn) => hooks.doneEach.push(fn),
  };
  const vm = {
    config,
    route: { path: '/' },
  };
  persistentCheckbox(hook, vm);

  let rendered = null;
  return {
    vm,
    host,
    /** render a markdown source at a route */
    render(markdown, path) {
      if (path !== undefined) vm.route.path = path;
      let html = markdown;
      for (const fn of hooks.afterEach) html = fn(html) ?? html;
      host.innerHTML = html;
      for (const fn of hooks.doneEach) fn();
      rendered = html;
      return host;
    },
    mounted() {
      for (const fn of hooks.mounted) fn();
    },
    get rendered() {
      return rendered;
    },
  };
}

const inputs = (host) => [...host.querySelectorAll('input[data-dpc-key]')];

function toggle(input) {
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('plugin lifecycle (docsify-like integration)', () => {
  it('renders interactive checkboxes with restored state across reloads', () => {
    const app = createHarness({ persistentCheckbox: true });
    app.mounted();

    // first visit: toggle two boxes
    app.render(renderDoc(BASIC), '/lesson');
    const [a, b, c] = inputs(app.host);
    expect(a.disabled).toBe(false);
    toggle(a);
    toggle(c);

    // simulate reload: fresh harness, same storage
    const app2 = createHarness({ persistentCheckbox: true });
    app2.mounted();
    app2.render(renderDoc(BASIC), '/lesson');
    const [a2, b2, c2] = inputs(app2.host);
    expect(a2.checked).toBe(true); // stored user state
    expect(b2.checked).toBe(true); // Markdown default ([x] seeded), never toggled
    expect(c2.checked).toBe(true); // stored user state
  });

  it('isolates state per route', () => {
    const app = createHarness({ persistentCheckbox: true });
    app.mounted();
    app.render(renderDoc(BASIC), '/lesson-1');
    toggle(inputs(app.host)[0]);

    app.render(renderDoc(BASIC), '/lesson-2');
    const [s1, s2, s3] = inputs(app.host);
    expect(s1.checked).toBe(false);
    expect(s2.checked).toBe(true); // seeded default
    expect(s3.checked).toBe(false);

    app.render(renderDoc(BASIC), '/lesson-1');
    expect(inputs(app.host)[0].checked).toBe(true);
  });

  it('SPA navigation restores state without leakage', () => {
    const app = createHarness({ persistentCheckbox: true });
    app.mounted();
    app.render(renderDoc(BASIC), '/a');
    toggle(inputs(app.host)[0]);
    app.render(renderDoc('- [ ] other page'), '/b');
    expect(inputs(app.host)[0].checked).toBe(false);
    app.render(renderDoc(BASIC), '/a');
    expect(inputs(app.host)[0].checked).toBe(true);
  });

  it('reordering + inserting items preserves state (hash strategy)', () => {
    const app = createHarness({ persistentCheckbox: true });
    app.mounted();
    app.render(renderDoc(BASIC), '/ex');
    toggle(inputs(app.host)[0]); // 'first'

    const reordered = '- [ ] NEW inserted\n- [ ] third\n- [x] seeded\n- [ ] first\n';
    app.render(renderDoc(reordered), '/ex');
    const state = inputs(app.host).map((i) => i.checked);
    // 'first' keeps true, 'seeded' keeps its Markdown default true
    expect(state.filter(Boolean)).toHaveLength(2);
    const firstInput = inputs(app.host).find((i) =>
      i.dataset.dpcKey.startsWith(fnv1a32('first')),
    );
    expect(firstInput.checked).toBe(true);
  });

  it('duplicate texts behave independently', () => {
    const app = createHarness({ persistentCheckbox: true });
    app.mounted();
    app.render(renderDoc(NESTED_AND_DUPES), '/dups');
    const dups = inputs(app.host).filter((i) => i.dataset.dpcKey.startsWith(fnv1a32('dup')));
    expect(dups).toHaveLength(3);
    toggle(dups[1]);
    expect(dups.map((i) => i.checked)).toEqual([false, true, false]);
  });

  it('{#id} key survives text rename', () => {
    const app = createHarness({ persistentCheckbox: true });
    app.mounted();
    app.render(renderDoc(NESTED_AND_DUPES), '/ids');
    const stable = inputs(app.host).find((i) => i.dataset.dpcKey === 'id:stable-1');
    toggle(stable);

    const renamed = NESTED_AND_DUPES.replace('marker {#stable-1}', 'renamed label {#stable-1}');
    app.render(renderDoc(renamed), '/ids');
    const stable2 = inputs(app.host).find((i) => i.dataset.dpcKey === 'id:stable-1');
    expect(stable2.checked).toBe(true);
  });

  it('renders and updates per-list progress live', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(NESTED_AND_DUPES), '/p');

    const outerList = app.host.querySelector('ul[data-dpc-list]');
    const nestedList = outerList.querySelector('ul[data-dpc-list]');
    const outerProgress = outerList.previousElementSibling.querySelector('.dpc-progress-text');
    const nestedProgress = nestedList.previousElementSibling.querySelector('.dpc-progress-text');

    expect(outerProgress.textContent).toBe('Progress: 1/5'); // seeded [x] counts
    expect(nestedProgress.textContent).toBe('Progress: 0/1');

    toggle(inputs(app.host).find((i) => i.dataset.dpcKey === 'id:stable-1'));
    expect(outerProgress.textContent).toBe('Progress: 2/5');
    expect(nestedProgress.textContent).toBe('Progress: 0/1'); // untouched
  });

  it('reset button restores Markdown defaults, only for its list', () => {
    const app = createHarness({ persistentCheckbox: { progress: true, resetButton: true } });
    app.mounted();
    app.render(renderDoc(NESTED_AND_DUPES), '/reset');

    // check one top item and the nested one
    toggle(inputs(app.host).find((i) => i.dataset.dpcKey === 'id:stable-1'));
    toggle(inputs(app.host).find((i) => i.dataset.dpcKey === fnv1a32('nested child')));

    // reset button of the OUTER list (first .dpc-progress)
    const outerBtn = app.host.querySelector('[data-dpc-progress] .dpc-progress-reset');
    outerBtn.click();

    const stable = inputs(app.host).find((i) => i.dataset.dpcKey === 'id:stable-1');
    const seeded = inputs(app.host).find((i) => i.dataset.dpcKey === 'id:stable-2');
    const nested = inputs(app.host).find((i) => i.dataset.dpcKey === fnv1a32('nested child'));
    expect(stable.checked).toBe(false); // user state cleared
    expect(nested.checked).toBe(true); // nested list untouched
    expect(seeded.checked).toBe(true); // Markdown default restored

    // storage cleared for outer keys only
    const outerKeys = ['id:stable-1'];
    for (const k of outerKeys) {
      expect(Object.keys(window.localStorage).some((key) => key.endsWith(`:${k}`))).toBe(false);
    }
  });

  it('progressTemplate option is honored', () => {
    const app = createHarness({ persistentCheckbox: { progress: true, progressText: '{done} of {total} done' } });
    app.mounted();
    app.render(renderDoc(BASIC), '/t');
    expect(app.host.querySelector('.dpc-progress-text').textContent).toBe('1 of 3 done'); // seeded default
  });

  it('session storage option', () => {
    const app = createHarness({ persistentCheckbox: { storage: 'session' } });
    app.mounted();
    app.render(renderDoc(BASIC), '/s');
    toggle(inputs(app.host)[0]);
    expect(Object.keys(window.localStorage).filter((k) => k.startsWith('docsify-pc'))).toHaveLength(0);
    expect(Object.keys(window.sessionStorage).some((k) => k.startsWith('docsify-pc'))).toBe(true);
  });

  it('index key strategy', () => {
    const app = createHarness({ persistentCheckbox: { keyStrategy: 'index' } });
    app.mounted();
    app.render(renderDoc(BASIC), '/i');
    expect(inputs(app.host).map((i) => i.dataset.dpcKey)).toEqual(['0', '1', '2']);
  });

  it('fires onChange with context and onPageComplete only on completion transition', () => {
    const onChange = vi.fn();
    const onPageComplete = vi.fn();
    const app = createHarness({ persistentCheckbox: { onChange, onPageComplete } });
    app.mounted();
    const plain = '- [ ] alpha\n- [ ] beta\n- [ ] gamma\n';
    app.render(renderDoc(plain), '/cb');

    toggle(inputs(app.host)[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      routePath: '/cb',
      done: 1,
      total: 3,
      item: { checked: true, label: 'alpha' },
    });
    expect(onPageComplete).not.toHaveBeenCalled();

    toggle(inputs(app.host)[1]);
    toggle(inputs(app.host)[2]);
    expect(onPageComplete).toHaveBeenCalledTimes(1);

    // reload of the complete page must NOT re-fire
    const app2 = createHarness({ persistentCheckbox: { onChange, onPageComplete } });
    app2.mounted();
    app2.render(renderDoc(plain), '/cb');
    expect(onPageComplete).toHaveBeenCalledTimes(1);

    // unchecking then rechecking fires again (new transition)
    toggle(inputs(app2.host)[0]);
    toggle(inputs(app2.host)[0]);
    expect(onPageComplete).toHaveBeenCalledTimes(2);
  });

  it('throwing callbacks do not break behavior', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createHarness({
      persistentCheckbox: {
        onChange() {
          throw new Error('boom');
        },
      },
    });
    app.mounted();
    app.render(renderDoc(BASIC), '/err');
    expect(() => toggle(inputs(app.host)[0])).not.toThrow();
    expect(inputs(app.host)[0].checked).toBe(true);
    expect(window.localStorage.getItem(`docsify-pc:${fnv1a32('/err')}:${inputs(app.host)[0].dataset.dpcKey}`)).toBe('1');
    errSpy.mockRestore();
  });

  it('unchecking a seeded [x] item persists the unchecked state', () => {
    const app = createHarness({ persistentCheckbox: true });
    app.mounted();
    app.render(renderDoc(BASIC), '/seed');
    const seeded = inputs(app.host)[1];
    expect(seeded.checked).toBe(true);
    toggle(seeded); // now unchecked
    expect(seeded.checked).toBe(false);

    const app2 = createHarness({ persistentCheckbox: true });
    app2.mounted();
    app2.render(renderDoc(BASIC), '/seed');
    expect(inputs(app2.host)[1].checked).toBe(false);
  });

  it('is inert when persistentCheckbox is not configured', () => {
    const app = createHarness({});
    app.mounted();
    app.render(renderDoc(BASIC), '/off');
    const disabled = app.host.querySelectorAll('input[type="checkbox"][disabled]');
    expect(disabled).toHaveLength(3);
    expect(app.host.querySelector('[data-dpc-key]')).toBeNull();
  });

  it('progress text is present immediately after doneEach (no flicker)', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/flicker');
    expect(app.host.querySelector('.dpc-progress-text').textContent).toBe('Progress: 1/3');
  });
});
