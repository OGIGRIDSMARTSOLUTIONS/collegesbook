/** Browser request safeguards for cookie-authenticated CollegeBook APIs. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function permittedOrigins() {
  const configured = [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }
  return new Set(configured);
}

function isAllowedOrigin(origin) {
  if (!origin || origin === 'null') return false;
  try {
    const url = new URL(origin);
    return url.origin === origin.replace(/\/$/, '') && permittedOrigins().has(url.origin);
  } catch {
    return false;
  }
}

function requestSecurity(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/messages')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  if (SAFE_METHODS.has(req.method) || !req.path.startsWith('/api')) return next();

  const origin = req.get('origin');
  // Non-browser API clients may omit Origin. Cookie-authenticated browser
  // requests must provide a valid Origin (or same-origin Referer fallback).
  const cookieAuthenticated = Boolean(req.cookies?.accessToken || req.cookies?.refreshToken);
  if (!origin && !cookieAuthenticated) return next();
  if (origin && isAllowedOrigin(origin)) return next();
  if (!origin && cookieAuthenticated) {
    const referer = req.get('referer');
    if (referer) {
      try {
        if (isAllowedOrigin(new URL(referer).origin)) return next();
      } catch { /* invalid referer */ }
    }
  }
  return res.status(403).json({ success: false, message: 'Request origin not permitted' });
}

module.exports = { requestSecurity, isAllowedOrigin, permittedOrigins };
