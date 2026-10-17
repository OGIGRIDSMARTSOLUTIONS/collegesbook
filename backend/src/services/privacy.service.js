const prisma = require('../config/db');

async function getOwnPrivacy(studentId) {
  const privacy = await prisma.studentPrivacy.upsert({
    where: { studentId },
    update: {},
    create: { studentId }, // defaults from schema if somehow missing
  });
  // Upgrade legacy values on first access without changing Prisma enum history.
  if (['APPROVED_INSTITUTIONS', 'EVERYONE'].includes(privacy.whoCanMessage)) {
    return prisma.studentPrivacy.update({
      where: { studentId },
      data: { whoCanMessage: 'INSTITUTION_ONLY' },
    });
  }
  return privacy;
}

async function updateOwnPrivacy(studentId, data) {
  return prisma.studentPrivacy.upsert({
    where: { studentId },
    update: data,
    create: { studentId, ...data },
  });
}

module.exports = { getOwnPrivacy, updateOwnPrivacy };
