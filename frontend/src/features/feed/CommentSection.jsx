import { useState } from 'react';
import { useComments, useAddComment, useLikeComment } from '../../hooks/useComments';
import { LikePreview } from './LikePreview';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/loading/Spinner';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CommentSection({ postId }) {
  const commentsQuery = useComments(postId, true);
  const addComment = useAddComment(postId);
  const likeComment = useLikeComment(postId);
  const [body, setBody] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    addComment.mutate({ body: trimmed }, { onSuccess: () => setBody('') });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {commentsQuery.isLoading && <LoadingState message="Loading comments…" compact />}
      {commentsQuery.isError && <p className="text-xs text-danger">Couldn't load comments.</p>}

      {commentsQuery.data?.length === 0 && (
        <p className="text-xs text-text-secondary">No comments yet — be the first to reply.</p>
      )}

      <div className="space-y-2">
        {commentsQuery.data?.map((comment) => (
          <div key={comment.id} className="flex gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
              {comment.author?.firstName?.[0]}
              {comment.author?.lastName?.[0]}
            </span>
            <div className="min-w-0 flex-1 rounded-lg bg-bg px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-text">
                  {comment.author?.firstName} {comment.author?.lastName}
                </p>
                <span className="shrink-0 text-[11px] text-text-secondary">{formatTime(comment.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-text">{comment.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="button" disabled={likeComment.isPending} onClick={() => likeComment.mutate(comment.id)} className={`text-xs hover:text-brand ${comment.likedByMe ? 'font-semibold text-brand' : 'text-text-secondary'}`} aria-pressed={!!comment.likedByMe}>
                  {comment.likedByMe ? '♥ Liked' : '♡ Like'}
                </button>
                <LikePreview targetId={comment.id} count={comment.likeCount || 0} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {addComment.isError && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {addComment.error?.message || 'Comment could not be saved. Please try again.'}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-text placeholder:text-text-secondary focus:border-brand focus:outline-none"
        />
        <Button type="submit" variant="secondary" disabled={!body.trim() || addComment.isPending}>
          Reply
        </Button>
      </form>
    </div>
  );
}