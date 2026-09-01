import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  extractIdMarker,
  fnv1a32,
  makeKeyGen,
  normalizeItemText,
  routeHashKey,
  stripTags,
} from '../src/keys.js';

describe('fnv1a32', () => {
  it('matches known FNV-1a 32-bit vectors', () => {
    expect(fnv1a32('')).toBe('811c9dc5'); // offset basis
    expect(fnv1a32('a')).toBe('e40c292c');
    expect(fnv1a32('foobar')).toBe('bf9cf968');
  });

  it('is stable and well distributed', () => {
    expect(fnv1a32('exercise one')).toBe(fnv1a32('exercise one'));
    expect(fnv1a32('exercise one')).not.toBe(fnv1a32('exercise two'));
  });
});

describe('decodeEntities / stripTags', () => {
  it('decodes common and numeric entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &#65;&#x42;')).toBe('a & b <c> AB');
  });

  it('strips tags but keeps inner text', () => {
    expect(stripTags('bold <code>x</code> tail')).toBe('bold x tail');
  });
});

describe('extractIdMarker', () => {
  it('extracts and strips {#id}', () => {
    const r = extractIdMarker('do the thing {#ex-1}');
    expect(r.id).toBe('ex-1');
    expect(r.text).not.toContain('{#');
  });

  it('returns null id when absent', () => {
    expect(extractIdMarker('plain').id).toBeNull();
  });
});

describe('normalizeItemText', () => {
  it('normalizes whitespace and entities, keeps marker id', () => {
    const r = normalizeItemText('A &amp;  B {#k1}');
    expect(r.id).toBe('k1');
    expect(r.normalized).toBe('A & B');
  });
});

describe('makeKeyGen', () => {
  it('hash strategy: distinct texts -> distinct keys, stable across calls', () => {
    const gen1 = makeKeyGen('hash');
    const gen2 = makeKeyGen('hash');
    expect(gen1(fnv1a32('read chapter'))).toBe(gen2(fnv1a32('read chapter')));
  });

  it('hash strategy: duplicates get deterministic occurrence suffixes', () => {
    const gen = makeKeyGen('hash');
    const h = fnv1a32('dup');
    const keys = [gen(h), gen(h), gen(h)];
    expect(keys).toEqual([h, `${h}#2`, `${h}#3`]);
  });

  it('hash strategy: identity is per-generator (per page render)', () => {
    const a = makeKeyGen('hash');
    const b = makeKeyGen('hash');
    expect(a(fnv1a32('x'))).toBe(b(fnv1a32('x')));
  });

  it('index strategy: positional keys', () => {
    const gen = makeKeyGen('index');
    expect([gen(), gen(), gen()]).toEqual(['0', '1', '2']);
  });
});

describe('routeHashKey', () => {
  it('short and stable', () => {
    expect(routeHashKey('/guide/exercises')).toBe(fnv1a32('/guide/exercises'));
    expect(routeHashKey('')).toBe(fnv1a32('/'));
  });
});
