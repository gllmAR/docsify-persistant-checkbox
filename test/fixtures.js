/**
 * Realistic Docsify 5 task-list fixtures.
 *
 * The renderers below are copied VERBATIM from docsify@5.0.0
 * (src/core/render/compiler/taskList.js + taskListItem.js) and applied to
 * real marked@18, so fixtures match production output byte-for-byte in
 * structure. If docsify changes its task-list markup, these fixtures (and
 * the plugin) must be revisited.
 */
import { Marked, Renderer } from 'marked';

function docsifyTaskRenderers() {
  const renderer = new Renderer();

  renderer.list = function (token) {
    const ordered = token.ordered;
    const start = token.start;

    let body = '';
    for (const item of token.items) {
      body += this.listitem(item);
    }

    const isTaskList = /<li class="task-list-item">/.test(
      body.split('class="task-list"')[0],
    );
    const isStartReq = start && start > 1;
    const tag = ordered ? 'ol' : 'ul';
    const tagAttrs = [
      isTaskList ? 'class="task-list"' : '',
      isStartReq ? `start="${start}"` : '',
    ]
      .join(' ')
      .trim();

    return `<${tag} ${tagAttrs}>${body}</${tag}>`;
  };

  renderer.listitem = function (item) {
    let text = '';
    if (item.task) {
      const checkbox = this.checkbox?.({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens.length > 0 && item.tokens[0].type === 'paragraph') {
          item.tokens[0].text = checkbox + ' ' + item.tokens[0].text;
          if (
            item.tokens[0].tokens &&
            item.tokens[0].tokens.length > 0 &&
            item.tokens[0].tokens[0].type === 'text'
          ) {
            item.tokens[0].tokens[0].text =
              checkbox + ' ' + item.tokens[0].tokens[0].text;
          }
        } else {
          item.tokens.unshift({
            type: 'text',
            raw: checkbox + ' ',
            text: checkbox + ' ',
          });
        }
      }
    }

    text += this.parser?.parse(item.tokens, !!item.loose);

    const isTaskItem = /^(<input.*type="checkbox"[^>]*>)/.test(text);
    return isTaskItem
      ? `<li class="task-list-item"><label>${text}</label></li>`
      : `<li>${text}</li>`;
  };

  return renderer;
}

const md = new Marked({ renderer: docsifyTaskRenderers() });

/** Render markdown the way docsify 5 does (task-list portion). */
export function renderDoc(markdown) {
  return md.parse(markdown);
}

export const BASIC = '- [ ] first\n- [x] seeded\n- [ ] third\n';

export const NESTED_AND_DUPES =
  '- [ ] dup\n- [ ] dup\n- [ ] dup\n' +
  '  - [ ] nested child\n' +
  '- [ ] marker {#stable-1}\n' +
  '- [x] pre-checked {#stable-2}\n';

export const ORDERED = '2. [ ] ordered one\n3. [ ] ordered two\n';

export const LOOSE = '- [ ] loose item\n\n- [ ] second loose\n';

export const ENTITIES_AND_FORMATTING =
  '- [ ] a &amp; b "quoted"\n- [ ] **bold** and `code`\n';
