import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { savedPostService } from '../services/savedpost.service';

export function useSavedPosts() {
  return useQuery({ queryKey: ['saved-posts'], queryFn: savedPostService.list });
}

export function useToggleSavedPost() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
  const save = useMutation({
    mutationFn: ({ id }) => savedPostService.save(id),
    onMutate: async (post) => {
      await queryClient.cancelQueries({ queryKey: ['saved-posts'] });
      const previous = queryClient.getQueryData(['saved-posts']);
      if (Array.isArray(previous) && !previous.some((item) => item.id === post.id)) {
        queryClient.setQueryData(['saved-posts'], [post, ...previous]);
      }
      return { previous };
    },
    onError: (_error, _post, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(['saved-posts'], context.previous);
    },
    onSettled: invalidate,
  });
  const unsave = useMutation({ mutationFn: savedPostService.unsave, onSuccess: invalidate });
  return { save, unsave };
}
