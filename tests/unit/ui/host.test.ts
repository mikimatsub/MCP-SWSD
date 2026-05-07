import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyHostThemeVariables } from '../../../src/ui/shared/host.js';

/**
 * `applyHostThemeVariables` calls `document.documentElement.style.setProperty(key, value)`.
 * vitest runs in the node environment by default (see vitest.config.ts) where neither
 * `document` nor a CSSStyleDeclaration exists, so this test installs a minimal stub on
 * globalThis that records every setProperty call. Same shape as tests/unit/ui/dom.test.ts.
 */

interface RecordedStyle {
  calls: Array<[string, string]>;
  setProperty(key: string, value: string): void;
}

interface RecordedDocument {
  documentElement: { style: RecordedStyle };
}

let originalDocument: unknown;
let recorded: RecordedDocument;

beforeEach(() => {
  originalDocument = (globalThis as { document?: unknown }).document;
  recorded = {
    documentElement: {
      style: {
        calls: [],
        setProperty(key, value) {
          this.calls.push([key, value]);
        },
      },
    },
  };
  (globalThis as { document: unknown }).document = recorded;
});

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document: unknown }).document = originalDocument;
  }
});

describe('applyHostThemeVariables — CSS custom property guard', () => {
  it('sets a property when the key is a CSS custom property (--fg)', () => {
    applyHostThemeVariables({ '--fg': 'red' });
    expect(recorded.documentElement.style.calls).toEqual([['--fg', 'red']]);
  });

  it('is a no-op when the key is not a CSS custom property (width)', () => {
    applyHostThemeVariables({ width: '100vw' });
    expect(recorded.documentElement.style.calls).toEqual([]);
  });

  it('sets only the --prefixed entry when given a mix', () => {
    applyHostThemeVariables({ '--fg': 'red', width: '100vw' });
    expect(recorded.documentElement.style.calls).toEqual([['--fg', 'red']]);
  });

  it('is a no-op (no throw) when given undefined', () => {
    expect(() => applyHostThemeVariables(undefined)).not.toThrow();
    expect(recorded.documentElement.style.calls).toEqual([]);
  });
});
