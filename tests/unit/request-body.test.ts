import { describe, expect, it } from 'vitest';

import { readJsonBody } from '@/lib/request-body';

function post(body: string): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('readJsonBody', () => {
  it('returns the parsed body for valid JSON', async () => {
    const result = await readJsonBody(post('{"ok":true}'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({ ok: true });
    }
  });

  it('turns an empty body into a 400 instead of a 500', async () => {
    const result = await readJsonBody(post(''));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toMatchObject({
        code: 'BAD_REQUEST',
      });
    }
  });

  it('turns malformed JSON into a 400', async () => {
    const result = await readJsonBody(post('{not json'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });
});
