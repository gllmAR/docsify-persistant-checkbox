/**
 * Test helper: load the real, ship-shape plugin file (the one users get)
 * into the happy-dom window and expose its testable internals.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLUGIN_PATH = resolve(process.cwd(), 'docsify-plugin-persistent-checkbox.js');

let loaded = false;

export function loadPlugin() {
  if (!loaded) {
    const code = readFileSync(PLUGIN_PATH, 'utf8');
    // evaluate in the happy-dom window context
    window.eval(code);
    loaded = true;
  }
  const plugin = window.DocsifyPersistentCheckbox;
  if (!plugin) throw new Error('plugin failed to load');
  return plugin;
}

export function internals() {
  return loadPlugin()._internals;
}
