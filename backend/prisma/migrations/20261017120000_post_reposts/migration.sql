CREATE TABLE "post_reposts" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "quote" VARCHAR(1000),
    "repostPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_reposts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "post_reposts_postId_studentId_key" ON "post_reposts"("postId", "studentId");
CREATE INDEX "post_reposts_studentId_createdAt_idx" ON "post_reposts"("studentId", "createdAt");
ALTER TABLE "post_reposts" ADD CONSTRAINT "post_reposts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_reposts" ADD CONSTRAINT "post_reposts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts" ADD COLUMN "repostOfId" TEXT;
CREATE INDEX "posts_repostOfId_idx" ON "posts"("repostOfId");
ALTER TABLE "posts" ADD CONSTRAINT "posts_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "post_reposts_repostPostId_key" ON "post_reposts"("repostPostId");
