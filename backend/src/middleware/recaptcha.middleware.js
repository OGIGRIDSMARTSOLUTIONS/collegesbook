/** Verify a single-use Google reCAPTCHA v2 token before sending registration OTP. */
async function requireRegistrationCaptcha(req, res, next) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const token = req.body?.recaptchaToken;

  if (!secret) {
    return res.status(503).json({ success: false, message: 'Registration CAPTCHA is not configured on the server.' });
  }

  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    return res.status(400).json({ success: false, message: 'Complete the CAPTCHA verification before requesting a code.' });
  }

  try {
    const form = new URLSearchParams({ secret, response: token });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    let response;

    try {
      response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return res.status(503).json({ success: false, message: 'CAPTCHA verification service is temporarily unavailable.' });
    }

    const result = await response.json();
    if (result.success !== true || (result.hostname && !isAllowedHostname(result.hostname))) {
      return res.status(400).json({ success: false, message: 'CAPTCHA verification failed or expired. Please try again.' });
    }

    return next();
  } catch (error) {
    return res.status(503).json({ success: false, message: 'Unable to verify CAPTCHA. Please try again.' });
  }
}

function isAllowedHostname(hostname) {
  const allowed = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || 'localhost')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(hostname.toLowerCase());
}

module.exports = { requireRegistrationCaptcha };
