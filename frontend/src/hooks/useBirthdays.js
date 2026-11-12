import { useQuery } from '@tanstack/react-query';
import { birthdayService } from '../services/birthday.service';
export function useUpcomingBirthdays(days = 14, enabled = true) {
  return useQuery({ queryKey: ['birthdays', days], queryFn: () => birthdayService.list(days), enabled, staleTime: 5 * 60 * 1000 });
}
