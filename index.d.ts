import type { DocsifyHook, DocsifyVM } from 'docsify';

export interface PersistentCheckboxContext {
  routePath: string;
  done: number;
  total: number;
  item: { key: string; checked: boolean; label: string } | null;
}

export interface PersistentCheckboxOptions {
  /** 'local' (default) or 'session' */
  storage?: 'local' | 'session';
  /** 'hash' (default, text-derived & edit-resilient) or 'index' (positional) */
  keyStrategy?: 'hash' | 'index';
  /** storage key prefix, default 'docsify-pc' */
  namespace?: string;
  /** show a per-task-list done/total line */
  progress?: boolean;
  /** text inside the progress bar, {done}/{total} placeholders */
  progressText?: string;
  /** render an emoji reset button per task list */
  resetButton?: boolean;
  /** emoji used on the reset button, default 🔄 */
  resetIcon?: string;
  /** fires on every toggle / reset */
  onChange?: (ctx: PersistentCheckboxContext) => void;
  /** fires once when a page becomes fully checked (user interaction only) */
  onPageComplete?: (ctx: PersistentCheckboxContext) => void;
}

export declare function persistentCheckbox(
  hook: DocsifyHook,
  vm: DocsifyVM,
): void;

export default persistentCheckbox;
