/** Generate reset links only for explicitly configured frontend origins. */
function passwordResetUrl(token, env = process.env) {
  const candidate = (env.FRONTEND_URL || '').split(',')[0].trim();
  if (!candidate) {
    throw new Error('FRONTEND_URL is required to generate password-reset links');
  }

  let origin;
  try {
    const parsed = new URL(candidate);
    const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
      throw new Error('FRONTEND_URL must use HTTPS outside local development');
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('FRONTEND_URL must be a clean application origin');
    }
    origin = parsed.origin;
  } catch (error) {
    throw new Error(`Invalid FRONTEND_URL: ${error.message}`);
  }

  return `${origin}/reset-password?token=${encodeURIComponent(token)}`;
}

module.exports = { passwordResetUrl };
