import { describe, it, expect } from 'vitest';
import { toCommentSummary } from '../../../src/swsd/mappers/comment.js';

describe('toCommentSummary', () => {
  it('projects a typical SWSD comment', () => {
    const raw = {
      id: 5001,
      body: 'Investigating now.',
      is_private: false,
      user: { email: 'agent@example.com', name: 'Alice', id: 1 },
      created_at: '2026-05-03T10:00:00Z',
    };
    const c = toCommentSummary(raw);
    expect(c).toEqual({
      id: 5001,
      body: 'Investigating now.',
      is_private: false,
      author_email: 'agent@example.com',
      author_name: 'Alice',
      created_at: '2026-05-03T10:00:00Z',
    });
  });

  it('falls back to commenter when user is missing', () => {
    const raw = {
      id: 5002,
      body: 'x',
      is_private: true,
      commenter: { email: 'sys@example.com', name: 'System' },
    };
    const c = toCommentSummary(raw);
    expect(c?.author_email).toBe('sys@example.com');
    expect(c?.author_name).toBe('System');
  });

  it('defaults is_private to false when missing', () => {
    const c = toCommentSummary({ id: 1, body: 'x' });
    expect(c?.is_private).toBe(false);
  });

  it('returns null for non-objects and missing id', () => {
    expect(toCommentSummary(null)).toBeNull();
    expect(toCommentSummary([])).toBeNull();
    expect(toCommentSummary({ body: 'no id' })).toBeNull();
  });

  it('handles missing body as empty string', () => {
    const c = toCommentSummary({ id: 1 });
    expect(c?.body).toBe('');
  });
});
