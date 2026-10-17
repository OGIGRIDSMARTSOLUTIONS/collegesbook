import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useUnreadCount } from "../hooks/useNotifications";
import { useMyBroadcasts } from "../hooks/useBroadcasts";
import { usePendingConnections } from "../hooks/useConnections";
import { useUpcomingBirthdays } from "../hooks/useBirthdays";
import { useEvents } from "../hooks/useEvents";
import { useNewsFeeds } from "../hooks/useNewsFeeds";
import { connectSocket, disconnectSocket } from "../services/socket";
import { prefetchRoute } from "../services/prefetch.service";

const navigation = [
  {
    to: "/home",
    label: "Home",
    icon: HomeIcon,
  },
  {
    to: "/yearbook",
    label: "YearBook",
    icon: YearBookIcon,
    featured: true,
  },
  {
    to: "/profile",
    label: "My Profile",
    icon: UserIcon,
  },
  {
    to: "/saved",
    label: "Saved",
    icon: BookmarkIcon,
  },
  {
    to: "/network",
    label: "My Network",
    icon: NetworkIcon,
  },
  {
    to: "/messages",
    label: "Messages",
    icon: MessageIcon,
  },
  {
    to: "/groups",
    label: "Groups",
    icon: GroupsIcon,
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: BellIcon,
  },
  {
    to: "/news-feeds",
    label: "News & Feeds",
    icon: NewsFeedIcon,
  },
];

const desktopNavigation = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/yearbook", label: "YearBook", icon: YearBookIcon, featured: true },
  { to: "/profile", label: "My Profile", icon: UserIcon },
  { to: "/saved", label: "Saved", icon: BookmarkIcon },
  { to: "/network", label: "My Network", icon: NetworkIcon },
  { to: "/messages", label: "Messages", icon: MessageIcon },
  { to: "/groups", label: "Groups", icon: GroupsIcon },
  { to: "/institution-events", label: "Events", icon: CalendarIcon },
  { to: "/news-feeds", label: "News & Feeds", icon: NewsFeedIcon },
];

const ADMIN_ROLES = [
  "INSTITUTION_ADMIN",
  "INSTITUTION_MODERATOR",
  "YEARBOOK_ADMIN",
  "SUPER_ADMIN",
];

