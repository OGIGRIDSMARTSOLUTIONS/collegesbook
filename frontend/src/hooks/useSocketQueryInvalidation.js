import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../services/socket';

/**
 * Socket events are invalidation hints, never trusted application data.
 * Queries are always refreshed through the authenticated API, preserving
 * institution and group visibility rules. Listeners are removed on unmount.
 */
export function useSocketQueryInvalidation(events, queryKeys) {
  const queryClient = useQueryClient();
  // Callers should supply module-level constant arrays for stable subscriptions.
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      for (const queryKey of queryKeys) {
        queryClient.invalidateQueries({ queryKey });
      }
    };
    for (const event of events) socket.on(event, refresh);
    return () => {
      for (const event of events) socket.off(event, refresh);
    };
  }, [queryClient, events, queryKeys]);
}
