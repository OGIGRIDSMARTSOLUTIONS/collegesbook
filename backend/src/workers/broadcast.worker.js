const { Worker } = require('bullmq');
const prisma = require('../config/db');
const { createClient } = require('../config/redis');
const cache = require('../services/cache.service');

/**
 * startBroadcastWorker — run via `npm run worker` as a SEPARATE process
 * from the API server. This is deliberate: the whole point of moving
 * fan-out to a queue is that it happens off the request/response cycle,
 * on its own process (or its own dyno/instance in production), so a
 * 50,000-student broadcast never ties up an API server that's also
 * trying to serve normal traffic.
 */
function startBroadcastWorker() {
  return new Worker(
    'broadcast-fanout',
    async (job) => {
      const { broadcastId, recipientStudentIds, title } = job.data;

      await prisma.$transaction([
        prisma.broadcastRecipient.createMany({
          data: recipientStudentIds.map((studentId) => ({ broadcastId, studentId })),
          skipDuplicates: true,
        }),
        prisma.notification.createMany({
          data: recipientStudentIds.map((studentId) => ({
            recipientId: studentId,
            type: 'INSTITUTION_BROADCAST',
            payload: { broadcastId, title },
          })),
        }),
      ]);

      // Invalidate unread counts before signaling the API process.
      await Promise.all(recipientStudentIds.map((id) => cache.del(`notifications:unread:${id}`)));
      const publisher = createClient({ label: 'broadcast-notification-publisher' });
      try {
        await publisher.publish('collegebook:notification-changed', JSON.stringify(recipientStudentIds));
      } finally {
        await publisher.quit();
      }
      return { processed: recipientStudentIds.length };
    },
    { connection: createClient() }
  );
}

module.exports = { startBroadcastWorker };
