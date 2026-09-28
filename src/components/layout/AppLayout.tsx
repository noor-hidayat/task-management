import { Link, Outlet, useLocation } from "react-router-dom";
import { Bell, Search, Clock, User, MessageSquare, AlertTriangle, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import * as React from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
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
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { cn } from "@/lib/utils";

const notifications = [
  {
    id: "n-1",
    type: "assignment",
    title: "New task assigned",
    message: "Check Machine Line 4",
    from: "Supervisor A",
    time: "2 min ago",
    read: false,
    taskNumber: "TK-000125",
  },
  {
    id: "n-2",
    type: "mention",
    title: "You were mentioned",
    message: "Please check the pressure reading",
    from: "Operator B",
    time: "15 min ago",
    read: false,
    taskNumber: "TK-000126",
  },
  {
    id: "n-3",
    type: "handover",
    title: "Handover received",
    message: "Cleaning Area 2 (60% progress)",
    from: "Operator A",
    time: "1 hour ago",
    read: true,
    taskNumber: "TK-000126",
  },
  {
    id: "n-4",
    type: "overdue",
    title: "Task overdue",
    message: "Verify stock discrepancy was due yesterday",
    from: "System",
    time: "2 hours ago",
    read: true,
    taskNumber: "TK-000124",
  },
  {
    id: "n-5",
    type: "comment",
    title: "New comment",
    message: "Great work on the inspection!",
    from: "Supervisor A",
    time: "3 hours ago",
    read: true,
    taskNumber: "CW-2026-031",
  },
];

const notificationIcon: Record<string, React.ReactNode> = {
  assignment: <User className="h-4 w-4" />,
  mention: <MessageSquare className="h-4 w-4" />,
  handover: <Clock className="h-4 w-4" />,
  overdue: <AlertTriangle className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
};

const crumbs: Record<string, string> = {
  "/": "Dashboard",
  "/my-task": "My Task",
  "/core-work": "Core Work",
  "/tasks": "Tasks",
  "/handover": "Inbox",
  "/inbox": "Inbox",
  "/projects": "Projects",
  "/notes": "Notes",
  "/teams": "Teams",
  "/schedule": "Schedule",
  "/settings": "Settings",
};

function breadcrumbFor(pathname: string) {
  if (pathname.startsWith("/tasks/")) return "Task Detail";
  return crumbs[pathname] ?? "Team Work";
}

export function AppLayout() {
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { toggle, isDark } = useTheme();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SidebarProvider>
      <SidebarLeft />
      <SidebarInset className="h-svh flex flex-col overflow-hidden">
        <header className="bg-background sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1">
                    <Link to="/">{breadcrumbFor(pathname)}</Link>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2 px-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-56 lg:w-72"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden lg:inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full sm:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>
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
                  {notifications.map((notif) => (
                    <Link
                      key={notif.id}
                      to={`/tasks/${notif.taskNumber}`}
                      className="block"
                    >
                      <DropdownMenuItem
                        className={cn(
                          "flex flex-col items-start gap-2 px-4 py-3 cursor-pointer",
                          !notif.read && "bg-muted/40"
                        )}
                      >
                        <div className="flex w-full items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              notif.type === "assignment" && "bg-blue-500/10 text-blue-600",
                              notif.type === "mention" && "bg-purple-500/10 text-purple-600",
                              notif.type === "handover" && "bg-amber-500/10 text-amber-600",
                              notif.type === "overdue" && "bg-red-500/10 text-red-600",
                              notif.type === "comment" && "bg-green-500/10 text-green-600"
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
                              <span>{notif.time}</span>
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center py-2 text-xs font-medium text-primary">
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TopbarUser />
          </div>
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </header>
        <div className={cn("flex flex-1 min-h-0 flex-col p-4", pathname === "/inbox" || pathname === "/handover" ? "overflow-hidden" : "overflow-y-auto")}>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
