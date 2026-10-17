const prisma = require('../config/db');
const cache = require('./cache.service');
const { getIO } = require('../websocket/socket');

async function notifyChanged(studentIds) {
  const ids = [...new Set(studentIds.filter(Boolean))];
  if (!ids.length) return;
  await Promise.all(ids.map(async (id) => {
    await cache.del(`notifications:unread:${id}`);
    const io = getIO();
    if (io) io.to(`student:${id}`).emit('notification:changed', { recipientId: id });
  }));
}

async function createNotification(recipientId, type, payload) {
  const notification = await prisma.notification.create({ data: { recipientId, type, payload } });
  await notifyChanged([recipientId]);
  return notification;
}

module.exports = { createNotification, notifyChanged };
