import { api } from './api';

export const postService = {
  repost: (postId, quote) => api.post(`/posts/${postId}/repost`, { quote }),
  getFeed: (params) => api.get('/posts/feed', { params }),
  create: (payload) => api.post('/posts', payload),
  react: (postId, type) => api.post(`/posts/${postId}/reactions`, { type }),
  comment: (postId, payload) => api.post(`/posts/${postId}/comments`, payload),
  getComments: (postId) => api.get(`/posts/${postId}/comments`),
  reactToComment: (commentId) => api.post(`/posts/comments/${commentId}/reactions`, { type: 'LIKE' }),
  getCommentLikes: (commentId) => api.get(`/posts/comments/${commentId}/likes`),
  getPostLikes: (postId) => api.get(`/posts/${postId}/likes`),
};
