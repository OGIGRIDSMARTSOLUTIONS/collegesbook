import { useEffect, useState } from 'react';
import { subscribeToasts } from '../lib/toast';

const styles = {
  success: 'border-green-400',
  error: 'border-red-400',
  warning: 'border-amber-400',
  info: 'border-blue-400',
};

export function ToastViewport() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const timers = new Set();
    const unsubscribe = subscribeToasts((item) => {
      setItems((current) => [...current.filter((entry) => entry.message !== item.message), item].slice(-4));
      const timer = window.setTimeout(() => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        timers.delete(timer);
      }, 4500);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <div aria-live="polite" aria-atomic="false" className="fixed right-4 top-4 z-[9999] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 pointer-events-none">
      {items.map((item) => (
        <div key={item.id} role={item.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-3 rounded-lg border-l-4 bg-white px-4 py-3 text-sm text-gray-900 shadow-xl ${styles[item.type] || styles.info}`}>
          <span className="flex-1">{item.message}</span>
          <button type="button" aria-label="Dismiss notification" className="text-gray-500 hover:text-gray-900"
            onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
