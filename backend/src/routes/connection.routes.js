const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  sendRequestHandler,
  acceptHandler,
  rejectHandler,
  removeHandler,
  blockHandler,
  unblockHandler,
  listBlockedHandler,
  listConnectionsHandler,
  listPendingHandler,
} = require('../controllers/connection.controller');

const router = express.Router();

router.get('/', authenticate, listConnectionsHandler);
router.get('/pending', authenticate, listPendingHandler);
router.get('/blocked', authenticate, listBlockedHandler);
router.post('/:studentId', authenticate, sendRequestHandler);
router.post('/:studentId/accept', authenticate, acceptHandler);
router.post('/:studentId/reject', authenticate, rejectHandler);
router.post('/:studentId/block', authenticate, blockHandler);
router.delete('/:studentId/block', authenticate, unblockHandler);
router.delete('/:studentId', authenticate, removeHandler);

module.exports = router;