export function MainLayout() {
  const { logout, context } = useAuth();
  const { data: profile } = useProfile();
  const { data: unread } = useUnreadCount();
  const { data: broadcasts } = useMyBroadcasts({ page: 1, pageSize: 3 });
  const { data: pendingConnections } = usePendingConnections();
  const { data: birthdays } = useUpcomingBirthdays(7);
  const { data: events } = useEvents({ upcoming: true });

  const navigate = useNavigate();
  const location = useLocation();
  const isNewsFeedPage = location.pathname.startsWith("/news-feeds");
  const { data: sidebarNews } = useNewsFeeds({ limit: 8 });
  const latestNews = sidebarNews?.items?.[0] || null;
  const [newsPopupOpen, setNewsPopupOpen] = useState(false);
  const queryClient = useQueryClient();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);

  useEffect(() => {
    const socket = connectSocket();
    const refreshNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
    const refreshFeed = () => queryClient.invalidateQueries({ queryKey: ['feed'] });
    socket.on('notification:changed', refreshNotifications);
    socket.on('connect', refreshNotifications);
    socket.on('connect', refreshFeed);
    socket.on('feed:changed', refreshFeed);
    const refreshComments = () => queryClient.invalidateQueries({ queryKey: ['comments'] });
    socket.on('comments:changed', refreshComments);
    return () => {
      socket.off('notification:changed', refreshNotifications);
      socket.off('connect', refreshNotifications);
      socket.off('connect', refreshFeed);
      socket.off('feed:changed', refreshFeed);
      socket.off('comments:changed', refreshComments);
      disconnectSocket();
    };
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const initials = `${profile?.firstName?.[0] ?? ""}${
    profile?.lastName?.[0] ?? ""
  }`.toUpperCase();

  const fullName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    "Student";

  const institutionName = profile?.institution?.name || "Your institution";
  const institutionLogo = profile?.institution?.logoUrl || null;
  const institutionInitials = institutionName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const profilePhoto = profile?.profilePhotoUrl || null;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* =========================================================
          TOP GLOBAL BAR
          ========================================================= */}
      <header className="sticky top-0 z-50 h-17 border-b border-border/90 bg-surface/95 shadow-[0_1px_12px_rgba(20,40,45,0.045)] backdrop-blur">
        <div className="flex h-full w-full min-w-0 items-center gap-2 px-2 sm:gap-3 sm:px-4 lg:gap-4 lg:px-6">
          {/* Institution identity: school name BESIDE logo, CollegeBook BELOW logo. */}
          <NavLink
            to="/home"
            aria-label={`${institutionName} home`}
            className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none md:max-w-[min(55vw,650px)]"
          >
            <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 sm:w-16">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-none bg-transparent text-xs font-bold text-brand shadow-none ring-0 sm:h-14 sm:w-14">
                {institutionLogo ? (
                  <img
                    src={institutionLogo}
                    alt={`${institutionName} logo`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  institutionInitials || "CB"
                )}
              </div>
              <span className="text-center text-[9px] font-extrabold leading-none tracking-tight text-brand">
                CollegeBook
              </span>
            </div>
            <span
              className="min-w-0 max-w-full line-clamp-2 break-words text-[10px] font-bold uppercase leading-tight tracking-normal text-text sm:text-sm sm:font-extrabold sm:tracking-wide lg:text-base"
              title={institutionName}
            >
              {institutionName}
            </span>
          </NavLink>

          {/* Search sits at the RIGHT of the institution name, before notifications. */}
          <div className="relative ml-auto hidden w-36 shrink-0 md:block lg:w-44 xl:w-48">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              placeholder="Search CollegeBook"
              aria-label="Search CollegeBook"
              className="w-full rounded-full border border-border bg-bg py-2 pl-9 pr-3 text-xs text-text outline-none transition placeholder:text-text-secondary focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/10"
            />
          </div>

          {/* NOTIFICATIONS */}
          <NavLink
            to="/notifications"
            aria-label="Notifications"
            className={({ isActive }) =>
              `relative flex h-10 w-10 items-center justify-center rounded-full transition ${
                isActive
                  ? "bg-brand-soft text-brand"
                  : "text-text-secondary hover:bg-bg hover:text-text"
              }`
            }
          >
            <BellIcon className="h-5 w-5" />

            {unread?.unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4.25 min-w-4.25 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white shadow-sm">
                {unread.unreadCount > 9 ? "9+" : unread.unreadCount}
              </span>
            )}
          </NavLink>

          {/* PROFILE / ACCOUNT */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-lg border border-border bg-transparent py-1 pl-1 pr-2.5 transition hover:bg-transparent"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-transparent text-[11px] font-bold text-brand">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials || "ST"
                )}
              </span>

              <span className="hidden max-w-32.5 truncate text-sm font-semibold text-text sm:block">
                {profile?.firstName || "Student"}
              </span>

              <ChevronDownIcon
                className={`hidden h-4 w-4 text-text-secondary transition sm:block ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close account menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />

                <div
                  role="menu"
                  className="fixed right-3 top-[76px] z-[60] max-h-[calc(100dvh-92px)] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-surface p-2 shadow-[0_18px_45px_rgba(20,40,45,0.18)] sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:max-h-[calc(100vh-90px)] sm:w-72"
                >
                  {/* ACCOUNT HEADER */}
                  <div className="mb-1 border-b border-border px-3 pb-3 pt-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-sm font-bold text-brand">
                        {profilePhoto ? (
                          <img
                            src={profilePhoto}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials || "ST"
                        )}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text">
                          {fullName}
                        </p>

                      </div>
                    </div>
                  </div>

                  {/* PROFILE */}
                  <NavLink
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text transition hover:bg-bg"
                    role="menuitem"
                  >
                    <UserIcon className="h-4.5 w-4.5 text-text-secondary" />
                    <span>My Profile</span>
                  </NavLink>

                  {/* ADMIN */}
                  {ADMIN_ROLES.includes(context?.role) && (
                    <NavLink
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text transition hover:bg-bg"
                      role="menuitem"
                    >
                      <AdminIcon className="h-4.5 w-4.5 text-text-secondary" />
                      <span>Admin Panel</span>
                    </NavLink>
                  )}

                  <div className="my-1 border-t border-border" />

                  {/* LOGOUT */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-danger transition hover:bg-danger-soft"
                    role="menuitem"
                  >
                    <LogoutIcon className="h-4.5 w-4.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* RESPONSIVE COMMUNITY UPDATES — mirrors the desktop right sidebar below xl */}
          <button
            type="button"
            onClick={() => setUpdatesOpen(true)}
            aria-label="Open community updates"
            aria-expanded={updatesOpen}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary shadow-sm transition hover:bg-bg hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/30 xl:hidden"
          >
            <UpdatesIcon className="h-5 w-5" />
            {(broadcasts?.items?.length || pendingConnections?.length || birthdays?.length || events?.length) ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-surface" />
            ) : null}
          </button>

          {/* MOBILE MENU */}
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            aria-controls="collegebook-mobile-navigation"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text shadow-sm transition hover:bg-bg focus:outline-none focus:ring-2 focus:ring-brand/30 lg:hidden"
          >
            <span className="sr-only">{mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}</span>
            <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
              <span className={`h-0.5 w-full rounded-full bg-current transition-transform ${mobileNavOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`h-0.5 w-full rounded-full bg-current transition-opacity ${mobileNavOpen ? "opacity-0" : ""}`} />
              <span className={`h-0.5 w-full rounded-full bg-current transition-transform ${mobileNavOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>

        {/* MOBILE NAVIGATION DRAWER */}
        {mobileNavOpen && (
          <>
            <button
              type="button"
              aria-label="Close navigation menu"
              className="fixed inset-0 z-40 bg-black/20 lg:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              id="collegebook-mobile-navigation"
              className="absolute left-0 top-full z-50 max-h-[calc(100dvh-68px)] w-[min(62vw,220px)] overflow-y-auto rounded-br-2xl border-b border-r border-border bg-surface p-3 shadow-[0_18px_35px_rgba(20,40,45,0.14)] lg:hidden"
            >
              <div className="mb-3 rounded-xl bg-bg px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">CollegeBook</p>
                <p className="mt-1 text-xs text-text-secondary">Your institution. Your people. Your story.</p>
              </div>

              <nav className="space-y-1" aria-label="Mobile CollegeBook navigation">
                {navigation.map(({ to, label, icon: Icon, featured }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/home"}
                    onMouseEnter={() => prefetchRoute(queryClient, to)}
                    onFocus={() => prefetchRoute(queryClient, to)}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${
                        featured
                          ? isActive
                            ? "bg-yearbook-soft text-yearbook"
                            : "text-yearbook hover:bg-yearbook-soft"
                          : isActive
                            ? "bg-brand-soft text-brand"
                            : "text-text-secondary hover:bg-bg hover:text-text"
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {label === "Notifications" && unread?.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                        {unread.unreadCount > 9 ? "9+" : unread.unreadCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>

              {ADMIN_ROLES.includes(context?.role) && (
                <NavLink
                  to="/admin"
                  onClick={() => setMobileNavOpen(false)}
                  className="mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-text-secondary transition hover:bg-bg hover:text-text"
                >
                  <AdminIcon className="h-5 w-5 shrink-0" />
                  <span>Admin Panel</span>
                </NavLink>
              )}

            </div>
          </>
        )}
      </header>

      {/* =========================================================
          DESKTOP LEFT SIDEBAR — NEW COLLEGEBOOK SIDEBAR
          ========================================================= */}
      <aside className="fixed bottom-0 left-0 top-17 z-30 hidden w-48 border-r border-[#1c4f8d] bg-gradient-to-b from-[#123f79] via-[#0d376d] to-[#082b59] text-white lg:block">
        <div className="flex h-full flex-col px-3 py-4">
          <NavLink to="/profile" className="mb-3 rounded-2xl border border-white/20 bg-white/[0.06] p-3 transition hover:bg-white/[0.10]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/25 bg-white/10 text-sm font-bold text-white">
                {profilePhoto ? <img src={profilePhoto} alt="" className="h-full w-full object-cover" /> : initials || "ST"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{fullName}</p>
                <p className="mt-0.5 truncate text-[11px] text-white/70">Student{profile?.department?.name ? ` · ${profile.department.name}` : ""}</p>
              </div>
              <span className="text-xl text-white/80">›</span>
            </div>
          </NavLink>

          <nav className="space-y-1" aria-label="CollegeBook navigation">
            {desktopNavigation.map(({ to, label, icon: Icon, featured }) => (
              <NavLink key={to} to={to} end={to === "/home" || to === "/profile"}
                onMouseEnter={() => prefetchRoute(queryClient, to)} onFocus={() => prefetchRoute(queryClient, to)}
                className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${isActive ? "bg-brand text-white shadow-[0_7px_18px_rgba(0,0,0,0.16)]" : featured ? "text-[#ffd84a] hover:bg-white/10" : "text-white/90 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/15 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/90 shadow-lg">
                <img src="/assets/collegebook/ogigrid-sidebar-logo.png" alt="OgiGrid" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-white/75">Powered by</p>
                <p className="mt-0.5 text-xl font-black tracking-[-0.04em] text-white">Ogi<span className="text-[#5bc8ff]">Grid</span></p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================
          DESKTOP RIGHT SIDEBAR
          ========================================================= */}
      <aside className="fixed bottom-0 right-0 top-17 z-30 hidden w-52 overflow-y-auto border-l border-border bg-surface xl:block">
        <div className="space-y-4 p-4">
          {!isNewsFeedPage && (
            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm" aria-label="News feed preview">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">News &amp; Feeds</h2>
                <span aria-hidden="true">📰</span>
              </div>
              {latestNews ? (
                <>
                  <button type="button" onClick={() => setNewsPopupOpen(true)} className="block w-full text-left" aria-label={`Read news: ${latestNews.title}`}>
                    <p className="line-clamp-3 text-sm font-semibold text-text hover:text-brand">{latestNews.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{latestNews.description || latestNews.source || 'Tap to preview this story.'}</p>
                    <span className="mt-2 inline-block text-[10px] font-bold text-brand">Read story ↗</span>
                  </button>
                  <NavLink to="/news-feeds" className="ml-2 text-[10px] font-bold text-brand">All news →</NavLink>
                </>
              ) : (
                <NavLink to="/news-feeds" className="text-xs text-text-secondary">Explore the latest news →</NavLink>
              )}
            </section>
          )}
          <NavLink to="/institution-news" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Institutional Updates</h2>
<span aria-hidden="true">📢</span>
</div>
            {broadcasts?.items?.length ? <div>
<p className="text-sm font-bold text-text">{broadcasts.items[0].broadcast.title}</p>
<p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{broadcasts.items[0].broadcast.body}</p>
<p className="mt-2 text-[10px] font-semibold text-brand">View all updates →</p>
</div> : <p className="text-xs leading-5 text-text-secondary">No institutional updates yet. <span className="font-semibold text-brand">View announcements →</span>
</p>}
          </NavLink>

          <NavLink to="/yearbook" className="block rounded-2xl border border-[#d9c7a9] bg-[#f8f2e8] p-4 transition hover:shadow-sm">
            <div className="mb-3 flex items-center justify-between">
<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-yearbook">YearBook</p>
<YearBookIcon className="h-4 w-4 text-yearbook" />
</div>
            <p className="text-sm font-bold text-yearbook-ink">Preserve your institution's story.</p>
<p className="mt-1 text-xs text-yearbook-ink/70">Explore graduating classes and memories.</p>
<p className="mt-3 text-[10px] font-bold text-yearbook">View YearBook →</p>
          </NavLink>

          <NavLink to="/network" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Network Requests</h2>
<NetworkIcon className="h-4 w-4 text-text-secondary" />
</div>
            {pendingConnections?.length ? <>
<div className="flex items-center gap-3">
<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-xs font-bold text-brand">{pendingConnections[0].profilePhotoUrl ? <img src={pendingConnections[0].profilePhotoUrl} alt="" className="h-full w-full object-cover" /> : `${pendingConnections[0].firstName?.[0] ?? ''}${pendingConnections[0].lastName?.[0] ?? ''}`}</div>
<div className="min-w-0">
<p className="truncate text-sm font-semibold text-text">{pendingConnections[0].firstName} {pendingConnections[0].lastName}</p>
<p className="text-[11px] text-text-secondary">wants to connect with you</p>
</div>
</div>
<p className="mt-3 text-[10px] font-bold text-brand">{pendingConnections.length} pending request{pendingConnections.length === 1 ? '' : 's'} · View Network →</p>
</> : <p className="text-xs leading-5 text-text-secondary">No new connection requests. <span className="font-semibold text-brand">Open Network →</span>
</p>}
          </NavLink>

          <NavLink to="/birthdays" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Birthdays</h2>
<span aria-hidden="true">🎂</span>
</div>
            {birthdays?.length ? <>
<p className="text-sm font-bold text-text">{birthdays[0].firstName} {birthdays[0].lastName}</p>
<p className="mt-1 text-xs text-text-secondary">Birthday coming up on {new Date(birthdays[0].birthdayDate).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</p>
<p className="mt-2 text-[10px] font-bold text-brand">See upcoming birthdays →</p>
</> : <p className="text-xs leading-5 text-text-secondary">No birthdays shared in the next 7 days.</p>}
          </NavLink>

          <NavLink to="/institution-events" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Upcoming Events</h2>
<span aria-hidden="true">📅</span>
</div>
            {events?.length ? <>
<p className="text-sm font-bold text-text">{events[0].title}</p>
<p className="mt-1 text-xs text-text-secondary">{new Date(events[0].eventDate).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}{events[0].location ? ` · ${events[0].location}` : ''}</p>
<p className="mt-2 text-[10px] font-bold text-brand">Institution Calendar →</p>
</> : <p className="text-xs leading-5 text-text-secondary">No upcoming memorable days published yet.</p>}
          </NavLink>
        </div>
      </aside>

      {/* =========================================================
          RESPONSIVE RIGHT-SIDEBAR DRAWER
          At browser zoom / tablets / mobile the fixed desktop rail is
          intentionally replaced by this drawer so the same information
          never disappears.
          ========================================================= */}
      {updatesOpen && (
        <>
          <button
            type="button"
            aria-label="Close community updates"
            className="fixed inset-0 z-[60] bg-black/25 xl:hidden"
            onClick={() => setUpdatesOpen(false)}
          />
          <aside className="fixed bottom-0 right-0 top-0 z-[70] w-[min(62vw,220px)] overflow-y-auto border-l border-border bg-surface shadow-[-18px_0_45px_rgba(20,40,45,0.16)] xl:hidden">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-4 backdrop-blur">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">CollegeBook</p>
                <h2 className="mt-0.5 text-base font-bold text-text">Community updates</h2>
              </div>
              <button
                type="button"
                onClick={() => setUpdatesOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition hover:bg-bg hover:text-text"
                aria-label="Close community updates"
              >
                <CloseIcon className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="space-y-4 p-4">

          {!isNewsFeedPage && (
            <button type="button" onClick={() => { setUpdatesOpen(false); setNewsPopupOpen(true); }} className="w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-text">News &amp; Feeds 📰</span>
              <p className="mt-2 line-clamp-3 text-sm font-semibold text-text">{latestNews?.title || 'Explore the latest news'}</p>
              <span className="mt-2 inline-block text-[10px] font-bold text-brand">Read news →</span>
            </button>
          )}
          <NavLink onClick={() => setUpdatesOpen(false)} to="/institution-news" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Institutional Updates</h2>
<span aria-hidden="true">📢</span>
</div>
            {broadcasts?.items?.length ? <div>
<p className="text-sm font-bold text-text">{broadcasts.items[0].broadcast.title}</p>
<p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{broadcasts.items[0].broadcast.body}</p>
<p className="mt-2 text-[10px] font-semibold text-brand">View all updates →</p>
</div> : <p className="text-xs leading-5 text-text-secondary">No institutional updates yet. <span className="font-semibold text-brand">View announcements →</span>
</p>}
          </NavLink>

          <NavLink onClick={() => setUpdatesOpen(false)} to="/yearbook" className="block rounded-2xl border border-[#d9c7a9] bg-[#f8f2e8] p-4 transition hover:shadow-sm">
            <div className="mb-3 flex items-center justify-between">
<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-yearbook">YearBook</p>
<YearBookIcon className="h-4 w-4 text-yearbook" />
</div>
            <p className="text-sm font-bold text-yearbook-ink">Preserve your institution's story.</p>
<p className="mt-1 text-xs text-yearbook-ink/70">Explore graduating classes and memories.</p>
<p className="mt-3 text-[10px] font-bold text-yearbook">View YearBook →</p>
          </NavLink>

          <NavLink onClick={() => setUpdatesOpen(false)} to="/network" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Network Requests</h2>
<NetworkIcon className="h-4 w-4 text-text-secondary" />
</div>
            {pendingConnections?.length ? <>
<div className="flex items-center gap-3">
<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-xs font-bold text-brand">{pendingConnections[0].profilePhotoUrl ? <img src={pendingConnections[0].profilePhotoUrl} alt="" className="h-full w-full object-cover" /> : `${pendingConnections[0].firstName?.[0] ?? ''}${pendingConnections[0].lastName?.[0] ?? ''}`}</div>
<div className="min-w-0">
<p className="truncate text-sm font-semibold text-text">{pendingConnections[0].firstName} {pendingConnections[0].lastName}</p>
<p className="text-[11px] text-text-secondary">wants to connect with you</p>
</div>
</div>
<p className="mt-3 text-[10px] font-bold text-brand">{pendingConnections.length} pending request{pendingConnections.length === 1 ? '' : 's'} · View Network →</p>
</> : <p className="text-xs leading-5 text-text-secondary">No new connection requests. <span className="font-semibold text-brand">Open Network →</span>
</p>}
          </NavLink>

          <NavLink onClick={() => setUpdatesOpen(false)} to="/birthdays" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Birthdays</h2>
<span aria-hidden="true">🎂</span>
</div>
            {birthdays?.length ? <>
<p className="text-sm font-bold text-text">{birthdays[0].firstName} {birthdays[0].lastName}</p>
<p className="mt-1 text-xs text-text-secondary">Birthday coming up on {new Date(birthdays[0].birthdayDate).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</p>
<p className="mt-2 text-[10px] font-bold text-brand">See upcoming birthdays →</p>
</> : <p className="text-xs leading-5 text-text-secondary">No birthdays shared in the next 7 days.</p>}
          </NavLink>

          <NavLink onClick={() => setUpdatesOpen(false)} to="/institution-events" className="block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/10">
            <div className="mb-3 flex items-center justify-between">
<h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text">Upcoming Events</h2>
<span aria-hidden="true">📅</span>
</div>
            {events?.length ? <>
<p className="text-sm font-bold text-text">{events[0].title}</p>
<p className="mt-1 text-xs text-text-secondary">{new Date(events[0].eventDate).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}{events[0].location ? ` · ${events[0].location}` : ''}</p>
<p className="mt-2 text-[10px] font-bold text-brand">Institution Calendar →</p>
</> : <p className="text-xs leading-5 text-text-secondary">No upcoming memorable days published yet.</p>}
          </NavLink>
            </div>
          </aside>
        </>
      )}

      {newsPopupOpen && !isNewsFeedPage && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewsPopupOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="sidebar-news-title" className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="sidebar-news-title" className="text-lg font-bold text-text">{latestNews?.title || 'News & Feeds'}</h2>
              <button type="button" aria-label="Close news preview" onClick={() => setNewsPopupOpen(false)} className="rounded-lg border border-border px-3 py-1 text-text">✕</button>
            </div>
            <p className="mt-3 max-h-[45vh] overflow-y-auto whitespace-pre-line text-sm leading-6 text-text-secondary">{latestNews?.description || 'Open News & Feeds to browse current stories.'}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {latestNews?.url && <a href={latestNews.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Read original story ↗</a>}
              <NavLink to="/news-feeds" onClick={() => setNewsPopupOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-brand">Open News &amp; Feeds</NavLink>
            </div>
          </section>
        </div>
      )}
      {/* =========================================================
          MOBILE BOTTOM NAVIGATION
          ========================================================= */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-border bg-surface/95 px-1 py-2 backdrop-blur lg:hidden">
        {navigation
          .filter((item) =>
            ["/home", "/yearbook", "/network", "/messages"].includes(item.to),
          )
          .map(({ to, label, icon: Icon, featured }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/home"}
              className={({ isActive }) =>
                `flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold ${
                  featured
                    ? isActive
                      ? "bg-yearbook-soft text-yearbook"
                      : "text-yearbook"
                    : isActive
                      ? "text-brand"
                      : "text-text-secondary"
                }`
              }
            >
              <Icon className="h-4.75 w-4.75" />
              <span>{label === "Network" ? "Network" : label}</span>
            </NavLink>
          ))}

        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `relative flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold ${
              isActive ? "text-brand" : "text-text-secondary"
            }`
          }
        >
          <BellIcon className="h-4.75 w-4.75" />
          <span>Alerts</span>

          {unread?.unreadCount > 0 && (
            <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[8px] font-bold text-white">
              {unread.unreadCount > 9 ? "9+" : unread.unreadCount}
            </span>
          )}
        </NavLink>
      </nav>

      {/* =========================================================
          PAGE CONTENT
          ========================================================= */}
      <main className="min-h-[calc(100vh-68px)] min-w-0 lg:pl-48 xl:pr-52">
        <div className="w-full min-w-0 px-2 py-4 pb-24 sm:px-3 md:px-4 lg:px-3 lg:py-5 lg:pb-8 2xl:px-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ===============================================================
   ICONS
   =============================================================== */

function CollegeBookIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      {...props}
    >
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" strokeLinecap="round" />
    </svg>
  );
}

function UpdatesIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 5.5h16v11H8l-4 3v-14Z" strokeLinejoin="round" />
      <path d="M8 9h8M8 12.5h5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        d="M3 11.5 12 4l9 7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YearBookIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" strokeLinecap="round" />
    </svg>
  );
}

function NetworkIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="12" cy="17" r="2.5" />
      <path d="M8 8.5 10.5 15M16 8.5 13.5 15" strokeLinecap="round" />
    </svg>
  );
}

function MessageIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        d="M4 5h16v11H8l-4 4V5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GroupsIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function BellIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
    </svg>
  );
}

function NewsFeedIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h6M7 12h10M7 16h7" strokeLinecap="round" />
      <path d="M16.5 8h1.5" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function SearchIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6" strokeLinecap="round" />
    </svg>
  );
}

function AdminIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10"
        strokeLinecap="round"
      />
      <path
        d="M14 8l4 4-4 4M18 12H9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
