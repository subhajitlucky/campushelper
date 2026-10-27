import { NextResponse } from 'next/server';

import { ErrorCodes, createErrorResponse } from './errors';

export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

/**
 * Read a JSON request body and turn malformed or empty input into a 400.
 *
 * `request.json()` rejects on an empty body, and an unhandled rejection inside
 * `safeApiHandler` becomes a 500 — telling the client the server failed when
 * the request was the problem.
 */
export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: createErrorResponse(
        'Invalid JSON in request body',
        ErrorCodes.BAD_REQUEST,
        400
      ),
    };
  }
}
