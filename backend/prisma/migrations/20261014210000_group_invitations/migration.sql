CREATE TABLE "group_invitations" (
 "id" TEXT NOT NULL,
 "groupId" TEXT NOT NULL,
 "inviterId" TEXT NOT NULL,
 "inviteeId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "respondedAt" TIMESTAMP(3),
 CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "group_invitations_groupId_inviteeId_key" ON "group_invitations"("groupId", "inviteeId");
CREATE INDEX "group_invitations_inviteeId_status_idx" ON "group_invitations"("inviteeId", "status");
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
