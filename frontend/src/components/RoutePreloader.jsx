import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function RoutePreloader() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  useEffect(() => {
    if (!authenticated || navigator.connection?.saveData) return undefined;
    const preload = () => {
      import('../features/feed/FeedPage');
      import('../features/yearbook/YearbookPage');
      import('../features/messages/MessagesPage');
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    // Avoid timer-based work on constrained devices.
    return undefined;
  }, [authenticated]);
  return null;
}
