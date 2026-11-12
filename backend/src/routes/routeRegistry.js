/** Ordered API module registry. Add new feature routes here, not in app.js.
 * Preserve existing prefixes to avoid breaking frontend and mobile clients.
 */
module.exports = [
  { path: '/warmup', router: require('./warmup.routes') },
  { path: '/auth', router: require('./auth.routes') },
  { path: '/institutions', router: require('./institution.routes') },
  { path: '/students', router: require('./student.routes') },
  { path: '/privacy', router: require('./privacy.routes') },
  { path: '/connections', router: require('./connection.routes') },
  { path: '/posts', router: require('./post.routes') },
  { path: '/messages', router: require('./message.routes') },
  { path: '/notifications', router: require('./notification.routes') },
  { path: '/broadcasts', router: require('./broadcast.routes') },
  { path: '/yearbooks', router: require('./yearbook.routes') },
  { path: '/groups', router: require('./group.routes') },
  { path: '/reports', router: require('./report.routes') },
  { path: '/saved-posts', router: require('./savedpost.routes') },
  { path: '/uploads', router: require('./upload.routes') },
  { path: '/birthdays', router: require('./birthday.routes') },
  { path: '/events', router: require('./event.routes') },
  { path: '/news-feeds', router: require('./newsFeed.routes') },
];
