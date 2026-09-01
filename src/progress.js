/**
 * Progress display helpers (per task list).
 */

import { countForList } from './dom.js';

/** Render the progress text for a list into its progress node. */
export function updateProgressForList(listEl, template) {
  const node = listEl.previousElementSibling;
  if (!node || !node.matches('[data-dpc-progress]')) return;
  const { done, total } = countForList(listEl);
  const text = node.querySelector('.dpc-progress-text');
  if (text) text.textContent = renderProgressText(template, done, total);
}

/** Update every progress node under `root` (defaults to document). */
export function updateAllProgress(root = document, template = 'Progress: {done}/{total}') {
  for (const list of root.querySelectorAll('[data-dpc-list]')) {
    updateProgressForList(list, template);
  }
}

export function renderProgressText(template, done, total) {
  return String(template).replace(/\{done\}/g, String(done)).replace(/\{total\}/g, String(total));
}

/** Minimal default styling, injected once. */
export function injectStyles(doc = document) {
  if (doc.getElementById('dpc-styles')) return;
  const style = doc.createElement('style');
  style.id = 'dpc-styles';
  style.textContent = [
    '.dpc-progress{display:flex;align-items:center;gap:.6em;margin:.2em 0 .8em;font-size:.85em;opacity:.8;}',
    '.dpc-progress-reset{cursor:pointer;font:inherit;font-size:.9em;padding:.1em .6em;}',
    'li.task-list-item>label{cursor:pointer;}',
    'li.task-list-item>label>input[type="checkbox"],li.task-list-item>label>p>input[type="checkbox"]{cursor:pointer;margin-right:.35em;}',
  ].join('\n');
  doc.head.appendChild(style);
}
