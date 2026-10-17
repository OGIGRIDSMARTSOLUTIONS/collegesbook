const prisma = require('../config/db');
const { createNotification, notifyChanged } = require('./notificationPublisher.service');
const { ApiError } = require('../utils/apiResponse');
const { canViewPost, isInstitutionStaff, isGroupModerator } = require('./permission.service');

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhotoUrl: true,
  institutionId: true,
  setId: true,
  institution: { select: { name: true, shortName: true, logoUrl: true } },
  academicSet: { select: { name: true } },
};

function viewerFromContext(ctx) {
  if (!ctx?.studentId) return null;
  return { id: ctx.studentId, institutionId: ctx.institutionId, setId: ctx.setId };
}

/**
 * notifyMentions — explicit tagging (client sends studentIds directly),
 * not text-parsing of "@handle" — there's no unique handle/username field
 * on Student to parse against yet, so this is the honest, simple version
 * rather than a fragile regex against display names.
 */
async function notifyMentions(authorContext, studentIds, payload) {
  if (!studentIds || studentIds.length === 0) return;
  const targets = studentIds.filter((id) => id !== authorContext.studentId);
  if (targets.length === 0) return;

  const validStudents = await prisma.student.findMany({
    where: { id: { in: targets } },
    select: { id: true },
  });

  await prisma.notification.createMany({
    data: validStudents.map((s) => ({
      recipientId: s.id,
      type: 'MENTION',
      payload: { ...payload, mentionedBy: authorContext.studentId },
    })),
  });
  await notifyChanged(validStudents.map((student) => student.id));
}

async function createPost(authorContext, { body, images, linkUrl, visibility, groupId, mentions }) {
  if (groupId) {
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_studentId: { groupId, studentId: authorContext.studentId } },
    });
    if (!membership) throw new ApiError('You must join this group before posting in it', 403);
  }

  const post = await prisma.post.create({
    data: {
      authorId: authorContext.studentId,
      institutionId: authorContext.institutionId,
      groupId,
      body,
      images,
      linkUrl,
      visibility,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });

  await notifyMentions(authorContext, mentions, { postId: post.id });

  return post;
}

async function getPostOrThrow(postId, viewerContext) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { author: { select: AUTHOR_SELECT } },
  });
  if (!post) throw new ApiError('Post not found', 404);

  const allowed = await canViewPost(viewerFromContext(viewerContext), post, post.author);
  if (!allowed) throw new ApiError('You cannot view this post', 403);

  return post;
}

async function deletePost(actorContext, postId) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) throw new ApiError('Post not found', 404);

  const isAuthor = post.authorId === actorContext.studentId;
  const isInstitutionMod =
    isInstitutionStaff(actorContext.role) && actorContext.institutionId === post.institutionId;
  const isGroupMod = post.groupId && (await isGroupModerator(actorContext.studentId, post.groupId));

  if (!isAuthor && !isInstitutionMod && !isGroupMod) throw new ApiError('You cannot delete this post', 403);

  await prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  return { deleted: true };
}

/**
 * getFeed — §10 Social Feed / §33 permission matrix, applied per-post.
 * V1 approach (see /docs §10 note): pull a broad candidate set with a
 * single query (own posts + same-institution posts + public posts +
 * connections' posts), then apply canViewPost precisely in-memory before
 * paginating. Correct at V1 scale; revisit with a materialized feed/queue
 * once volume grows (Phase 8 in the architecture doc).
 */
