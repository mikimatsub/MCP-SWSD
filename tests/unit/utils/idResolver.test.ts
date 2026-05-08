import { describe, it, expect } from 'vitest';
import {
  resolveIncidentRef,
  resolveSolutionRef,
  resolveProblemRef,
  InputError,
  ID_DIGIT_THRESHOLD,
} from '../../../src/utils/idResolver.js';
import type { SwsdClient, SwsdGetResult } from '../../../src/swsd/client.js';

interface CapturedCall {
  path: string;
  params: Record<string, unknown>;
}

interface FakeClient extends SwsdClient {
  calls: CapturedCall[];
  setBody: (b: unknown) => void;
}

function makeFakeClient(): FakeClient {
  const calls: CapturedCall[] = [];
  let body: unknown = [];
  const get = async <T>(
    path: string,
    params: Record<string, unknown> = {},
  ): Promise<SwsdGetResult<T>> => {
    calls.push({ path, params });
    return {
      body: body as T,
      pagination: {
        page: 1,
        per_page: 10,
        total: undefined,
        has_more: false,
        next_page: undefined,
      },
      headers: new Headers(),
    };
  };
  const notImpl = async <T>(): Promise<T> => {
    throw new Error('not implemented in fake');
  };
  return {
    calls,
    setBody: (b: unknown) => {
      body = b;
    },
    get,
    post: notImpl,
    put: notImpl,
    rawRequest: notImpl,
  } as unknown as FakeClient;
}

describe('ID_DIGIT_THRESHOLD', () => {
  it('is 7 (a 7+ digit value is treated as id, ≤6 as number)', () => {
    expect(ID_DIGIT_THRESHOLD).toBe(7);
  });
});

describe('InputError', () => {
  it('extends Error and has the .name "InputError" so callers can detect it', () => {
    const e = new InputError('bad input');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(InputError);
    expect(e.name).toBe('InputError');
    expect(e.message).toBe('bad input');
  });
});

