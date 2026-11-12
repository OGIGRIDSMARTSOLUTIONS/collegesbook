const prisma = require('../config/db');
const crypto = require('node:crypto');
const { sendRegistrationOtp } = require('./registrationEmail.service');
const { resend, isEmailConfigured, fromAddress } = require('../config/resend');
const { enrollStudentsInClassYearBooks } = require('./yearbookEnrollment.service');
const { OAuth2Client } = require('google-auth-library');
const { hashPassword, comparePassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * register — creates a User + Student together. The client supplies
 * institutionCode / setCode (human-readable, e.g. "UNILAG" / a set's public
 * code), which are resolved to real internal IDs here. This is what
 * §5.3 means by never trusting client-supplied institutionId directly:
 * the client never gets to say "put me in institution X" by ID — only by
 * a public code that's looked up and validated server-side.
 */
function normalizeIdentity(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeMatriculation(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

function normalizePhone(value) {
  return String(value ?? '').replace(/[^0-9+]/g, '');
}

function normalizeDepartment(value) {
  return normalizeIdentity(value);
}

function splitName(name) {
  const parts = String(name ?? '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!parts.length) return { firstName: 'Student', lastName: 'User' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * register — the student registry is now the institutional source of truth.
 * Matriculation is mandatory. At least one of department or phone must also
 * be supplied. No institution/set/department codes are exposed to students.
 *
 * Matching rule:
 *   - matriculation MUST match
 *   - department OR phone MUST match
 *   - when both are supplied, any 2 of the 3 fields may match
 *   - an ambiguous match is never auto-assigned
 */
function matriculationVariantsOf(matriculationNumber) {
  const input = String(matriculationNumber ?? '').trim();
  return [...new Set([normalizeMatriculation(input), input, input.toUpperCase(), input.replace(/\s+/g, '')].filter(Boolean))];
}

/**
 * registrationDepartments — the registration dropdown. Given only a
 * matriculation number, returns the departments of the school(s) that
 * hold an UNCLAIMED record with that number. No institution name, code or
 * count is ever returned, so a student never learns which other schools
 * use CollegeBook. Read live, so newly added departments appear at once.
 */
async function registrationDepartments({ matriculationNumber }) {
  const records = await prisma.student.findMany({
    where: {
      studentNumber: { in: matriculationVariantsOf(matriculationNumber) },
      userId: null,
      institution: { status: 'ACTIVE' },
    },
    select: { institutionId: true },
  });
  const institutionIds = [...new Set(records.map((r) => r.institutionId))];
  if (!institutionIds.length) {
    throw new ApiError('We could not find an unregistered student record for that matriculation number. Check it, or contact your school.', 404);
  }

  const departments = await prisma.department.findMany({
    where: { institutionId: { in: institutionIds } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, faculty: { select: { name: true } } },
  });
  return departments.map((d) => ({ id: d.id, name: d.name, facultyName: d.faculty?.name ?? null }));
}

async function register({ email, password, matriculationNumber, departmentId, department, phoneNumber, expectedStudentId }) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  // PostgreSQL text uniqueness is case-sensitive by default; check regardless of case.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError('This email is already registered. Please log in or reset your password.', 409);
  }

  const matriculationInput = String(matriculationNumber ?? '').trim();
  const matric = normalizeMatriculation(matriculationInput);
  const suppliedDepartment = department ? normalizeDepartment(department) : null;
  const suppliedPhone = phoneNumber ? normalizePhone(phoneNumber) : null;

  if (!matric) throw new ApiError('Matriculation number is required', 400);
  if (!departmentId && !suppliedDepartment && !suppliedPhone) {
    throw new ApiError('Provide either your department or phone number for verification', 400);
  }

  const matriculationVariants = matriculationVariantsOf(matriculationInput);

  const candidates = await prisma.student.findMany({
    where: { studentNumber: { in: matriculationVariants } },
    include: {
      department: { select: { id: true, name: true, code: true, facultyId: true } },
      academicSet: { select: { id: true, name: true, institutionId: true } },
      institution: { select: { id: true, name: true, status: true } },
    },
  });

  if (!candidates.length) {
    throw new ApiError('We could not find an institutional student record for that matriculation number', 404);
  }

  const scored = candidates.map((student) => {
    // Picked from the dropdown: compare ids exactly. Typed text (older app
    // versions) still falls back to the name/code comparison.
    const departmentMatch = departmentId
      ? student.departmentId === departmentId
      : Boolean(
        suppliedDepartment && student.department &&
        [student.department.name, student.department.code]
          .map(normalizeDepartment)
          .includes(suppliedDepartment)
      );
    const phoneMatch = Boolean(suppliedPhone && student.phoneNumber && normalizePhone(student.phoneNumber) === suppliedPhone);
    const score = 1 + (departmentMatch ? 1 : 0) + (phoneMatch ? 1 : 0);
    return { student, departmentMatch, phoneMatch, score };
  });

  const matches = scored.filter((item) => item.score >= 2 && item.student.institution.status === 'ACTIVE' && item.student.registryApproved);
  if (!matches.length) {
    throw new ApiError('Your matriculation number was found, but the department/phone information did not verify the student record', 409);
  }
  if (matches.length > 1) {
    throw new ApiError('More than one student record matched. Please contact your institution administrator for verification', 409);
  }

  const match = matches[0].student;
  if (expectedStudentId && match.id !== expectedStudentId) {
    throw new ApiError('Student registry match changed. Request a new code.', 409);
  }
  if (!match.registryApproved) throw new ApiError('Institution has withdrawn approval for this student', 403);
  if (match.userId) {
    throw new ApiError('This institutional student record already has a CollegeBook account', 409);
  }

  const passwordHash = await hashPassword(password);
  const { firstName, lastName } = splitName([match.firstName, match.lastName, match.otherNames].filter(Boolean).join(' '));

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
    // Serialize registration by email across concurrent requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail}))`;
    const alreadyRegistered = await tx.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (alreadyRegistered) {
      throw new ApiError('This email is already registered. Please log in or reset your password.', 409);
    }
    const createdUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
      },
    });

    await tx.student.update({
      where: { id: match.id },
      data: {
        userId: createdUser.id,
        verificationStatus: 'VERIFIED',
      },
    });

    // Automatically place the newly claimed student into every active
    // YearBook of their academic class (no-op if they are already listed).
    await enrollStudentsInClassYearBooks(tx, { institutionId: match.institutionId, setId: match.setId, studentIds: [match.id] });

    return createdUser;
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ApiError('This email or student account is already registered. Please log in or contact your institution.', 409);
    }
    throw error;
  }

  return { ...user, firstName, lastName, institutionId: match.institutionId, studentId: match.id };
}


