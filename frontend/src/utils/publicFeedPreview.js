const PREFIX = 'collegebook-public-feed-preview-v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function key(studentId, institutionId) {
  return `${PREFIX}:${studentId}:${institutionId}`;
}

export function loadPublicFeedPreview(studentId, institutionId) {
  if (!studentId || !institutionId) return [];
  try {
    const entry = JSON.parse(sessionStorage.getItem(key(studentId, institutionId)) || 'null');
    if (!entry || Date.now() - entry.savedAt > MAX_AGE_MS) return [];
    return Array.isArray(entry.posts) ? entry.posts : [];
  } catch { return []; }
}

export function storePublicFeedPreview(studentId, institutionId, posts) {
  if (!studentId || !institutionId) return;
  // Only public, text-only previews; no private or image content is persisted.
  const safe = posts.filter((post) => post.visibility === 'PUBLIC' && !post.groupId && !post.repostOfId)
    .slice(0, 8).map((post) => ({
      id: post.id,
      body: String(post.body || '').slice(0, 400),
      authorName: `${post.author?.firstName || ''} ${post.author?.lastName || ''}`.trim(),
    }));
  try { sessionStorage.setItem(key(studentId, institutionId), JSON.stringify({ savedAt: Date.now(), posts: safe })); } catch {}
}

export function clearPublicFeedPreviews() {
  try {
    Object.keys(sessionStorage).filter((item) => item.startsWith(PREFIX)).forEach((item) => sessionStorage.removeItem(item));
  } catch {}
}
