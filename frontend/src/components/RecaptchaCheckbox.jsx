import { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'collegebook-google-recaptcha-script';
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

/** Explicit rendering prevents the widget from being mounted on unrelated forms. */
export function RecaptchaCheckbox({ onVerify, resetSignal = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbackRef = useRef(onVerify);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    callbackRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    if (!SITE_KEY) {
      setLoadError('CAPTCHA site key is missing. Configure VITE_RECAPTCHA_SITE_KEY.');
      return undefined;
    }

    let cancelled = false;
    let retryTimer;

    function renderWidget() {
      if (cancelled || widgetIdRef.current !== null || !containerRef.current) return;
      if (!window.grecaptcha?.render) {
        retryTimer = window.setTimeout(renderWidget, 150);
        return;
      }

      try {
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => callbackRef.current(token),
          'expired-callback': () => callbackRef.current(''),
          'error-callback': () => {
            callbackRef.current('');
            setLoadError('CAPTCHA could not be completed. Reload the page and try again.');
          },
        });
      } catch {
        setLoadError('CAPTCHA failed to load. Reload the page and try again.');
      }
    }

    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    renderWidget();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (resetSignal === 0 || widgetIdRef.current === null) return;
    window.grecaptcha?.reset(widgetIdRef.current);
    callbackRef.current('');
  }, [resetSignal]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} aria-label="Google reCAPTCHA human verification" />
      {loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
    </div>
  );
}