async function getFeed(viewerContext, { page, pageSize, hashtag }) {
  // Performance V3: build the permission rules into PostgreSQL instead of
  // fetching hundreds of candidates and running asynchronous permission
  // checks one post at a time. This removes the feed's largest N+1 path.
  const [connections, visibleGroups] = await Promise.all([
    prisma.connection.findMany({
      where: {
        status: { in: ['ACCEPTED', 'BLOCKED'] },
        OR: [
          { requesterId: viewerContext.studentId },
          { addresseeId: viewerContext.studentId },
        ],
      },
      select: { requesterId: true, addresseeId: true, status: true },
    }),
    prisma.group.findMany({
      where: {
        institutionId: viewerContext.institutionId,
        OR: [
          { kind: 'PUBLIC' },
          { memberships: { some: { studentId: viewerContext.studentId } } },
        ],
      },
      select: { id: true },
    }),
  ]);

  const acceptedIds = [];
  const blockedIds = [];
  for (const connection of connections) {
    const otherId =
      connection.requesterId === viewerContext.studentId
        ? connection.addresseeId
        : connection.requesterId;
    if (connection.status === 'ACCEPTED') acceptedIds.push(otherId);
    if (connection.status === 'BLOCKED') blockedIds.push(otherId);
  }

  const visibleGroupIds = visibleGroups.map((group) => group.id);
  const sameInstitution = { institutionId: viewerContext.institutionId };
  const nonGroupRules = [
    { authorId: viewerContext.studentId },
    { visibility: 'PUBLIC' },
    { visibility: 'INSTITUTION' },
    ...(viewerContext.setId ? [{ visibility: 'SET', author: { setId: viewerContext.setId } }] : []),
    ...(acceptedIds.length ? [{ visibility: 'CONNECTIONS', authorId: { in: acceptedIds } }] : []),
  ];

  const where = {
    deletedAt: null,
    AND: [{ OR: [{ repostOfId: null }, { repostOf: { deletedAt: null, visibility: 'PUBLIC', institutionId: viewerContext.institutionId } }] }],
    ...(hashtag ? { body: { contains: `#${hashtag}`, mode: 'insensitive' } } : {}),
    ...sameInstitution,
    ...(blockedIds.length ? { authorId: { notIn: blockedIds } } : {}),
    OR: [
      { groupId: null, OR: nonGroupRules },
      ...(visibleGroupIds.length ? [{ groupId: { in: visibleGroupIds } }] : []),
    ],
  };

  const skip = (page - 1) * pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      include: {
        author: { select: AUTHOR_SELECT },
        repostOf: { select: { id: true, body: true, images: true, visibility: true, deletedAt: true, institutionId: true, author: { select: AUTHOR_SELECT } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.post.count({ where }),
  ]);

  const enriched = await withLikeState(items.map(stripAuthorInternals), viewerContext.studentId);
  const postIds = items.map((item) => item.id);
  const [repostCounts, myReposts] = postIds.length ? await Promise.all([
    prisma.postRepost.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { _all: true } }),
    prisma.postRepost.findMany({ where: { postId: { in: postIds }, studentId: viewerContext.studentId }, select: { postId: true } }),
  ]) : [[], []];
  const counts = new Map(repostCounts.map((entry) => [entry.postId, entry._count._all]));
  const mine = new Set(myReposts.map((entry) => entry.postId));
  return {
    items: enriched.map((post) => ({
      ...post,
      repostOf: post.repostOf?.deletedAt || post.repostOf?.visibility !== 'PUBLIC' || post.repostOf?.institutionId !== viewerContext.institutionId ? null : post.repostOf,
      repostCount: counts.get(post.id) || 0,
      repostedByMe: mine.has(post.id),
    })),
    total,
    page,
    pageSize,
  };
}

async function listStudentPosts(studentId, viewerContext, { page, pageSize }) {
  const posts = await prisma.post.findMany({
    where: { authorId: studentId, deletedAt: null },
    include: { author: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const viewer = viewerFromContext(viewerContext);
  const visible = [];
  for (const post of posts) {
    // eslint-disable-next-line no-await-in-loop
    if (await canViewPost(viewer, post, post.author)) visible.push(post);
  }

  const start = (page - 1) * pageSize;
  return {
    items: await withLikeState(visible.slice(start, start + pageSize).map(stripAuthorInternals), viewerContext.studentId),
    total: visible.length,
    page,
    pageSize,
  };
}

/** Add viewer-specific Like state and total Like count without exposing student IDs. */
async function withLikeState(posts, viewerStudentId) {
  if (!posts.length) return posts;
  const postIds = posts.map((post) => post.id);
  const [counts, ownLikes, commentCounts] = await Promise.all([
    prisma.reaction.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds }, type: 'LIKE' },
      _count: { _all: true },
    }),
    prisma.reaction.findMany({
      where: { postId: { in: postIds }, studentId: viewerStudentId, type: 'LIKE' },
      select: { postId: true },
    }),
    prisma.comment.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds }, deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  const commentCountByPost = new Map(commentCounts.map((row) => [row.postId, row._count._all]));
  const countByPost = new Map(counts.map((row) => [row.postId, row._count._all]));
  const likedPostIds = new Set(ownLikes.map((row) => row.postId));
  return posts.map((post) => ({
    ...post,
    likeCount: countByPost.get(post.id) || 0,
    commentCount: commentCountByPost.get(post.id) || 0,
    likedByMe: likedPostIds.has(post.id),
  }));
}

function stripAuthorInternals(post) {
  // eslint-disable-next-line no-unused-vars
  const { institutionId, setId, ...author } = post.author;
  return { ...post, author };
}

// ── Comments ──

async function createComment(actorContext, postId, { body, parentCommentId, mentions }) {
  const post = await getPostOrThrow(postId, actorContext); // enforces visibility before allowing a comment

  if (parentCommentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentCommentId } });
    if (!parent || parent.postId !== postId) throw new ApiError('Parent comment not found on this post', 404);
  }

  const comment = await prisma.comment.create({
    data: { postId: post.id, authorId: actorContext.studentId, parentCommentId, body },
    include: { author: { select: AUTHOR_SELECT } },
  });

  await notifyMentions(actorContext, mentions, { postId: post.id, commentId: comment.id });
  if (post.authorId !== actorContext.studentId) {
    await createNotification(post.authorId, 'COMMENT', { postId: post.id, commentId: comment.id, actorId: actorContext.studentId });
  }

  // Return an authoritative count so the feed can update without reopening comments.
  const commentCount = await prisma.comment.count({
    where: { postId: post.id, deletedAt: null },
  });

  return { ...comment, commentCount };
}

