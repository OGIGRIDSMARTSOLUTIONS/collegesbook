const express = require('express');
const { validate } = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRegistrationCaptcha } = require('../middleware/recaptcha.middleware');
const { authLimiter, registerVerificationLimiter } = require('../middleware/rateLimit.middleware');
const { startRegistrationOtpSchema, completeRegistrationOtpSchema, registerSchema, loginSchema, googleLoginSchema, registrationDepartmentsSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validators/auth.validators');
const {
  registerHandler,
  startRegistrationOtpHandler,
  completeRegistrationOtpHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  registrationDepartmentsHandler,
  loginHandler,
  googleLoginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} = require('../controllers/auth.controller');

const router = express.Router();

// Tighter limit than the general API limiter — §39: auth endpoints are
// the ones worth protecting most against credential-stuffing/brute force.
// Matric number in, that school's departments out (no school is named).
router.post('/registration-departments', authLimiter, validate(registrationDepartmentsSchema), registrationDepartmentsHandler);
// Legacy direct registration is disabled: OTP is mandatory for new accounts.
router.post('/register', (req, res) => res.status(410).json({ success: false, message: 'Email verification is required. Update your CollegeBook app.' }));
router.post('/register/start', authLimiter, registerVerificationLimiter, validate(startRegistrationOtpSchema), requireRegistrationCaptcha, startRegistrationOtpHandler);
router.post('/register/complete', authLimiter, registerVerificationLimiter, validate(completeRegistrationOtpSchema), completeRegistrationOtpHandler);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPasswordHandler);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPasswordHandler);
router.post('/login', authLimiter, validate(loginSchema), loginHandler);
router.post('/google', authLimiter, validate(googleLoginSchema), googleLoginHandler);
router.post('/refresh', authLimiter, refreshHandler);
router.post('/logout', logoutHandler);
router.get('/me', authenticate, meHandler);

module.exports = router;

