import { useEffect } from 'react';

// A single, best-effort wake-up per browser page load. The request is not
// coupled to authentication, the form, or any loading indicator.
let warmupStarted = false;

export function useBackendWarmup() {
  useEffect(() => {
    if (warmupStarted) return undefined;
    warmupStarted = true;

    // A timer lets the browser paint the login form before starting I/O.
    // It also avoids making the first render depend on Render or Neon.
    window.setTimeout(() => {
      const configuredBase = (
        import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
      ).replace(/\/+$/, '');

      const apiBase = configuredBase.endsWith('/api')
        ? configuredBase
        : `${configuredBase}/api`;

      fetch(`${apiBase}/warmup`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
      }).catch(() => {
        // A sleeping or unavailable backend must not block sign-in.
      });
    }, 0);

    // Intentionally do not cancel on navigation: warming is independent
    // of this component and StrictMode may replay the effect.
    return undefined;
  }, []);
}