describe('resolveIncidentRef', () => {
  describe('when input is treated as an id (>=7 digits)', () => {
    it('returns the id directly without making any HTTP call (7-digit value)', async () => {
      const client = makeFakeClient();
      const result = await resolveIncidentRef(1234567, client);
      expect(result).toEqual({ id: 1234567 });
      expect(client.calls).toHaveLength(0);
    });

    it('returns a real-world 9-digit id directly without I/O', async () => {
      const client = makeFakeClient();
      const result = await resolveIncidentRef(180457930, client);
      expect(result).toEqual({ id: 180457930 });
      expect(client.calls).toHaveLength(0);
    });

    it('treats exactly 10_000_000 (smallest 8-digit) as id', async () => {
      const client = makeFakeClient();
      const result = await resolveIncidentRef(10_000_000, client);
      expect(result).toEqual({ id: 10_000_000 });
      expect(client.calls).toHaveLength(0);
    });

    it('treats 1_000_000 (smallest 7-digit) as id', async () => {
      const client = makeFakeClient();
      const result = await resolveIncidentRef(1_000_000, client);
      expect(result).toEqual({ id: 1_000_000 });
      expect(client.calls).toHaveLength(0);
    });
  });

  describe('when input is treated as a human-facing number (<=6 digits)', () => {
    it('issues GET /incidents.json with query=N and per_page>=10 to absorb substring collisions', async () => {
      const client = makeFakeClient();
      client.setBody([{ id: 181255643, number: 60310, name: 'Test incident' }]);
      const result = await resolveIncidentRef(60310, client);
      expect(result).toEqual({ id: 181255643 });
      expect(client.calls).toHaveLength(1);
      const call = client.calls[0];
      expect(call?.path).toBe('/incidents.json');
      expect(call?.params).toMatchObject({ query: 60310 });
      expect((call?.params.per_page as number) ?? 0).toBeGreaterThanOrEqual(10);
    });

    it('extracts the row whose number === input even when query returns substring-collision rows', async () => {
      // SWSD's ?query=60374 can also return #60367 (description contains "60374"
      // as substring). The resolver must filter for number === input.
      const client = makeFakeClient();
      client.setBody([
        { id: 181000001, number: 60367, name: 'mentions 60374 in body' },
        { id: 181000002, number: 60374, name: 'real target' },
      ]);
      const result = await resolveIncidentRef(60374, client);
      expect(result).toEqual({ id: 181000002 });
    });

    it('treats 999999 (largest 6-digit) as a number to look up', async () => {
      const client = makeFakeClient();
      client.setBody([{ id: 9999999, number: 999999 }]);
      await resolveIncidentRef(999999, client);
      expect(client.calls).toHaveLength(1);
      expect(client.calls[0]?.path).toBe('/incidents.json');
    });

    it('throws InputError with a helpful message when no matching number is found', async () => {
      const client = makeFakeClient();
      client.setBody([]); // no rows
      await expect(resolveIncidentRef(60310, client)).rejects.toBeInstanceOf(InputError);
      await expect(resolveIncidentRef(60310, client)).rejects.toMatchObject({
        message: expect.stringContaining('60310'),
      });
    });

    it('throws InputError when query returns rows but none has number === input', async () => {
      // Substring-only collision: query=60310 returned a row whose description
      // mentioned "60310" but whose number is different. Resolver must reject.
      const client = makeFakeClient();
      client.setBody([{ id: 181000001, number: 99999, name: 'mentions 60310' }]);
      await expect(resolveIncidentRef(60310, client)).rejects.toBeInstanceOf(InputError);
    });

    it('throws InputError when SWSD returns a non-array body', async () => {
      const client = makeFakeClient();
      client.setBody({ unexpected: 'shape' });
      await expect(resolveIncidentRef(60310, client)).rejects.toBeInstanceOf(InputError);
    });
  });

  describe('input validation', () => {
    it('rejects negative numbers', async () => {
      const client = makeFakeClient();
      await expect(resolveIncidentRef(-1, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects zero', async () => {
      const client = makeFakeClient();
      await expect(resolveIncidentRef(0, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects non-integer (decimals)', async () => {
      const client = makeFakeClient();
      await expect(resolveIncidentRef(1.5, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects NaN', async () => {
      const client = makeFakeClient();
      await expect(resolveIncidentRef(NaN, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects Infinity', async () => {
      const client = makeFakeClient();
      await expect(resolveIncidentRef(Infinity, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });
  });
});

describe('resolveSolutionRef', () => {
  describe('when input is treated as an id (>=7 digits)', () => {
    it('returns the id directly without making any HTTP call', async () => {
      const client = makeFakeClient();
      const result = await resolveSolutionRef(1849839, client);
      expect(result).toEqual({ id: 1849839 });
      expect(client.calls).toHaveLength(0);
    });
  });

  describe('when input is treated as a human-facing number (<=6 digits)', () => {
    it('issues GET /solutions.json with query=N and filters for exact number match', async () => {
      const client = makeFakeClient();
      client.setBody([{ id: 1849839, number: 397, name: 'Knowledge article' }]);
      const result = await resolveSolutionRef(397, client);
      expect(result).toEqual({ id: 1849839 });
      expect(client.calls).toHaveLength(1);
      expect(client.calls[0]?.path).toBe('/solutions.json');
      expect(client.calls[0]?.params).toMatchObject({ query: 397 });
    });

    it('extracts the exact number match when substring-collisions are present', async () => {
      const client = makeFakeClient();
      client.setBody([
        { id: 1849999, number: 166, name: 'mentions 385 in body' },
        { id: 1849839, number: 385, name: 'real target' },
      ]);
      const result = await resolveSolutionRef(385, client);
      expect(result).toEqual({ id: 1849839 });
    });

    it('throws InputError when no matching solution number is found', async () => {
      const client = makeFakeClient();
      client.setBody([]);
      await expect(resolveSolutionRef(397, client)).rejects.toBeInstanceOf(InputError);
      await expect(resolveSolutionRef(397, client)).rejects.toMatchObject({
        message: expect.stringContaining('397'),
      });
    });
  });

  describe('input validation', () => {
    it('rejects negative numbers', async () => {
      const client = makeFakeClient();
      await expect(resolveSolutionRef(-1, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects zero', async () => {
      const client = makeFakeClient();
      await expect(resolveSolutionRef(0, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects non-integer', async () => {
      const client = makeFakeClient();
      await expect(resolveSolutionRef(1.5, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects NaN', async () => {
      const client = makeFakeClient();
      await expect(resolveSolutionRef(NaN, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });
  });
});

describe('resolveProblemRef', () => {
  describe('when input is treated as an id (>=7 digits)', () => {
    it('returns the id directly without making any HTTP call', async () => {
      const client = makeFakeClient();
      const result = await resolveProblemRef(180457930, client);
      expect(result).toEqual({ id: 180457930 });
      expect(client.calls).toHaveLength(0);
    });

    it('treats 1_000_000 (smallest 7-digit) as id', async () => {
      const client = makeFakeClient();
      const result = await resolveProblemRef(1_000_000, client);
      expect(result).toEqual({ id: 1_000_000 });
      expect(client.calls).toHaveLength(0);
    });
  });

  describe('when input is treated as a human-facing number (<=6 digits)', () => {
    it('issues GET /problems.json with query=N and per_page>=10', async () => {
      const client = makeFakeClient();
      client.setBody([{ id: 195000001, number: 4421, name: 'Recurring database lag' }]);
      const result = await resolveProblemRef(4421, client);
      expect(result).toEqual({ id: 195000001 });
      expect(client.calls).toHaveLength(1);
      const call = client.calls[0];
      expect(call?.path).toBe('/problems.json');
      expect(call?.params).toMatchObject({ query: 4421 });
      expect((call?.params.per_page as number) ?? 0).toBeGreaterThanOrEqual(10);
    });

    it('extracts the row whose number === input even when substring-collisions are present', async () => {
      const client = makeFakeClient();
      client.setBody([
        { id: 195000099, number: 999, name: 'mentions 4421 in body' },
        { id: 195000001, number: 4421, name: 'real target' },
      ]);
      const result = await resolveProblemRef(4421, client);
      expect(result).toEqual({ id: 195000001 });
    });

    it('throws InputError when no matching problem number is found', async () => {
      const client = makeFakeClient();
      client.setBody([]);
      await expect(resolveProblemRef(4421, client)).rejects.toBeInstanceOf(InputError);
      await expect(resolveProblemRef(4421, client)).rejects.toMatchObject({
        message: expect.stringContaining('4421'),
      });
    });
  });

  describe('input validation', () => {
    it('rejects negative numbers', async () => {
      const client = makeFakeClient();
      await expect(resolveProblemRef(-1, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });

    it('rejects zero, NaN, and non-integers without I/O', async () => {
      const client = makeFakeClient();
      await expect(resolveProblemRef(0, client)).rejects.toBeInstanceOf(InputError);
      await expect(resolveProblemRef(NaN, client)).rejects.toBeInstanceOf(InputError);
      await expect(resolveProblemRef(1.5, client)).rejects.toBeInstanceOf(InputError);
      expect(client.calls).toHaveLength(0);
    });
  });
});
