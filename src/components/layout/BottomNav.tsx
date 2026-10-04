import * as React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronRight,
  CircleDot,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Monitor,
  Moon,
  NotebookPen,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIssues, useWorks } from "@/hooks/useSupabaseLists";
import { avatarColor, initials, issueDisplayStatus } from "@/lib/format";
import { useTheme, type Theme } from "@/hooks/useTheme";

/* ── Tab utama ─────────────────────────────────────────────────────── */

type Tab = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Cocok untuk route turunan, mis. /tasks/TK-001 juga menyalakan tab Tasks. */
  match: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    title: "Home",
    url: "/",
    icon: LayoutDashboard,
    match: (p) => p === "/",
  },
  {
    title: "My Work",
    url: "/my-work",
    icon: ClipboardList,
    match: (p) => p === "/my-work" || p.startsWith("/my-work/") || p.startsWith("/my-task"),
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: ListChecks,
    match: (p) => p === "/tasks" || p.startsWith("/tasks/"),
  },
  {
    title: "Issues",
    url: "/issues",
    icon: CircleDot,
    match: (p) => p === "/issues" || p.startsWith("/issues/"),
  },
];

/* ── Sheet Menu ────────────────────────────────────────────────────── */

function MenuSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isAdmin = user?.role === "admin";

  const close = () => onOpenChange(false);

  const links = [
    { title: "Notes", url: "/notes", icon: NotebookPen },
    { title: "Issue Report", url: "/reporting/issues", icon: BarChart3 },
    { title: "Task Report", url: "/reporting/tasks", icon: BarChart3 },
    { title: "Teams", url: "/teams", icon: Users },
    { title: "Settings", url: "/settings", icon: Settings },
    ...(isAdmin
      ? [{ title: "User Management", url: "/users", icon: ShieldCheck }]
      : []),
  ];

  const themeOptions: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "light", label: "Terang", icon: Sun },
    { value: "dark", label: "Gelap", icon: Moon },
    { value: "system", label: "Sistem", icon: Monitor },
  ];

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        <BottomSheetTitle className="sr-only">Menu navigasi</BottomSheetTitle>
        <BottomSheetDescription className="sr-only">
          Tautan ke halaman lain, pengaturan tampilan, dan keluar.
        </BottomSheetDescription>

        {/* Profil */}
        <div className="flex items-center gap-3 px-5 pt-2 pb-4">
          <Avatar className="h-12 w-12 rounded-full ring-2 ring-primary/15">
            <AvatarFallback className={`text-sm font-semibold ${avatarColor(user?.name ?? "")}`}>
              {initials(user?.name ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{user?.name}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {user?.role ?? "Member"}
            </p>
          </div>
        </div>

        <Separator />

        {/* Navigasi sekunder */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {links.map((l) => (
            <button
              key={l.url}
              type="button"
              onClick={() => {
                close();
                navigate(l.url);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-accent active:bg-accent"
            >
              <l.icon className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1">{l.title}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>
          ))}
        </nav>

        <Separator />

        {/* Tema */}
        <div className="space-y-2 px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Tampilan</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        <button
          type="button"
          onClick={() => {
            close();
            logout();
          }}
          className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          Keluar
        </button>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/* ── Bottom nav ────────────────────────────────────────────────────── */

export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const { data: works } = useWorks();
  const { data: issues } = useIssues();

  // Badge: item yang menunggu aksi milik user yang login.
  const badges = React.useMemo(() => {
    const name = user?.name ?? "";
    const taskCount = works.filter(
      (w) => w.assignedTo === name && !w.cancelled && w.status !== "completed"
    ).length;
    const issueCount = issues.filter(
      (i) =>
        (i.assignedTo === name || (i.assignees ?? []).includes(name)) &&
        issueDisplayStatus(i) !== "closed" &&
        issueDisplayStatus(i) !== "cancelled"
    ).length;
    return { "/tasks": taskCount, "/issues": issueCount } as Record<string, number>;
  }, [works, issues, user?.name]);

  const menuActive =
    pathname.startsWith("/reporting") ||
    pathname.startsWith("/teams") ||
    pathname.startsWith("/notes") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/users");

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="flex h-(--bottom-nav-h) items-stretch">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const badge = badges[tab.url] ?? 0;
            return (
              <li key={tab.url} className="flex-1">
                <NavLink
                  to={tab.url}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {/* Indikator tab aktif */}
                  <span
                    className={cn(
                      "absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="relative">
                    <tab.icon className="h-5 w-5" />
                    {badge > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{tab.title}</span>
                </NavLink>
              </li>
            );
          })}

          {/* Slot Menu */}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className={cn(
                "relative flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
                menuActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity",
                  menuActive ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                {initials(user?.name ?? "?")}
              </span>
              <span>Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      <MenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
