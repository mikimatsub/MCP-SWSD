import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { el } from '../../../src/ui/shared/dom.js';

/**
 * The `el` helper depends on `document.createElement` and `document.createTextNode`.
 * vitest runs in the node environment by default (see vitest.config.ts) where neither
 * exists, so this test installs a minimal stub on globalThis. The stub records every
 * setAttribute call so success-path tests can assert the attribute landed correctly.
 */

interface RecordedNode {
  tagName: string;
  attributes: Record<string, string>;
  children: RecordedNode[];
  textContent?: string;
  setAttribute(key: string, value: string): void;
  appendChild(child: RecordedNode): RecordedNode;
  removeChild(child: RecordedNode): RecordedNode;
  firstChild: RecordedNode | null;
}

function makeNode(tag: string, text?: string): RecordedNode {
  const node: RecordedNode = {
    tagName: tag.toUpperCase(),
    attributes: {},
    children: [],
    textContent: text,
    firstChild: null,
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    appendChild(child) {
      this.children.push(child);
      this.firstChild = this.children[0] ?? null;
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      this.firstChild = this.children[0] ?? null;
      return child;
    },
  };
  return node;
}

let originalDocument: unknown;

beforeEach(() => {
  originalDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document: unknown }).document = {
    createElement(tag: string) {
      return makeNode(tag);
    },
    createTextNode(text: string) {
      return makeNode('#text', text);
    },
  };
});

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document: unknown }).document = originalDocument;
  }
});

describe('el — XSS hardening', () => {
  it('rejects event-handler attributes (onclick)', () => {
    expect(() => el('div', { onclick: 'alert(1)' })).toThrow(
      /Refusing to set event-handler attribute "onclick" — wire listeners with addEventListener instead\./,
    );
  });

  it('rejects event-handler attributes case-insensitively (ONCLICK)', () => {
    expect(() => el('div', { ONCLICK: 'alert(1)' })).toThrow(
      /Refusing to set event-handler attribute "ONCLICK"/,
    );
  });

  it('rejects href with javascript: scheme', () => {
    expect(() => el('a', { href: 'javascript:alert(1)' })).toThrow(
      /Refusing to set href="javascript:alert\(1\)" — disallowed URL scheme\./,
    );
  });

  it('rejects href with javascript: scheme case-insensitively (JavaScript:)', () => {
    expect(() => el('a', { href: 'JavaScript:alert(1)' })).toThrow(
      /Refusing to set href="JavaScript:alert\(1\)" — disallowed URL scheme\./,
    );
  });

  it('accepts http: URLs on href', () => {
    const node = el('a', { href: 'http://example.com' }) as unknown as RecordedNode;
    expect(node.attributes['href']).toBe('http://example.com');
  });

  it('accepts relative URLs on href', () => {
    const node = el('a', { href: '/incidents/42' }) as unknown as RecordedNode;
    expect(node.attributes['href']).toBe('/incidents/42');
  });

  it('rejects data: URL on src (data URLs blocked across the board)', () => {
    expect(() =>
      el('img', { src: 'data:image/png;base64,iVBORw0KGgo' }),
    ).toThrow(/Refusing to set src="data:image\/png;base64,iVBORw0KGgo" — disallowed URL scheme\./);
  });

  it('passes through ordinary attributes (regression — class, id)', () => {
    const node = el('div', { class: 'hi', id: 'x' }) as unknown as RecordedNode;
    expect(node.attributes['class']).toBe('hi');
    expect(node.attributes['id']).toBe('x');
  });
});
