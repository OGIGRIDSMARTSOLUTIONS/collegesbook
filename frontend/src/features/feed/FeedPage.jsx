import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postService } from '../../services/post.service';
import { useSocketQueryInvalidation } from '../../hooks/useSocketQueryInvalidation';
import { Button } from '../../components/Button';
import { CommentSection } from './CommentSection';
import { LikePreview } from './LikePreview';
import { useToggleSavedPost } from '../../hooks/useSavedPosts';
import { ImageDropzone } from '../../components/ImageDropzone';
import { useSubmitReport } from '../../hooks/useReports';
import { useYearbooks } from '../../hooks/useYearbook';

const FEED_SOCKET_EVENTS = ['feed:new-post', 'feed:changed', 'connect'];
const FEED_QUERY_KEYS = [['feed']];

const VISIBILITY_OPTIONS = [
  { value: 'INSTITUTION', label: 'My institution' },
  { value: 'SET', label: 'My set' },
  { value: 'CONNECTIONS', label: 'Connections' },
  { value: 'PUBLIC', label: 'Public' },
];

function HashtagText({ text }) {
  const pieces = String(text || '').split(/(#[\p{L}\p{N}_]{2,40})/gu);
  return <p className="mt-3 whitespace-pre-wrap break-words text-text">{pieces.map((piece, index) =>
    /^#[\p{L}\p{N}_]{2,40}$/u.test(piece)
      ? <Link key={index} to={`/home?hashtag=${encodeURIComponent(piece.slice(1))}`} className="font-medium text-brand hover:underline">{piece}</Link>
      : <span key={index}>{piece}</span>
  )}</p>;
}

function PhotoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 15l-5-5-9 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function YearbookSpotlight() {
  const { data: yearbooks, isLoading } = useYearbooks();
  const latest = yearbooks?.[0];

  if (isLoading || !latest) return null;

  return (
    <Link
      to="/yearbook"
      className="group block overflow-hidden rounded-2xl border border-[#d9c7a9] bg-[#f8f2e8] shadow-[0_8px_28px_rgba(75,55,25,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(75,55,25,0.1)]"
    >
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-yearbook shadow-sm">
          <BookIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-yearbook">Your institution’s archive</p>
          <p className="mt-0.5 truncate text-base font-bold text-yearbook-ink">
            Class of {latest.year} YearBook
          </p>
          <p className="mt-0.5 text-xs text-[#76664d]">Open the official digital record of your graduating class.</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-yearbook px-3 py-2 text-xs font-bold text-white sm:inline-flex">
          Explore
        </span>
      </div>
    </Link>
  );
}

function BookIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" strokeLinecap="round" />
    </svg>
  );
}

