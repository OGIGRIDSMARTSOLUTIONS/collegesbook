-- Preserve existing student and YearBook records. Existing students can be assigned emails by their institution admin.
ALTER TABLE "students" ADD COLUMN "registryEmail" TEXT;
CREATE UNIQUE INDEX "students_registryEmail_key" ON "students"("registryEmail");
-- Any outstanding SMS challenges become invalid under the new email OTP flow.
UPDATE "RegistrationOtp" SET "consumedAt" = CURRENT_TIMESTAMP WHERE "consumedAt" IS NULL;
ALTER TABLE "RegistrationOtp" RENAME COLUMN "phoneDigest" TO "emailDigest";
