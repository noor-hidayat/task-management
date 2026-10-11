import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, Clock, User, MessageSquare, AlertTriangle, Moon, Sun, ArrowRightLeft } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { TopbarUser } from "@/components/layout/NavUser";
import { BottomNav } from "@/components/layout/BottomNav";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { AppLogo } from "@/components/layout/AppLogo";
import { notificationsForUser, relativeTime } from "@/lib/api/notifications";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const notificationIcon: Record<string, React.ReactNode> = {
  assignment: <User className="h-4 w-4" />,
  mention: <MessageSquare className="h-4 w-4" />,
  progress: <Clock className="h-4 w-4" />,
  overdue: <AlertTriangle className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  handover: <ArrowRightLeft className="h-4 w-4" />,
};

/** Judul singkat halaman untuk app bar mobile. */
function pageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/my-work") || pathname.startsWith("/my-task")) return "My Work";
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/issues")) return "Issues";
  if (pathname.startsWith("/notes")) return "Notes";
  if (pathname.startsWith("/reporting/tasks")) return "Task Report";
  if (pathname.startsWith("/reporting")) return "Issue Report";
  if (pathname.startsWith("/teams")) return "Teams";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/users")) return "Users";
  return "TIMS";
}

export function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { toggle, isDark } = useTheme();
  const { data: allNotifications, markRead, markAllRead } = useNotifications();

  const notifications = React.useMemo(
    () => notificationsForUser(allNotifications, user?.id),
    [allNotifications, user?.id]
  );
  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  return (
    <SidebarProvider className="flex-col">
      {/* ── Topbar full-width di atas (memotong sidebar) ── */}
      <header className="bg-background/95 pt-safe sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md">
          {/* ── Logo TIMS — selalu di topbar (kiri) ── */}
          <AppLogo
            iconClassName="h-4 w-4"
            className="shrink-0 [&>div:first-child]:h-7 [&>div:first-child]:w-7 [&>div:last-child]:hidden min-[420px]:[&>div:last-child]:flex"
          />

          {/* ── Tengah: judul halaman (mobile) ── */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-semibold md:hidden">{pageTitle(pathname)}</span>
          </div>

          {/* ── Search box di tengah-tengah topbar (desktop) ── */}
          <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex w-72 items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 lg:w-96"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] lg:inline-flex">⌘K</kbd>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            {/* Search (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Cari"
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>
            {/* Dark mode — selalu di topbar */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={toggle}
              aria-label={isDark ? "Ganti ke terang" : "Ganti ke gelap"}
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                  <span className="sr-only">Notifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-lg">
                <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                      {unreadCount} new
                    </Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                      Belum ada notifikasi.
                    </p>
                  ) : (
                    notifications.map((notif) => (
                      <DropdownMenuItem
                        key={notif.id}
                        className={cn(
                          "flex flex-col items-start gap-2 px-4 py-3 cursor-pointer",
                          !notif.read && "bg-muted/40"
                        )}
                        onSelect={() => {
                          console.log("[notif-click] link:", notif.link);
                          void markRead(notif.id);
                          if (notif.link) navigate(notif.link);
                        }}
                      >
                          <div className="flex w-full items-start gap-3">
                            <div
                              className={cn(
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                notif.type === "assignment" && "bg-blue-500/10 text-blue-600",
                                notif.type === "mention" && "bg-purple-500/10 text-purple-600",
                                notif.type === "progress" && "bg-amber-500/10 text-amber-600",
                                notif.type === "overdue" && "bg-red-500/10 text-red-600",
                                notif.type === "comment" && "bg-green-500/10 text-green-600",
                                notif.type === "handover" && "bg-sky-500/10 text-sky-600"
                              )}
                            >
                              {notificationIcon[notif.type]}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold leading-tight">
                                  {notif.title}
                                </p>
                                {!notif.read && (
                                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-tight">
                                {notif.message}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>{notif.from}</span>
                                <span>•</span>
                                <span>{relativeTime(notif.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        </DropdownMenuItem>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="justify-center py-2 text-xs font-medium text-primary"
                  disabled={!hasUnread}
                  onClick={() => markAllRead()}
                >
                  Tandai semua dibaca
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TopbarUser />
          </div>
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </header>

      {/* ── Baris bawah topbar: sidebar + konten ── */}
      <div className="flex min-h-0 w-full flex-1 [&_[data-slot=sidebar-container]]:top-14! [&_[data-slot=sidebar-container]]:h-[calc(100svh-3.5rem)]! [&_[data-slot=sidebar-gap]]:h-[calc(100svh-3.5rem)]!">
        <SidebarLeft />
        <SidebarInset className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden">
          <div className={cn("app-content-pad flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden")}>
            <Outlet />
          </div>
        </SidebarInset>
      </div>

      {/* Bottom tab bar — hanya di layar < md */}
      <BottomNav />
    </SidebarProvider>
  );
}
