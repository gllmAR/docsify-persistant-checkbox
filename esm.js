/**
 * Tiny ESM wrapper — the plugin itself is a plain script (no build step).
 * Importing the script executes it and sets window.DocsifyPersistentCheckbox
 * (and auto-registers into window.$docsify.plugins when present).
 */
import './docsify-plugin-persistent-checkbox.js';

export const persistentCheckbox = window.DocsifyPersistentCheckbox;
export default persistentCheckbox;