const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function normalizeRegistryEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function otpDigest(challengeId, code) {
  const secret = process.env.REGISTRATION_OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError('Registration verification is not configured', 503);
  }
  return crypto.createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

async function startRegistrationOtp({ matriculationNumber, departmentId, phoneNumber, email }) {
  const records = await prisma.student.findMany({
    where: {
      studentNumber: { in: matriculationVariantsOf(matriculationNumber) },
      userId: null,
      registryApproved: true,
      institution: { status: 'ACTIVE' },
    },
    select: { id: true, registryEmail: true, phoneNumber: true, departmentId: true },
    take: 10,
  });

  const matches = records.filter((student) => {
    const departmentMatches = Boolean(departmentId && student.departmentId === departmentId);
    const phoneMatches = Boolean(
      phoneNumber && student.phoneNumber &&
      normalizePhone(student.phoneNumber) === normalizePhone(phoneNumber)
    );
    return departmentMatches || phoneMatches;
  });

  if (matches.length !== 1 || !matches[0].registryEmail) {
    throw new ApiError('Unable to verify registry details or no registered email is available. Contact your institution administrator.', 400);
  }

  if (!isEmailConfigured() || !process.env.REGISTRATION_OTP_SECRET ||
      process.env.REGISTRATION_OTP_SECRET.length < 32) {
    throw new ApiError('Email verification is temporarily unavailable', 503);
  }

  const student = matches[0];
  const destination = normalizeRegistryEmail(student.registryEmail);
  if (normalizeRegistryEmail(email) !== destination) {
    throw new ApiError('Registration details do not match the institution record. Contact your administrator.', 400);
  }
  const existing = await prisma.registrationOtp.findFirst({
    where: { studentId: student.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (existing && Date.now() - existing.createdAt.getTime() < OTP_RESEND_MS) {
    throw new ApiError('Please wait 60 seconds before requesting another code', 429);
  }

  const id = crypto.randomUUID();
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const emailDigest = crypto.createHash('sha256').update(destination).digest('hex');

  await prisma.$transaction(async (tx) => {
    await tx.registrationOtp.updateMany({
      where: { studentId: student.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.registrationOtp.create({
      data: {
        id,
        studentId: student.id,
        emailDigest,
        codeDigest: otpDigest(id, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
  });

  try {
    await sendRegistrationOtp(destination, code);
  } catch (error) {
    await prisma.registrationOtp.updateMany({
      where: { id },
      data: { consumedAt: new Date() },
    });
    console.error('[registration-email] Delivery failed:', error.message);
    throw new ApiError('Verification email could not be delivered. Please try later.', 503);
  }

  return { challengeId: id, maskedEmail: maskEmail(destination), expiresInSeconds: 300 };
}

async function completeRegistrationOtp({ challengeId, code, email, password }) {
  const normalizedEmail = normalizeRegistryEmail(email);
  const challenge = await prisma.registrationOtp.findUnique({
    where: { id: challengeId },
    include: {
      student: {
        select: {
          id: true,
          registryEmail: true,
          userId: true,
          registryApproved: true,
          institution: { select: { status: true } },
        },
      },
    },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() ||
      challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError('Verification code expired or invalid. Request a new code.', 400);
  }

  // Failed attempts must persist even if account creation is rolled back.
  const attempts = await prisma.registrationOtp.updateMany({
    where: {
      id: challengeId,
      consumedAt: null,
      attempts: { lt: OTP_MAX_ATTEMPTS },
      expiresAt: { gt: new Date() },
    },
    data: { attempts: { increment: 1 } },
  });
  if (attempts.count !== 1) throw new ApiError('Verification code expired or invalid.', 400);

  const expected = otpDigest(challengeId, code);
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(challenge.codeDigest, 'hex'))) {
    throw new ApiError('Incorrect verification code', 400);
  }

  const student = challenge.student;
  if (!student || student.userId || !student.registryApproved ||
      student.institution.status !== 'ACTIVE' ||
      normalizeRegistryEmail(student.registryEmail) !== normalizedEmail ||
      crypto.createHash('sha256').update(normalizedEmail).digest('hex') !== challenge.emailDigest) {
    throw new ApiError('Registry email or student record changed. Request a new code.', 409);
  }

  const passwordHash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      const consumed = await tx.registrationOtp.updateMany({
        where: {
          id: challengeId,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lte: OTP_MAX_ATTEMPTS },
        },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw new ApiError('Verification code already used', 409);

      const current = await tx.student.findFirst({
        where: {
          id: student.id,
          userId: null,
          registryApproved: true,
          registryEmail: normalizedEmail,
          institution: { status: 'ACTIVE' },
        },
        select: { id: true },
      });
      if (!current) throw new ApiError('Student registry record changed', 409);

      const existingUser = await tx.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existingUser) throw new ApiError('This email already has a CollegeBook account', 409);

      const user = await tx.user.create({
        data: { email: normalizedEmail, passwordHash, role: 'STUDENT', accountStatus: 'ACTIVE' },
      });
      const claimed = await tx.student.updateMany({
        where: { id: student.id, userId: null, registryEmail: normalizedEmail },
        data: { userId: user.id, verificationStatus: 'VERIFIED' },
      });
      if (claimed.count !== 1) throw new ApiError('Student already registered', 409);
      return user;
    }, { maxWait: 10000, timeout: 15000 });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ApiError('This email or student account is already registered', 409);
    }
    throw error;
  }
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError('Invalid email or password', 401);

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new ApiError('Invalid email or password', 401);

  if (user.accountStatus === 'PENDING') throw new ApiError('Account pending activation', 403);
  if (user.accountStatus === 'SUSPENDED') throw new ApiError('Account suspended', 403);
  if (user.accountStatus === 'BANNED') throw new ApiError('Account banned', 403);
  if (await prisma.student.findFirst({ where: { userId: user.id, registryApproved: false }, select: { id: true } })) {
    throw new ApiError('Institution has withdrawn CollegeBook access', 403);
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { user, accessToken, refreshToken };
}

/**
 * loginWithGoogle — deliberately scoped to LOGIN, not sign-up. A Google ID
 * token proves ownership of an email address; it says nothing about which
 * institution or academic set someone belongs to, and per §5.3 that
 * information can only ever come from institutionCode/setCode resolved
 * server-side (see register() above) — Google can't supply it, so we
 * don't try to auto-create an account here. If no CollegeBook account
 * exists for the verified email, this fails with a clear message rather
 * than silently fabricating a Student record with no institution.
 *
 * Verification (not just decoding) matters: verifyIdToken checks the
 * token's signature against Google's public keys and its `aud` claim
 * against our own GOOGLE_CLIENT_ID, so a client can't forge an arbitrary
 * email by just sending a JSON blob shaped like a Google token.
 */
async function loginWithGoogle(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError('Google sign-in is not configured on this server', 501);
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError('Invalid Google sign-in token', 401);
  }

  if (!payload?.email_verified) {
    throw new ApiError('Google account email is not verified', 401);
  }

  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user) {
    throw new ApiError('No CollegeBook account found for this Google email. Register first.', 404);
  }

  if (user.accountStatus === 'PENDING') throw new ApiError('Account pending activation', 403);
  if (user.accountStatus === 'SUSPENDED') throw new ApiError('Account suspended', 403);
  if (user.accountStatus === 'BANNED') throw new ApiError('Account banned', 403);
  if (await prisma.student.findFirst({ where: { userId: user.id, registryApproved: false }, select: { id: true } })) {
    throw new ApiError('Institution has withdrawn CollegeBook access', 403);
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { user, accessToken, refreshToken };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new ApiError('Not authenticated', 401);

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError('Invalid or expired session', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new ApiError('Not authenticated', 401);
  if (user.accountStatus !== 'ACTIVE') throw new ApiError('Account not active', 403);
  if (await prisma.student.findFirst({ where: { userId: user.id, registryApproved: false }, select: { id: true } })) {
    throw new ApiError('Institution has withdrawn CollegeBook access', 403);
  }

  const accessToken = signAccessToken(user.id);
  return { accessToken, user };
}

/**
 * Password-reset requests always return the same public response, regardless
 * of account existence or email delivery status. Operational failures are
 * recorded server-side without exposing the token or email address.
 */
async function requestPasswordReset({ email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!isEmailConfigured()) {
    console.error('[password-reset] Email provider unavailable: configure RESEND_API_KEY and RESEND_FROM_EMAIL.');
    return;
  }

  // Avoid revealing whether an address belongs to a CollegeBook account.
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const { passwordResetUrl } = require('../utils/passwordResetUrl');
  let url;
  try {
    url = passwordResetUrl(token);
  } catch (error) {
    console.error('[password-reset] Configuration error:', error.message);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetTokenHash, passwordResetExpiresAt },
  });

  try {
    const result = await resend.emails.send({
      from: fromAddress(),
      to: user.email,
      subject: 'Reset your CollegeBook password',
      text: `A password reset was requested for your CollegeBook account.\n\nOpen this link within 15 minutes:\n${url}\n\nIf you did not request this, ignore this email.`,
    });

    if (result?.error) {
      throw new Error(result.error.message || 'Email provider rejected the request');
    }
    if (!result?.data?.id) {
      throw new Error('Email provider did not confirm message acceptance');
    }

    console.info('[password-reset] Reset email accepted by provider');
  } catch (error) {
    // Conditional cleanup avoids invalidating a newer reset request.
    await prisma.user.updateMany({
      where: { id: user.id, passwordResetTokenHash },
      data: { passwordResetTokenHash: null, passwordResetExpiresAt: null },
    }).catch((cleanupError) => {
      console.error('[password-reset] Token cleanup failed:', cleanupError.message);
    });

    console.error('[password-reset] Email delivery failed:', error.message);
  }
}

async function resetPassword({ token, password }) {
  const passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findUnique({ where: { passwordResetTokenHash } });
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
    throw new ApiError('Reset link is invalid or has expired', 400);
  }
  const passwordHash = await hashPassword(password);
  // Atomic update prevents the same reset token from being redeemed twice.
  const result = await prisma.user.updateMany({
    where: { id: user.id, passwordResetTokenHash, passwordResetExpiresAt: { gt: new Date() } },
    data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null, refreshTokenHash: null },
  });
  if (result.count !== 1) throw new ApiError('Reset link is invalid or has expired', 400);
}

module.exports = { startRegistrationOtp, completeRegistrationOtp, register, registrationDepartments, login, loginWithGoogle, refresh, requestPasswordReset, resetPassword };
