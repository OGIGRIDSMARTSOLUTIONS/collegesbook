const express = require('express');
const prisma = require('../config/db');

const router = express.Router();

// Public, rate-limited, read-only database warm-up; no user data is queried.
router.get('/', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    console.error('[warmup] Database unavailable:', error.message);
    return res.status(503).json({ status: 'unavailable' });
  }
});

module.exports = router;
