const express = require('express');
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { uploadRequestSchema } = require('../validators/upload.validators');
const { uploadHandler } = require('../controllers/upload.controller');
const { ApiError } = require('../utils/apiResponse');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

router.post(
  '/',
  authenticate,
  upload.single('file'),
  validate(uploadRequestSchema),
  (req, res, next) => {
    if (!req.file) return next(new ApiError('No file uploaded', 400));
    const purpose = req.body.purpose;
    if (['yearbook', 'institution-logo', 'document'].includes(purpose)) {
      return requireRole('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'YEARBOOK_ADMIN')(req, res, next);
    }
    next();
  },
  uploadHandler
);

module.exports = router;
