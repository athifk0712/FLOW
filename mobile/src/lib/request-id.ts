import * as Crypto from 'expo-crypto';

// Idempotent saves: a form keeps one request id until its save succeeds. The database stores it with the row
// (transactions.client_request_id, debt_payments.request_id), so a double tap or a retry after a lost response
// returns the row that was already saved instead of writing a second one.

export function newRequestId() {
  return Crypto.randomUUID();
}

/** Postgres unique_violation: the same request id was already saved, so the save actually succeeded. */
export function isAlreadySaved(error: { code?: string } | null) {
  return error?.code === '23505';
}
