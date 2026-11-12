const prisma = require('../config/db');
const { ApiError } = require('../utils/apiResponse');

async function recoverStudentPhone(institutionId, studentId, actorUserId, { phoneNumber, reason }) {
  const normalized = String(phoneNumber).replace(/\D/g, '');
  if (!/^0[789]\d{9}$/.test(normalized)) {
    throw new ApiError('Enter an 11-digit Nigerian mobile number', 400);
  }
  if (!reason || reason.trim().length < 10) {
    throw new ApiError('Record a recovery reason of at least 10 characters', 400);
  }
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: studentId, institutionId },
      select: { id: true, userId: true, phoneNumber: true },
    });
    if (!student) throw new ApiError('Student not found in your institution', 404);
    if (student.userId) throw new ApiError('This recovery route is for unclaimed student records only', 409);
    if (student.phoneNumber === normalized) return { updated: false };
    await tx.student.update({ where: { id: studentId }, data: { phoneNumber: normalized } });
    await tx.registrationOtp.updateMany({
      where: { studentId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.studentAccessEvent.create({
      data: { institutionId, studentId, actorUserId,
        action: 'REGISTRATION_PHONE_RECOVERY', reason: reason.trim() },
    });
    return { updated: true, message: 'Registry phone updated; outstanding OTP codes invalidated' };
  });
}
module.exports = { recoverStudentPhone };
