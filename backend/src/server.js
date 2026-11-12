require('dotenv').config();

const http = require('http');
const app = require('./app');
const prisma = require('./config/db');
const { initSocket } = require('./websocket/socket');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
initSocket(server);

const MAX_DATABASE_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
let shuttingDown = false;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function connectDatabase() {
  for (let attempt = 1; attempt <= MAX_DATABASE_ATTEMPTS; attempt += 1) {
    if (shuttingDown) return false;

    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error(
        `[startup] Database connection attempt ${attempt}/${MAX_DATABASE_ATTEMPTS} failed:`,
        error.message
      );

      if (attempt === MAX_DATABASE_ATTEMPTS) return false;
      await prisma.$disconnect().catch(() => {});
      await wait(RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  return false;
}

async function start() {
  const started = Date.now();
  app.locals.databaseReady = false;

  const ready = await connectDatabase();
  if (shuttingDown) return;

  if (!ready) {
    console.error('[startup] Neon unavailable after bounded retries; exiting.');
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
    return;
  }

  app.locals.databaseReady = true;
  console.log(`[startup] Database ready in ${Date.now() - started}ms`);
  server.listen(PORT, () => {
    console.log(`CollegeBook backend listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('[startup] Unexpected error:', error);
  process.exit(1);
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.locals.databaseReady = false;
  console.log(`[shutdown] ${signal}`);

  if (!server.listening) {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
    return;
  }

  server.close(async () => {
    await prisma.$disconnect().catch((error) => {
      console.error('[shutdown] Prisma:', error.message);
    });
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
