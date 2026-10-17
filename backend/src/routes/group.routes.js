const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createGroupSchema, updateMemberRoleSchema } = require('../validators/group.validators');
const { createPostSchema } = require('../validators/post.validators');
const {
  createHandler,
  getHandler,
  listHandler,
  joinHandler,
  leaveHandler,
  addMemberHandler,
  removeMemberHandler,
  updateMemberRoleHandler,
  listMembersHandler,
  listGroupPostsHandler,
  createGroupPostHandler,
} = require('../controllers/group.controller');

const invitationService = require('../services/groupInvitation.service');
const { ok, created } = require('../utils/apiResponse');
const invitationHandler = (fn) => async (req, res, next) => { try { return ok(res, await fn(req)); } catch (error) { next(error); } };
const router = express.Router();
router.get('/invitations/mine', authenticate, invitationHandler(req => invitationService.incoming(req.context)));
router.post('/invitations/:invitationId/accept', authenticate, invitationHandler(req => invitationService.respond(req.context, req.params.invitationId, true)));
router.post('/invitations/:invitationId/decline', authenticate, invitationHandler(req => invitationService.respond(req.context, req.params.invitationId, false)));
router.delete('/invitations/:invitationId', authenticate, invitationHandler(req => invitationService.cancel(req.context, req.params.invitationId)));


router.get('/', authenticate, listHandler);
router.post('/', authenticate, validate(createGroupSchema), createHandler);

router.get('/:id', authenticate, getHandler);
router.get('/:id/invite-candidates', authenticate, invitationHandler(req => invitationService.candidates(req.context, req.params.id, String(req.query.q || '').slice(0, 80))));
router.post('/:id/invitations', authenticate, invitationHandler(req => invitationService.invite(req.context, req.params.id, req.body.studentIds)));
router.get('/:id/members', authenticate, listMembersHandler);
router.get('/:id/posts', authenticate, listGroupPostsHandler);
router.post('/:id/posts', authenticate, validate(createPostSchema), createGroupPostHandler);

router.post('/:id/join', authenticate, joinHandler);
router.post('/:id/leave', authenticate, leaveHandler);

router.post('/:id/members/:studentId', authenticate, addMemberHandler);
router.delete('/:id/members/:studentId', authenticate, removeMemberHandler);
router.patch('/:id/members/:studentId', authenticate, validate(updateMemberRoleSchema), updateMemberRoleHandler);

module.exports = router;