export default function FeedPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const hashtag = searchParams.get('hashtag') || '';
  const highlightedPostId = searchParams.get('post');
  const [targetUnavailable, setTargetUnavailable] = useState(false);
  const loadMoreRef = useRef(null);
  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', hashtag],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => postService.getFeed({ page: pageParam, pageSize: 10, ...(hashtag ? { hashtag } : {}) }),
    getNextPageParam: (lastPage) => lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });
  const posts = feedQuery.data?.pages?.flatMap((page) => page.items) || [];
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !feedQuery.hasNextPage) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !feedQuery.isFetchingNextPage) feedQuery.fetchNextPage();
    }, { rootMargin: '350px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [feedQuery.hasNextPage, feedQuery.isFetchingNextPage, feedQuery.fetchNextPage]);

  useEffect(() => {
    setTargetUnavailable(false);
  }, [highlightedPostId]);

  useEffect(() => {
    if (!highlightedPostId || feedQuery.isLoading || feedQuery.isFetchingNextPage || feedQuery.isError) return;
    const target = document.getElementById(`feed-post-${highlightedPostId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (feedQuery.hasNextPage && (feedQuery.data?.pages?.length || 0) < 10) {
      feedQuery.fetchNextPage();
    } else {
      setTargetUnavailable(true);
    }
  }, [highlightedPostId, posts.length, feedQuery.isLoading, feedQuery.isFetchingNextPage, feedQuery.hasNextPage, feedQuery.data?.pages?.length, feedQuery.fetchNextPage]);

  // Refresh permission-checked feed data on real-time changes and reconnects.
  useSocketQueryInvalidation(FEED_SOCKET_EVENTS, FEED_QUERY_KEYS);

  const [body, setBody] = useState('');
  const [images, setImages] = useState([]);
  const [showImageAdd, setShowImageAdd] = useState(false);
  const [visibility, setVisibility] = useState('INSTITUTION');

  const createPost = useMutation({
    mutationFn: postService.create,
    onSuccess: () => {
      setBody('');
      setImages([]);
      setShowImageAdd(false);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim() && images.length === 0) return;
    createPost.mutate({
      body: body.trim() || undefined,
      images: images.length ? images : undefined,
      visibility,
    });
  }

  return (
    <div className="w-full min-w-0 max-w-none space-y-4">
      <YearbookSpotlight />
      {hashtag && (
        <div className="flex items-center justify-between rounded-lg bg-brand-soft p-3 text-sm">
          <strong>Posts tagged #{hashtag}</strong>
          <Link to="/home" className="underline">Clear filter</Link>
        </div>
      )}
      <div className="flex justify-end">
        <Link to="/saved" className="text-sm text-text-secondary hover:text-text">
          Saved posts
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          className="w-full resize-none border-0 bg-transparent text-text placeholder:text-text-secondary focus:outline-none"
        />

        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface/90 text-xs text-text-secondary hover:text-danger"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {showImageAdd && images.length < 10 && (
          <div className="mt-2">
            <ImageDropzone
              purpose="post"
              onUploaded={(url) => {
                setImages((imgs) => [...imgs, url]);
                setShowImageAdd(false);
              }}
              className="h-20 w-20"
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImageAdd((v) => !v)}
              className="rounded-md p-1.5 text-text-secondary hover:bg-bg hover:text-brand"
              title="Add a photo"
            >
              <PhotoIcon className="h-5 w-5" />
            </button>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-secondary"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={(!body.trim() && images.length === 0) || createPost.isPending}>
            {createPost.isPending ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </form>

      {feedQuery.isLoading && (
        <div aria-label="Loading your feed" role="status" className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="cb-skeleton h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="cb-skeleton h-3 w-1/3 rounded" />
                  <div className="cb-skeleton h-2 w-1/2 rounded" />
                </div>
              </div>
              <div className="cb-skeleton mt-5 h-3 w-5/6 rounded" />
              <div className="cb-skeleton mt-3 h-3 w-2/3 rounded" />
              <div className="cb-skeleton mt-4 h-36 rounded-lg" />
            </div>
          ))}
          <span className="sr-only">Loading posts…</span>
        </div>
      )}
      {feedQuery.isError && <p className="text-danger">Couldn't load the feed.</p>}

      {posts.length === 0 && !feedQuery.isLoading && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-text-secondary">
          No posts yet — be the first to share something with your institution.
        </div>
      )}

      {targetUnavailable && highlightedPostId && (
        <p role="status" className="mb-3 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
          This post is unavailable, outside the current feed, or you no longer have permission to view it.
          <Link to="/home" className="ml-2 font-semibold text-brand underline">Back to feed</Link>
        </p>
      )}
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} id={`feed-post-${post.id}`} className={highlightedPostId === post.id ? 'rounded-xl ring-2 ring-brand/40' : ''}>
            <PostCard post={post} />
          </div>
        ))}
      </div>
      <div ref={loadMoreRef} className="flex min-h-10 items-center justify-center text-xs text-text-secondary" aria-live="polite">
        {feedQuery.isFetchingNextPage ? 'Loading more posts…' : feedQuery.hasNextPage ? 'Scroll for more posts' : posts.length ? 'You are all caught up' : ''}
      </div>
      {feedQuery.isFetchNextPageError && <button type="button" onClick={() => feedQuery.fetchNextPage()} className="text-sm text-brand underline">Retry loading posts</button>}
    </div>
  );
}

function ReportForm({ postId, onDone }) {
  const [reason, setReason] = useState('');
  const submitReport = useSubmitReport();

  function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    submitReport.mutate(
      { targetType: 'POST', postId, reason },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded-md border border-border bg-bg p-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why are you reporting this post?"
        className="w-full resize-none rounded-md border border-border bg-surface p-2 text-sm text-text placeholder:text-text-secondary/70"
        rows={2}
        autoFocus
      />
      {submitReport.isError && <p className="text-sm text-danger">{submitReport.error.message}</p>}
      {submitReport.isSuccess ? (
        <p className="text-sm text-success">Reported — thanks, an admin will review it.</p>
      ) : (
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" disabled={submitReport.isPending || !reason.trim()}>
            {submitReport.isPending ? 'Sending…' : 'Submit report'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
}

function PostMenu({ postId }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { save } = useToggleSavedPost();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded px-1.5 text-text-secondary hover:bg-bg hover:text-text"
        aria-label="Post options"
      >
        ···
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-md border border-border bg-surface shadow-sm">
          <button
            onClick={() => {
              save.mutate(postId);
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-bg"
          >
            {save.isSuccess ? 'Saved ✓' : 'Save post'}
          </button>
          <button
            onClick={() => {
              setReporting(true);
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-bg"
          >
            Report
          </button>
        </div>
      )}
      {reporting && <ReportForm postId={postId} onDone={() => setReporting(false)} />}
    </div>
  );
}

export function PostCard({ post }) {
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [quote, setQuote] = useState('');
  const repost = useMutation({
    mutationFn: (text) => postService.repost(post.id, text),
    onSuccess: () => {
      setShowQuote(false);
      setQuote('');
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
  const react = useMutation({
    mutationFn: () => postService.react(post.id, 'LIKE'),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previous = queryClient.getQueriesData({ queryKey: ['feed'] });
      queryClient.setQueriesData({ queryKey: ['feed'] }, (data) => {
        if (!data?.pages) return data;
        return { ...data, pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (item.id !== post.id) return item;
            const likedByMe = !item.likedByMe;
            return { ...item, likedByMe, likeCount: Math.max(0, (Number(item.likeCount) || 0) + (likedByMe ? 1 : -1)) };
          }),
        })) };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    },
  });

  return (
    <article className="cb-post-enter rounded-lg border border-border bg-surface p-4 transition-shadow duration-200 hover:shadow-sm">
      <div className="flex items-start justify-between">
        <Link to={`/profile/${post.author?.id}`} className="flex items-center gap-3 hover:opacity-80">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
            {post.author?.firstName?.[0]}
            {post.author?.lastName?.[0]}
          </span>
          <div>
            <p className="text-sm font-medium text-text">
              {post.author?.firstName} {post.author?.lastName}
            </p>
            <p className="text-xs text-text-secondary">
              {post.author?.academicSet?.name} · {post.author?.institution?.name}
            </p>
          </div>
        </Link>
        <PostMenu postId={post.id} />
      </div>
      {post.repostOf && <p className="mt-2 text-xs font-medium text-brand">↻ Reposted from {post.repostOf.author?.firstName} {post.repostOf.author?.lastName}</p>}
      {post.body && <HashtagText text={post.body} />}
      {post.repostOf && (
        <div className="mt-3 rounded-xl border border-border bg-bg p-3">
          <p className="text-sm font-semibold">{post.repostOf.author?.firstName} {post.repostOf.author?.lastName}</p>
          {post.repostOf.body && <HashtagText text={post.repostOf.body} />}
          {post.repostOf.images?.length > 0 && <img src={post.repostOf.images[0]} alt="Original post attachment" loading="lazy" className="mt-2 max-h-72 w-full rounded-lg object-cover" />}
        </div>
      )}
      {post.images?.length > 0 && (
        <div className={`mt-3 grid gap-1 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.images.map((url) => (
            <img key={url} src={url} alt="" className="max-h-96 w-full rounded-md object-cover" />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-sm text-text-secondary">
        <button
          type="button"
          onClick={() => react.mutate()}
          disabled={react.isPending}
          aria-pressed={Boolean(post.likedByMe)}
          aria-label={`${post.likedByMe ? 'Unlike' : 'Like'} post; ${post.likeCount ?? 0} likes`}
          className={`inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors hover:bg-brand-soft hover:text-brand disabled:cursor-wait disabled:opacity-60 ${post.likedByMe ? 'font-semibold text-brand' : ''}`}
        >
          <span key={post.likedByMe ? "liked" : "unliked"} className="cb-heart" aria-hidden="true">{post.likedByMe ? '♥' : '♡'}</span>
          <span>{post.likedByMe ? 'Liked' : 'Like'}</span>
          <span className="text-[10px] tabular-nums text-text-secondary">{post.likeCount ?? 0}</span>
        </button>
        {!post.groupId && post.visibility === 'PUBLIC' && (
          <button type="button" disabled={repost.isPending} onClick={() => post.repostedByMe ? repost.mutate() : setShowQuote((value) => !value)}
            className="cb-action rounded px-2 py-1 hover:bg-brand-soft hover:text-brand" aria-pressed={!!post.repostedByMe}>
            {post.repostedByMe ? '↻ Reposted' : '↻ Repost'} <span className="text-[10px]">{post.repostCount || 0}</span>
          </button>
        )}
        {react.isError && (
          <span role="alert" className="text-xs text-danger">
            {react.error?.message || 'Could not save Like. Please try again.'}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-label={`Comments on post; ${post.commentCount ?? 0} comments`}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-brand-soft hover:text-brand"
        >
          <span>Comment</span>
          <span className="text-[10px] tabular-nums text-text-secondary">{post.commentCount ?? 0}</span>
        </button>
      </div>
      {showQuote && (
        <form onSubmit={(event) => { event.preventDefault(); repost.mutate(quote); }} className="cb-expand mt-3 rounded-lg bg-bg p-3">
          <label className="block text-xs font-semibold">Quote this public post (optional)</label>
          <textarea maxLength={1000} value={quote} onChange={(event) => setQuote(event.target.value)} rows={2}
            className="mt-2 w-full rounded-md border border-border bg-surface p-2 text-sm" placeholder="Add your thoughts…" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={repost.isPending} className="rounded-md bg-brand px-3 py-2 text-sm text-white">{repost.isPending ? 'Reposting…' : 'Repost'}</button>
            <button type="button" onClick={() => setShowQuote(false)} className="text-sm">Cancel</button>
          </div>
          {repost.isError && <p role="alert" className="text-xs text-danger">{repost.error.message}</p>}
        </form>
      )}
      <div className="px-2 pb-1"><LikePreview targetId={post.id} targetType="post" count={post.likeCount || 0} /></div>
      {showComments && <div className="cb-expand"><CommentSection postId={post.id} /></div>}
    </article>
  );
}