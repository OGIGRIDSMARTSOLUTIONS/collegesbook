const prisma = require('../config/db');
const { ApiError } = require('../utils/apiResponse');
const { createNotification } = require('./notificationPublisher.service');
const cache = require('./cache.service');

const studentSelect = { id: true, firstName: true, lastName: true, profilePhotoUrl: true };
const expires = () => new Date(Date.now() + 14 * 86400000);

async function invite(actor, groupId, studentIds) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.institutionId !== actor.institutionId) throw new ApiError('Group not found', 404);
  const membership = await prisma.groupMembership.findUnique({ where: { groupId_studentId: { groupId, studentId: actor.studentId } } });
  if (!membership) throw new ApiError('Only group members can invite students', 403);
  if (!Array.isArray(studentIds) || !studentIds.length || studentIds.length > 30 || studentIds.some(id => typeof id !== 'string')) throw new ApiError('Choose 1 to 30 students', 400);
  const unique = [...new Set(studentIds)].filter(id => id !== actor.studentId);
  const students = await prisma.student.findMany({ where: { id: { in: unique }, institutionId: actor.institutionId, userId: { not: null } }, select: studentSelect });
  if (students.length !== unique.length) throw new ApiError('Some students are not eligible for invitations', 400);
  const results = [];
  for (const student of students) {
    const existing = await prisma.groupMembership.findUnique({ where: { groupId_studentId: { groupId, studentId: student.id } } });
    if (existing) { results.push({ studentId: student.id, status: 'MEMBER' }); continue; }
    const invitation = await prisma.groupInvitation.upsert({
      where: { groupId_inviteeId: { groupId, inviteeId: student.id } },
      create: { groupId, inviterId: actor.studentId, inviteeId: student.id, expiresAt: expires() },
      update: { inviterId: actor.studentId, status: 'PENDING', expiresAt: expires(), respondedAt: null },
    });
    await createNotification(student.id, 'SYSTEM', { kind: 'GROUP_INVITATION', groupId, invitationId: invitation.id, groupName: group.name, inviterId: actor.studentId });
    results.push({ studentId: student.id, status: 'PENDING' });
  }
  return results;
}

async function candidates(actor, groupId, query = '') {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.institutionId !== actor.institutionId) throw new ApiError('Group not found', 404);
  const member = await prisma.groupMembership.findUnique({ where: { groupId_studentId: { groupId, studentId: actor.studentId } } });
  if (!member) throw new ApiError('Membership required', 403);
  const students = await prisma.student.findMany({
    where: { institutionId: actor.institutionId, userId: { not: null }, id: { not: actor.studentId }, OR: [{ firstName: { contains: query, mode: 'insensitive' } }, { lastName: { contains: query, mode: 'insensitive' } }] },
    select: studentSelect, take: 30, orderBy: { firstName: 'asc' },
  });
  const ids = students.map(s => s.id);
  const [members, invites] = await Promise.all([
    prisma.groupMembership.findMany({ where: { groupId, studentId: { in: ids } }, select: { studentId: true } }),
    prisma.groupInvitation.findMany({ where: { groupId, inviteeId: { in: ids }, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { inviteeId: true } }),
  ]);
  const memberIds = new Set(members.map(m => m.studentId));
  const inviteIds = new Set(invites.map(i => i.inviteeId));
  return students.map(s => ({ ...s, status: memberIds.has(s.id) ? 'MEMBER' : inviteIds.has(s.id) ? 'INVITED' : 'AVAILABLE' }));
}

async function incoming(actor) {
  return prisma.groupInvitation.findMany({
    where: { inviteeId: actor.studentId, status: 'PENDING', expiresAt: { gt: new Date() }, group: { institutionId: actor.institutionId } },
    include: { group: { select: { id: true, name: true, kind: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function respond(actor, invitationId, accept) {
  const result = await prisma.$transaction(async tx => {
    const invitation = await tx.groupInvitation.findUnique({ where: { id: invitationId }, include: { group: true } });
    if (!invitation || invitation.inviteeId !== actor.studentId) throw new ApiError('Invitation not found', 404);
    if (invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) throw new ApiError('Invitation is no longer active', 409);
    if (invitation.group.institutionId !== actor.institutionId) throw new ApiError('Institution mismatch', 403);
    const updated = await tx.groupInvitation.updateMany({ where: { id: invitationId, status: 'PENDING' }, data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() } });
    if (!updated.count) throw new ApiError('Invitation already handled', 409);
    if (accept) await tx.groupMembership.upsert({ where: { groupId_studentId: { groupId: invitation.groupId, studentId: actor.studentId } }, create: { groupId: invitation.groupId, studentId: actor.studentId, role: 'MEMBER' }, update: {} });
    return { status: accept ? 'ACCEPTED' : 'DECLINED', groupId: invitation.groupId, inviterId: invitation.inviterId };
  });
  await cache.del(`groups:list:${actor.institutionId}:${actor.studentId}`);
  await createNotification(result.inviterId, 'SYSTEM', { kind: 'GROUP_INVITATION_RESPONSE', groupId: result.groupId, status: result.status, studentId: actor.studentId });
  return result;
}

async function cancel(actor, invitationId) {
  const invitation = await prisma.groupInvitation.findUnique({ where: { id: invitationId }, include: { group: true } });
  if (!invitation || invitation.group.institutionId !== actor.institutionId) throw new ApiError('Invitation not found', 404);
  const member = await prisma.groupMembership.findUnique({ where: { groupId_studentId: { groupId: invitation.groupId, studentId: actor.studentId } } });
  if (invitation.inviterId !== actor.studentId && !['ADMIN', 'MODERATOR'].includes(member?.role)) throw new ApiError('Not permitted', 403);
  await prisma.groupInvitation.updateMany({ where: { id: invitationId, status: 'PENDING' }, data: { status: 'CANCELLED', respondedAt: new Date() } });
  return { cancelled: true };
}

module.exports = { invite, candidates, incoming, respond, cancel };
