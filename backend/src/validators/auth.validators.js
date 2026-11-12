const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  matriculationNumber: z.string().min(1, 'Matriculation number is required').max(80),
  // departmentId comes from the registration dropdown (which only lists
  // the departments of the school holding this matric number). The
  // free-text department is still accepted for older app versions.
  departmentId: z.string().min(1).max(60).optional(),
  department: z.string().max(160).optional(),
  phoneNumber: z.string().min(7, 'Enter a valid phone number').max(25).optional(),
}).refine((data) => Boolean(data.departmentId || data.department?.trim() || data.phoneNumber?.trim()), {
  message: 'Provide either your department or phone number',
  path: ['department'],
});

const startRegistrationOtpSchema = z.object({
  recaptchaToken: z.string().min(20).max(4096),
  email: z.string().trim().toLowerCase().email(),
  matriculationNumber: z.string().trim().min(1).max(80),
  departmentId: z.string().min(1).max(60).optional(),
  phoneNumber: z.string().min(7).max(25).optional(),
}).refine((value) => Boolean(value.departmentId || value.phoneNumber), {
  message: 'Provide a department or registry phone number',
});

const completeRegistrationOtpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit email code'),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleLoginSchema = z.object({
  credential: z.string().min(1), // the raw Google ID token (JWT) from Google Identity Services
});

const registrationDepartmentsSchema = z.object({
  matriculationNumber: z.string().trim().min(1, 'Matriculation number is required').max(80),
});

const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
module.exports = { startRegistrationOtpSchema, completeRegistrationOtpSchema, registerSchema, loginSchema, googleLoginSchema, registrationDepartmentsSchema, forgotPasswordSchema, resetPasswordSchema };
