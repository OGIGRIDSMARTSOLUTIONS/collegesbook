/**
 * Short-lived per-instance cache of the request context built by
 * middleware/auth.middleware.js.
 *
 * Why: `authenticate` runs on EVERY API call and previously cost 3-4 database
 * round trips each time (user -> student -> privacy -> staff). A page load
 * fires ~10 API calls, so that was 30-40 queries before any real work began.
 *
 * Safety: the TTL is deliberately tiny, and anything that suspends, bans or
 * withdraws a student calls disconnectStudent(), which also evicts the entry
 * (see websocket/socket.js), so revocation is immediate on those paths.
 */
const TTL_MS = Number(process.env.AUTH_CONTEXT_CACHE_MS || 10_000);
const MAX_ENTRIES = 5000;

const entries = new Map(); // userId -> { context, expiresAt }

function get(userId) {
  if (TTL_MS <= 0) return null;
  const hit = entries.get(userId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    entries.delete(userId);
    return null;
  }
  return hit.context;
}

function set(userId, context) {
  if (TTL_MS <= 0) return;
  if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value);
  entries.set(userId, { context, expiresAt: Date.now() + TTL_MS });
}

function invalidate(userId) {
  if (userId) entries.delete(userId);
}

function invalidateByStudentId(studentId) {
  for (const [userId, { context }] of entries) {
    if (context.studentId === studentId) entries.delete(userId);
  }
}

module.exports = { get, set, invalidate, invalidateByStudentId };
