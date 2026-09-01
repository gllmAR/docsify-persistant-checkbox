// @vitest-environment happy-dom
/**
 * End-to-end test against the REAL docsify@5 dist bundle running inside
 * happy-dom: real markdown pipeline, real task-list rendering, real plugin
 * lifecycle. XMLHttpRequest is stubbed to serve an in-memory docs site.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { persistentCheckbox } from '../src/index.js';

const SITE = {
  '/': `# Home\n\n- [ ] home task one\n- [ ] home task two\n`,
  '/README.md': `# Home\n\n- [ ] home task one\n- [ ] home task two\n`,
  '/guide': `# Guide\n\n- [x] guide seeded\n- [ ] guide second\n`,
  '/guide.md': `# Guide\n\n- [x] guide seeded\n- [ ] guide second\n`,
  '/_sidebar.md': `- [Home](/)\n- [Guide](/guide)\n`,
};

class FakeXHR extends EventTarget {
  status = 0;
  readyState = 0;
  response = '';
  responseText = '';
  #url = '';
  #headers = {};

  open(_method, url) {
    this.#url = url;
    this.readyState = 1;
  }
  setRequestHeader(k, v) {
    this.#headers[k] = v;
  }
  getResponseHeader(name) {
    return name.toLowerCase() === 'last-modified' ? new Date().toUTCString() : null;
  }
  abort() {}
  send() {
    const path = this.#url.replace(/^https?:\/\/[^/]+/, '');
    const clean = path.startsWith('/') ? path : `/${path}`;
    const md = SITE[clean] ?? SITE[clean.replace(/\.md$/, '')];
    queueMicrotask(() => {
      this.status = md === undefined ? 404 : 200;
      this.readyState = 4;
      this.response = md ?? 'not found';
      this.responseText = this.response;
      this.dispatchEvent(new Event('load'));
    });
  }
}

let loaded = false;

async function loadDocsify() {
  if (loaded) return;
  window.$docsify = {
    el: '#app',
    loadSidebar: true,
    catchPluginErrors: true,
    persistentCheckbox: { progress: true, resetButton: true },
    plugins: [persistentCheckbox],
  };
  document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  await import('docsify/dist/docsify.js');
  loaded = true;
  await new Promise((r) => setTimeout(r, 200));
}

const taskInputs = () => [...document.querySelectorAll('input[data-dpc-key]')];

describe('e2e: real docsify@5 + plugin', () => {
  beforeAll(async () => {
    await loadDocsify();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('renders real task-list checkboxes, enabled and tagged', () => {
    const inputs = taskInputs();
    expect(inputs.length).toBe(2);
    for (const input of inputs) {
      expect(input.disabled).toBe(false);
      expect(input.dataset.dpcKey).toBeTruthy();
    }
  });

  it('shows per-list progress from the real render pipeline', () => {
    const text = document.querySelector('.dpc-progress-text');
    expect(text.textContent).toBe('Progress: 0/2');
  });

  it('persists a click through the real docsify SPA router', async () => {
    const input = taskInputs()[0];
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const key = input.dataset.dpcKey;

    // navigate via the hash router and let docsify re-render
    window.location.hash = '#/guide';
    await new Promise((r) => setTimeout(r, 200));
    const guideInputs = taskInputs();
    expect(guideInputs.length).toBe(2);
    expect(guideInputs[0].checked).toBe(true); // [x] seeded
    expect(guideInputs[1].checked).toBe(false);

    // navigate home: state restored by the plugin
    window.location.hash = '#/';
    await new Promise((r) => setTimeout(r, 200));
    const homeInputs = taskInputs();
    const clicked = homeInputs.find((i) => i.dataset.dpcKey === key);
    expect(clicked.checked).toBe(true);
    expect(homeInputs.filter((i) => i.checked).length).toBe(1);
  });
});
