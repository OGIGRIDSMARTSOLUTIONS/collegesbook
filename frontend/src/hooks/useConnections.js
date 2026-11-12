import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionService } from '../services/connection.service';

export function useConnections() {
  return useQuery({ queryKey: ['connections'], queryFn: connectionService.list });
}

export function usePendingConnections(enabled = true) {
  return useQuery({ queryKey: ['connections', 'pending'], queryFn: connectionService.listPending, enabled });
}

export function useBlockedConnections() {
  return useQuery({ queryKey: ['connections', 'blocked'], queryFn: connectionService.listBlocked });
}

export function useConnectionActions() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['connections'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const send = useMutation({ mutationFn: connectionService.send, onSuccess: invalidate });
  const accept = useMutation({ mutationFn: connectionService.accept, onSuccess: invalidate });
  const reject = useMutation({ mutationFn: connectionService.reject, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: connectionService.remove, onSuccess: invalidate });
  const block = useMutation({ mutationFn: connectionService.block, onSuccess: invalidate });
  const unblock = useMutation({ mutationFn: connectionService.unblock, onSuccess: invalidate });

  return { send, accept, reject, remove, block, unblock };
}
