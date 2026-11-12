import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';
import { clearOfflineQueries } from '../lib/offlineCache';
import { toast } from '../lib/toast';
import { clearPublicFeedPreviews } from '../utils/publicFeedPreview';

/**
 * Public forms can use auth mutations without fetching /auth/me.
 * ProtectedRoute opts in to session verification, including silent refresh.
 */
export function useAuth({ checkSession = false } = {}) {
  const { context, status, setContext, clearContext, setChecking } = useAuthStore();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    enabled: checkSession,
    retry: false,
    staleTime: checkSession ? 0 : 5 * 60 * 1000,
    refetchOnMount: checkSession ? 'always' : true,
  });

  useEffect(() => {
    if (!checkSession) return;
    if (meQuery.isSuccess && meQuery.data) {
      setContext(meQuery.data);
    } else if (meQuery.isError) {
      if ([401, 403].includes(meQuery.error?.status)) clearContext();
    }
  }, [checkSession, meQuery.isSuccess, meQuery.isError, meQuery.data,
    meQuery.error, setContext, clearContext]);

  async function afterLogin(result) {
    // A new cookie session must not inherit a previous user's cached context.
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
    // The backend returns the same verified context used by /auth/me.
    // Seed React Query to prevent a redundant blocking request.
    if (result?.context?.userId && String(result.context.userId) === String(result.id)) {
      queryClient.setQueryData(['auth', 'me'], result.context);
      setContext(result.context);
    } else {
      setChecking();
    }
    toast.success('Signed in successfully');
  }

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: afterLogin,
  });
  const googleLoginMutation = useMutation({
    mutationFn: authService.googleLogin,
    onSuccess: afterLogin,
  });
  const registerMutation = useMutation({ mutationFn: authService.register });
  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: async () => {
      await clearOfflineQueries(queryClient);
      toast.info('Signed out');
      clearContext();
      clearPublicFeedPreviews();
      queryClient.clear();
    },
  });

  return {
    context,
    sessionQuery: meQuery,
    status: checkSession && status !== 'authenticated' && meQuery.isPending ? 'loading' : status,
    isAuthenticated: status === 'authenticated',
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    loginWithGoogle: googleLoginMutation.mutateAsync,
    googleLoginError: googleLoginMutation.error,
    isLoggingInWithGoogle: googleLoginMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutateAsync,
  };
}
