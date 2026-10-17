import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { postService } from '../../services/post.service';

/** Hover on desktop, tap/click on touch devices. Student identities come from the server. */
export function LikePreview({ targetId, targetType = 'comment', count = 0 }) {
  const [open, setOpen] = useState(false);
  const key = targetType === 'post' ? 'post-likes' : 'comment-likes';
  const query = useQuery({
    queryKey: [key, targetId],
    queryFn: () => targetType === 'post'
      ? postService.getPostLikes(targetId)
      : postService.getCommentLikes(targetId),
    enabled: open && count > 0,
    staleTime: 5000,
  });
  if (!count) return null;
  const students = query.data || [];
  return (
    <div className="relative inline-flex items-center gap-1.5" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="flex -space-x-1" aria-hidden="true">
        {students.slice(0, 3).map((student) => (
          student.profilePhotoUrl
            ? <img key={student.id} src={student.profilePhotoUrl} alt="" className="h-5 w-5 rounded-full border border-border object-cover" />
            : <span key={student.id} className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-brand-soft text-[8px] font-semibold text-brand">{student.firstName?.[0]}{student.lastName?.[0]}</span>
        ))}
      </div>
      <button type="button" onClick={() => setOpen((previous) => !previous)} onFocus={() => setOpen(true)} aria-expanded={open} aria-label={`View ${count} people who liked this ${targetType}`} className="text-xs text-text-secondary underline decoration-dotted hover:text-brand">
        {students.length ? `${students[0].firstName} ${students[0].lastName}${count > 1 ? ` and ${count - 1} others` : ''}` : `${count} ${count === 1 ? 'like' : 'likes'}`}
      </button>
      {open && (
        <div role="dialog" aria-label="People who liked this" className="absolute bottom-full left-0 z-50 mb-2 w-64 max-w-[85vw] rounded-xl border border-border bg-bg p-3 shadow-xl" onMouseEnter={() => setOpen(true)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-xs text-text">Recent likes</strong>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-secondary" aria-label="Close likes">✕</button>
          </div>
          {query.isLoading && <p className="text-xs text-text-secondary">Loading students…</p>}
          {query.isError && <p className="text-xs text-danger">Could not load likes.</p>}
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {students.map((student) => (
              <Link key={student.id} to={`/profile/${student.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md p-1 hover:bg-brand-soft">
                {student.profilePhotoUrl ? <img src={student.profilePhotoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand">{student.firstName?.[0]}{student.lastName?.[0]}</span>}
                <span className="min-w-0 truncate text-xs text-text">{student.firstName} {student.lastName}</span>
              </Link>
            ))}
          </div>
          {count > 100 && <p className="mt-2 text-xs text-text-secondary">Showing the 100 most recent likes</p>}
        </div>
      )}
    </div>
  );
}
