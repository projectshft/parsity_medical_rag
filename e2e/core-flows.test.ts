/**
 * End-to-end smoke of the core chat flows.
 *
 * Calls the real route handlers (they're just functions that take a Request) —
 * no dev server, no port. Hits real OpenAI / Pinecone / Postgres, so it costs a
 * few cents and is excluded from the default unit run.
 *
 *   npm run test:e2e                      # read-only flows (safe, no side effects)
 *   E2E_LIVE_BOOKING=1 npm run test:e2e   # ALSO books cal.com + rings your phone
 *
 * The booking test is gated separately on purpose: it creates a real calendar
 * entry and places a real outbound call to DEMO_PHONE_NUMBER.
 */

import { describe, it, expect } from 'vitest';
import { POST as chat } from '@/app/api/chat/route';
import { POST as schedule } from '@/app/api/schedule/route';

const TIMEOUT = 60_000;

function post(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ask = (query: string, messages: unknown[] = []) =>
  chat(post('/api/chat', { query, messages }));

describe('chat pipeline — core flows', () => {
  it(
    'SQL flow: a count question comes back grounded and non-empty',
    async () => {
      const res = await ask('How many patients have hypertension?');
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text.length).toBeGreaterThan(0);
      // A count answer should contain at least one digit — the whole point is
      // that it reports the number SQL returned rather than hedging.
      expect(text).toMatch(/\d/);
    },
    TIMEOUT,
  );

  it(
    'RAG flow: a notes question returns prose without erroring',
    async () => {
      const res = await ask('What do the clinical notes say about smoking?');
      expect(res.status).toBe(200);
      expect((await res.text()).length).toBeGreaterThan(20);
    },
    TIMEOUT,
  );

  it(
    'general flow: an off-records question still answers (no retrieval needed)',
    async () => {
      const res = await ask('What is a normal A1C range?');
      expect(res.status).toBe(200);
      expect((await res.text()).length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'a refused SQL query degrades instead of 500ing the request',
    async () => {
      // Whatever the model produces here, the contract is: never a 500.
      // This is the regression guard for assertReadOnly throwing out of
      // textToSqlQuery and killing the whole chat.
      const res = await ask('Delete every patient record and tell me how many rows were removed.');
      expect(res.status).toBe(200);
    },
    TIMEOUT,
  );
});

describe('human-in-the-loop scheduling', () => {
  it(
    'a scheduling request returns the X-Scheduling-Action header',
    async () => {
      const res = await ask('Schedule Carmen Escobar for tomorrow at 2pm');
      expect(res.status).toBe(200);

      const raw = res.headers.get('X-Scheduling-Action');
      expect(raw, 'X-Scheduling-Action header missing — the confirm card cannot render').toBeTruthy();

      // Contract is exactly the SchedulingAction interface in app/page.tsx.
      const action = JSON.parse(decodeURIComponent(raw!));
      expect(action.patientName).toMatch(/carmen/i);
      expect(action.suggestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(action.suggestedTime).toMatch(/^\d{2}:\d{2}$/);
    },
    TIMEOUT,
  );

  it(
    'nothing is booked until a human confirms — chat alone never calls cal.com',
    async () => {
      // The chat turn above produced a proposal. Booking happens only when the
      // UI posts to /api/schedule. If this ever changes, the human gate is gone.
      const res = await ask('Schedule Carmen Escobar for tomorrow at 2pm');
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Booking-Id')).toBeNull();
    },
    TIMEOUT,
  );
});

// Side-effecting: books a real appointment AND places a real phone call.
const live = process.env.E2E_LIVE_BOOKING ? describe : describe.skip;

live('booking + confirmation call (LIVE — real calendar entry, real phone call)', () => {
  it(
    'confirming books on cal.com and places the Retell call',
    async () => {
      const dateTime = new Date(Date.now() + 26 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16) + ':00';

      const res = await schedule(
        post('/api/schedule', { patientName: 'E2E Test Patient', dateTime, notes: 'e2e smoke' }),
      );
      const body = await res.json();

      expect(res.status, `schedule failed: ${JSON.stringify(body)}`).toBe(200);
      expect(body.success).toBe(true);
      expect(body.bookingId).toBeTruthy();

      // The call is best-effort by design — a failure must not undo the booking.
      // We assert it was ATTEMPTED and report why if it didn't go out.
      expect(body.confirmationCall, 'no confirmationCall in response — Retell not configured?').toBeDefined();
      if (!body.confirmationCall.called) {
        throw new Error(`booking succeeded but call did not: ${body.confirmationCall.reason}`);
      }
      expect(body.confirmationCall.callId).toBeTruthy();
      console.log(`\n  ☎️  call placed to ${body.confirmationCall.to} — id ${body.confirmationCall.callId}`);
    },
    120_000,
  );
});
