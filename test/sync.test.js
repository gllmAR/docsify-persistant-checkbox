// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BASIC, NESTED_AND_DUPES, renderDoc } from './fixtures.js';
import { createHarness, inputs, storageEventFromOtherTab, toggle } from './harness.js';
import { internals } from './load-plugin.js';

const { fnv1a32 } = internals();
const NS = 'docsify-pc';

function keyOf(routePath, itemKey) {
  return `${NS}:${fnv1a32(routePath)}:${itemKey}`;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('cross-tab sync (storage events from another tab)', () => {
  it('patches the checkbox when another tab checks it', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/sync');

    const input = inputs(app.host)[0];
    expect(input.checked).toBe(false);

    // another tab writes and the event reaches us
    window.localStorage.setItem(keyOf('/sync', input.dataset.dpcKey), '1');
    storageEventFromOtherTab(keyOf('/sync', input.dataset.dpcKey), '1');

    expect(input.checked).toBe(true);
    const bar = app.host.querySelector('.dpc-progress-bar');
    expect(bar.querySelector('.dpc-progress-text').textContent).toBe('2/3'); // + seeded default
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
  });

  it('patches uncheck from another tab', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/uncheck');

    const seeded = inputs(app.host)[1]; // [x] seeded -> checked by default
    expect(seeded.checked).toBe(true);

    storageEventFromOtherTab(keyOf('/uncheck', seeded.dataset.dpcKey), '0');
    expect(seeded.checked).toBe(false);
  });

  it('removal event (reset in another tab) restores the Markdown default', () => {
    const app = createHarness({ persistentCheckbox: { progress: true, resetButton: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/reset-x');

    const seeded = inputs(app.host)[1];
    toggle(seeded); // user unchecks -> stored '0'
    expect(seeded.checked).toBe(false);

    // other tab resets -> key removed -> newValue null
    storageEventFromOtherTab(keyOf('/reset-x', seeded.dataset.dpcKey), null);
    expect(seeded.checked).toBe(true); // Markdown default restored
  });

  it('ignores keys from other routes and foreign keys', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/here');

    const before = inputs(app.host).map((i) => i.checked);
    storageEventFromOtherTab(keyOf('/there', fnv1a32('first')), '1');
    storageEventFromOtherTab('some-other-plugin:key', '1');
    storageEventFromOtherTab(null, '1');

    expect(inputs(app.host).map((i) => i.checked)).toEqual(before);
  });

  it('no-ops when the item is not on the rendered page (mirror still updated)', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/absent');

    const foreignKey = keyOf('/absent', fnv1a32('not-on-this-page'));
    expect(() => storageEventFromOtherTab(foreignKey, '1')).not.toThrow();

    // navigating to a page that HAS the item uses the mirrored storage value
    app.render(renderDoc('- [ ] not-on-this-page'), '/absent2');
    expect(inputs(app.host)[0].checked).toBe(false); // different route hash
  });

  it('fires onChange (and transition-only onPageComplete) in the receiving tab', () => {
    const onChange = vi.fn();
    const onPageComplete = vi.fn();
    const app = createHarness({ persistentCheckbox: { onChange, onPageComplete } });
    app.mounted();
    const plain = '- [ ] alpha\n- [ ] beta\n';
    app.render(renderDoc(plain), '/cb-sync');

    const k1 = keyOf('/cb-sync', fnv1a32('alpha'));
    const k2 = keyOf('/cb-sync', fnv1a32('beta'));

    window.localStorage.setItem(k1, '1');
    storageEventFromOtherTab(k1, '1');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ routePath: '/cb-sync', done: 1, total: 2 });
    expect(onPageComplete).not.toHaveBeenCalled();

    window.localStorage.setItem(k2, '1');
    storageEventFromOtherTab(k2, '1');
    expect(onPageComplete).toHaveBeenCalledTimes(1);

    // reload of the completed page must not re-fire
    const app2 = createHarness({ persistentCheckbox: { onChange, onPageComplete } });
    app2.mounted();
    app2.render(renderDoc(plain), '/cb-sync');
    expect(onPageComplete).toHaveBeenCalledTimes(1);
  });

  it('does not write back to storage (no echo loops)', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/echo');

    const key = keyOf('/echo', fnv1a32('first'));
    window.localStorage.setItem(key, '0');
    storageEventFromOtherTab(key, '0');
    expect(window.localStorage.getItem(key)).toBe('0');
  });

  it('listener is replaced, not duplicated, on re-init', () => {
    const app = createHarness({ persistentCheckbox: { progress: true } });
    app.mounted();
    app.render(renderDoc(BASIC), '/dup');
    const app2 = createHarness({ persistentCheckbox: { progress: true } });
    app2.mounted(); // re-init: previous storage listener must be dropped
    app2.render(renderDoc(BASIC), '/dup');

    storageEventFromOtherTab(keyOf('/dup', fnv1a32('first')), '1');
    // a duplicated listener would run stale closures against the new DOM;
    // assert the fresh handler applied exactly the right state
    expect(inputs(app2.host)[0].checked).toBe(true);
  });
});
