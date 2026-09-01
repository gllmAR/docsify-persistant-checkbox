/**
 * Item identity & hashing helpers.
 *
 * Identity strategy (default 'hash'):
 *   An item's key is derived from its visible text so that reordering or
 *   inserting items in the Markdown source does not lose user state.
 *   Duplicate texts on the same page get a deterministic occurrence suffix
 *   (`#2`, `#3`, ...) based on document order.
 *   Authors can pin a stable key with an invisible `{#my-id}` marker in the
 *   item text; the marker is stripped from the rendered label.
 */

const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a 32-bit hash, returned as zero-padded 8-char hex string. */
export function fnv1a32(str) {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Decode the handful of entities marked emits; also numeric forms. */
export function decodeEntities(str) {
  return str
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m, name) => ENTITIES[`&${name};`])
    .replace(/&#(\d+);/g, (m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, code) => String.fromCodePoint(parseInt(code, 16)));
}

/** Remove HTML tags from an inline HTML fragment. */
export function stripTags(str) {
  return str.replace(/<[^>]*>/g, '');
}

const MARKER_RE = /\s*\{#([A-Za-z0-9_-]+)\}\s*/;

/**
 * Extract a `{#my-id}` identity marker from raw item text.
 * @returns {{ id: string|null, text: string }}
 */
export function extractIdMarker(rawText) {
  const match = rawText.match(MARKER_RE);
  if (!match) return { id: null, text: rawText };
  return { id: match[1], text: rawText.replace(MARKER_RE, ' ') };
}

/**
 * Normalize an item's raw HTML fragment into canonical identity text:
 * strip tags (inline tags like <code> keep their content), decode entities,
 * strip {#id} markers, collapse whitespace.
 */
export function normalizeItemText(rawHtmlFragment) {
  const { id, text } = extractIdMarker(decodeEntities(stripTags(rawHtmlFragment)));
  const normalized = text.replace(/\s+/g, ' ').trim();
  return { id, normalized };
}

/**
 * Create a page-scoped key generator. The returned function must be called
 * once per task item, in document order.
 *
 * @param {'hash'|'index'} strategy
 */
export function makeKeyGen(strategy) {
  if (strategy === 'index') {
    let i = 0;
    return () => String(i++);
  }
  const seen = new Map();
  return (identity) => {
    const count = (seen.get(identity) || 0) + 1;
    seen.set(identity, count);
    return count === 1 ? identity : `${identity}#${count}`;
  };
}

/** Stable short key for a route path (keeps storage keys small & safe). */
export function routeHashKey(path) {
  return fnv1a32(path || '/');
}
