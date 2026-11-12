import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { restoreOfflineQueries } from '../lib/offlineCache';
import { useAuth } from '../hooks/useAuth';
import { PageLoader } from '../components/loading/Spinner';

/**
 * Never render protected content until the backend has verified the session.
 * Cached client state and offline snapshots are not authentication evidence.
 */
export function ProtectedRoute() {
  const { sessionQuery } = useAuth({ checkSession: true });
  const queryClient = useQueryClient();
  const location = useLocation();
  const [restoredUser, setRestoredUser] = useState(null);

  const verifiedContext = sessionQuery.isSuccess ? sessionQuery.data : null;
  const verifiedUserId = verifiedContext?.userId;

  useEffect(() => {
    if (!verifiedUserId) return undefined;

    let cancelled = false;

    restoreOfflineQueries(queryClient, verifiedUserId).finally(() => {
      if (!cancelled) {
        setRestoredUser(String(verifiedUserId));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [queryClient, verifiedUserId]);

  if (sessionQuery.isPending || sessionQuery.isFetching) {
    return <PageLoader message="Verifying your CollegeBook session…" />;
  }

  if (sessionQuery.isError) {
    if ([401, 403].includes(sessionQuery.error?.status)) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
      <main role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>We could not verify your session. Protected pages remain locked.</p>
        <button type="button" onClick={() => sessionQuery.refetch()}>
          Try again
        </button>
      </main>
    );
  }

  if (!verifiedUserId) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (restoredUser !== String(verifiedUserId)) {
    return <PageLoader message="Loading your CollegeBook…" />;
  }

  return <Outlet />;
}
