-- Performance indexes for the hottest list queries. Additive only; no data changes.
-- IF NOT EXISTS makes the migration safe to re-run against a database where an
-- index was already created by hand. Names follow Prisma's {table}_{columns}_idx
-- convention so `prisma migrate dev` reports no drift.

-- Notifications list: WHERE recipientId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "notifications_recipientId_createdAt_idx" ON "notifications"("recipientId", "createdAt");

-- Comment thread load: WHERE postId = ? ORDER BY createdAt ASC
CREATE INDEX IF NOT EXISTS "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt");

-- Profile post list: WHERE authorId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "posts_authorId_createdAt_idx" ON "posts"("authorId", "createdAt");
