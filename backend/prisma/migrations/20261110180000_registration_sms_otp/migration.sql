CREATE TABLE "RegistrationOtp" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "phoneDigest" TEXT NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "RegistrationOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RegistrationOtp_studentId_createdAt_idx" ON "RegistrationOtp"("studentId", "createdAt");
CREATE INDEX "RegistrationOtp_expiresAt_idx" ON "RegistrationOtp"("expiresAt");
ALTER TABLE "RegistrationOtp" ADD CONSTRAINT "RegistrationOtp_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
