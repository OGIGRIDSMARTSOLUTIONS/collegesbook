import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useNotificationActions } from '../../hooks/useNotifications';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/loading/Spinner';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Route only to destinations that exist in App.jsx. Notification payloads are
// supplied by the backend; never construct a URL from an unvalidated ID.
function safeId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
}

function describe(notification) {
  const { type, payload = {} } = notification;
  if (type === 'LIKE') return 'Someone liked your post or comment';
  if (type === 'COMMENT') return 'Someone commented on your post';
  if (type === 'CONNECTION') return payload?.action === 'accepted' ? 'Your connection request was accepted' : 'You have a new connection request';
  if (type === 'MESSAGE') return 'You have a new message — open conversation';
  if (type === 'MENTION') return 'You were mentioned';
  if (type === 'INSTITUTION_BROADCAST') return payload?.title ? `Announcement: ${payload.title}` : 'New institution announcement';
  if (payload?.kind === 'GROUP_INVITATION') return `Group invitation${payload.groupName ? `: ${payload.groupName}` : ''}`;
  if (payload?.kind === 'GROUP_INVITATION_RESPONSE') return 'Your group invitation has been answered';
  return 'New notification';
}

function targetPath(notification) {
  const payload = notification.payload || {};
  const postId = safeId(payload.postId);
  const conversationId = safeId(payload.conversationId);
  const senderId = safeId(payload.senderId);
  const actorId = safeId(payload.actorId);
  const broadcastId = safeId(payload.broadcastId);
  const groupId = safeId(payload.groupId);

  if (notification.type === 'MESSAGE' || (notification.type === 'MENTION' && conversationId)) {
    if (conversationId) return `/messages?conversation=${encodeURIComponent(conversationId)}`;
    if (senderId) return `/messages?with=${encodeURIComponent(senderId)}`;
    return '/messages';
  }
  if (['LIKE', 'COMMENT', 'MENTION'].includes(notification.type)) {
    return postId ? `/home?post=${encodeURIComponent(postId)}` : '/home';
  }
  if (notification.type === 'CONNECTION') return actorId ? `/profile/${encodeURIComponent(actorId)}` : '/network';
  if (notification.type === 'INSTITUTION_BROADCAST') {
    return broadcastId ? `/institution-news?broadcast=${encodeURIComponent(broadcastId)}` : '/institution-news';
  }
  if (payload.kind === 'GROUP_INVITATION' || payload.kind === 'GROUP_INVITATION_RESPONSE') {
    return groupId ? `/groups?group=${encodeURIComponent(groupId)}` : '/groups';
  }
  return null;
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const notificationsQuery = useNotifications(page);
  const { markRead, markAllRead } = useNotificationActions();
  const navigate = useNavigate();

  function handleClick(notification) {
    if (!notification.readAt) markRead.mutate(notification.id);
    const path = targetPath(notification);
    if (path) {
      setNotice('');
      navigate(path);
    } else {
      setNotice('This notification has no available destination. It has been marked as read.');
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Notifications</h1>
        <Button variant="ghost" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          Mark all as read
        </Button>
      </div>

      {notice && <p role="status" className="mb-3 rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary">{notice}</p>}
      {notificationsQuery.isError && <p role="alert" className="mb-3 rounded-lg border border-border bg-surface p-3 text-sm text-danger">Notifications could not be loaded. Please try again.</p>}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {notificationsQuery.isLoading && <LoadingState message="Loading notifications…" compact />}

        {notificationsQuery.data?.items?.length === 0 && (
          <p className="p-4 text-sm text-text-secondary">You're all caught up.</p>
        )}

        <div className="divide-y divide-border">
          {notificationsQuery.data?.items?.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              type="button"
              className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-bg ${
                !notification.readAt ? 'bg-brand-soft/40' : ''
              }`}
            >
              <div>
                <p className="text-sm text-text">{describe(notification)}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{formatTime(notification.createdAt)}</p>
              </div>
              {!notification.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={page * 20 >= (notificationsQuery.data?.total || 0)} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}