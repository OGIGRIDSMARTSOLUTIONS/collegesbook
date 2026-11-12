import { useQuery } from '@tanstack/react-query';
import { newsFeedService } from '../services/newsFeed.service';

export function useNewsFeeds(params = {}, enabled = true) {
  return useQuery({
    queryKey: ['news-feeds', params],
    queryFn: () => newsFeedService.list(params),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