async function listComments(postId, viewerContext) {
  await getPostOrThrow(postId, viewerContext); // 403/404 propagate if the post itself isn't visible

  const comments = await prisma.comment.findMany({
    where: { postId, deletedAt: null },
    include: { author: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: 'asc' },
  });

  const ids = comments.map((comment) => comment.id);
  const [counts, ownLikes] = ids.length ? await Promise.all([
    prisma.reaction.groupBy({
      by: ['commentId'],
      where: { commentId: { in: ids }, type: 'LIKE' },
      _count: { _all: true },
    }),
    prisma.reaction.findMany({
      where: { commentId: { in: ids }, studentId: viewerContext.studentId, type: 'LIKE' },
      select: { commentId: true },
    }),
  ]) : [[], []];
  const countById = new Map(counts.map((row) => [row.commentId, row._count._all]));
  const likedIds = new Set(ownLikes.map((row) => row.commentId));
  return comments.map((comment) => ({
    ...stripAuthorInternals(comment),
    likeCount: countById.get(comment.id) || 0,
    likedByMe: likedIds.has(comment.id),
  }));
}

// ── Reactions ──

async function toggleReaction(actorContext, { postId, commentId }, type) {
  const studentId = actorContext.studentId;
  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new ApiError('Post not found', 404);
    await getPostOrThrow(postId, actorContext);
  }
  if (commentId) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new ApiError('Comment not found', 404);
    await getPostOrThrow(comment.postId, actorContext);
  }

  const where = postId
    ? { postId_studentId: { postId, studentId } }
    : { commentId_studentId: { commentId, studentId } };

  const existing = await prisma.reaction.findUnique({ where }).catch(() => null);

  if (existing) {
    if (existing.type === type) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return { reacted: false };
    }
    const updated = await prisma.reaction.update({ where: { id: existing.id }, data: { type } });
    return { reacted: true, reaction: updated };
  }

  const created = await prisma.reaction.create({
    data: { studentId, postId, commentId, type },
  });
  const target = postId
    ? await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } })
    : await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true, postId: true } });
  if (type === 'LIKE' && target && target.authorId !== studentId) {
    await createNotification(target.authorId, 'LIKE', { postId: postId || target.postId, commentId: commentId || null, actorId: studentId });
  }
  return { reacted: true, reaction: created };
}


async function listReactionStudents(actorContext, { postId, commentId }) {
  if (commentId) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new ApiError('Comment not found', 404);
    await getPostOrThrow(comment.postId, actorContext);
  } else {
    await getPostOrThrow(postId, actorContext);
  }
  const reactions = await prisma.reaction.findMany({
    where: { ...(commentId ? { commentId } : { postId }), type: 'LIKE' },
    select: {
      student: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return reactions.map((reaction) => reaction.student);
}

async function listGroupPosts(groupId, viewerContext) {
  const posts = await prisma.post.findMany({
    where: { groupId, deletedAt: null },
    include: { author: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const viewer = viewerFromContext(viewerContext);
  const visible = [];
  for (const post of posts) {
    // eslint-disable-next-line no-await-in-loop
    if (await canViewPost(viewer, post, post.author)) visible.push(post);
  }
  return visible.map(stripAuthorInternals);
}

async function toggleRepost(actorContext, postId, quote) {
  const post = await getPostOrThrow(postId, actorContext);
  if (post.deletedAt || post.groupId || post.repostOfId || post.visibility !== 'PUBLIC') {
    throw new ApiError('Only public, non-group posts may be reposted', 403);
  }
  const where = { postId_studentId: { postId, studentId: actorContext.studentId } };
  const existing = await prisma.postRepost.findUnique({ where });
  if (existing) {
    await prisma.$transaction(async (tx) => {
      if (existing.repostPostId) await tx.post.update({ where: { id: existing.repostPostId }, data: { deletedAt: new Date() } });
      await tx.postRepost.delete({ where: { id: existing.id } });
    });
    return { reposted: false };
  }
  const created = await prisma.$transaction(async (tx) => {
    const copy = await tx.post.create({
      data: {
        authorId: actorContext.studentId,
        institutionId: actorContext.institutionId,
        visibility: 'PUBLIC',
        repostOfId: postId,
        body: quote?.trim() || null,
      },
    });
    return tx.postRepost.create({ data: { postId, studentId: actorContext.studentId, quote: quote?.trim() || null, repostPostId: copy.id } });
  });
  return { reposted: true, repost: created };
}

module.exports = {
  toggleRepost,
  createPost,
  getPostOrThrow,
  deletePost,
  getFeed,
  listStudentPosts,
  listGroupPosts,
  withLikeState,
  createComment,
  listComments,
  toggleReaction,
  listReactionStudents,
};
