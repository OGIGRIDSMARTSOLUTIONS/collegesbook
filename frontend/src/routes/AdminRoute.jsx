import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { PageLoader } from '../components/loading/Spinner';

const STAFF_ROLES = new Set([
  'INSTITUTION_ADMIN',
  'INSTITUTION_MODERATOR',
  'YEARBOOK_ADMIN',
  'SUPER_ADMIN',
]);

/**
 * The admin area requires a fresh access-token check against the backend.
 * Unlike ordinary pages, an expired access token must not be silently renewed
 * using a long-lived refresh cookie merely because someone typed an admin URL.
 * This is a UI gate; backend role and institution checks remain mandatory.
 */
export function AdminRoute() {
  const location = useLocation();
  const session = useQuery({
    queryKey: ['auth', 'admin-session'],
    queryFn: authService.meStrict,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });

  // Never show admin content while verifying or re-verifying credentials.
  if (session.isPending || session.isFetching) {
    return <PageLoader message="Verifying administrator access…" />;
  }

  if (session.isError) {
    if ([401, 403].includes(session.error?.status)) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
      <main role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Administrator access could not be verified. This area remains locked.</p>
        <button type="button" onClick={() => session.refetch()}>
          Try again
        </button>
      </main>
    );
  }

  if (!session.data?.userId || !STAFF_ROLES.has(session.data.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
