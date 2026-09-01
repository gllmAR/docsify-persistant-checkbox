/**
 * IIFE entry: registers the global and auto-registers into $docsify.plugins
 * when the docsify config object already exists.
 */
import { persistentCheckbox } from './index.js';

const w = typeof window !== 'undefined' ? window : globalThis;
w.DocsifyPersistentCheckbox = persistentCheckbox;

if (w.$docsify) {
  w.$docsify.plugins = (w.$docsify.plugins || []).concat(persistentCheckbox);
}
