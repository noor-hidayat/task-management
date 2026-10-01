import {
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  UserCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { avatarColor } from "@/lib/format";
import { useIssues, useWorks } from "@/hooks/useSupabaseLists";
import { useMemo } from "react";


function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function UserDropdownContent({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: works } = useWorks();
  const { data: issues } = useIssues();

  const stats = useMemo(() => {
    if (!user) return { tasks: 0 };
    const userTasks = works.filter((w) => w.assignedTo === user.name);
    const userIssues = issues.filter((i) => (i.assignees ?? [i.assignedTo]).includes(user.name));
    return {
      tasks: userTasks.length + userIssues.length,
    };
  }, [works, issues, user]);

  return (
    <>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
          <Avatar className="h-14 w-14 rounded-full ring-2 ring-primary/20">
            <AvatarFallback className={`text-base font-semibold ${avatarColor(user?.name ?? "")}`}>
              {getInitials(user?.name ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-0.5">
            <p className="text-sm font-semibold leading-tight">
              {user?.name}
            </p>
            <Badge
              variant={user?.role === "admin" ? "default" : user?.role === "Team Leader" || user?.role === "Foreman" ? "secondary" : "outline"}
              className="px-1.5 py-0 text-[10px] font-medium capitalize"
            >
              {user?.role}
            </Badge>
          </div>
        </div>
      </DropdownMenuLabel>

      <DropdownMenuSeparator />

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-2 px-4 pb-3">
        {[
          { label: "Tasks", value: stats.tasks },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center rounded-lg bg-muted/60 px-2 py-2"
          >
            <span className="text-sm font-bold">{stat.value}</span>
            <span className="text-[10px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem className="gap-2.5" onClick={() => navigate("/settings")}>
          <UserCircle2 className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-xs font-medium">My Profile</span>
            <span className="text-[11px] text-muted-foreground">
              Account settings
            </span>
          </div>
        </DropdownMenuItem>

      </DropdownMenuGroup>

      <DropdownMenuSeparator />

<DropdownMenuItem className="gap-2.5 text-destructive focus:text-destructive" onClick={logout}>
  <LogOut className="h-4 w-4" />
  <span className="text-xs font-medium">Log out</span>
</DropdownMenuItem>
    </>
  );
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const { user } = useAuth();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className={`rounded-lg ${avatarColor(user?.name ?? "")}`}>
                  {getInitials(user?.name ?? "")}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.name}</span>
                <span className="truncate text-xs capitalize">{user?.role ?? "Member"}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <UserDropdownContent user={user} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function TopbarUser() {
  const { user } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2.5 rounded-full px-2 pr-3 transition-all hover:bg-muted/60"
        >
          <Avatar className="h-7 w-7 ring-2 ring-background">
            <AvatarFallback className={`text-xs font-semibold ${avatarColor(user?.name ?? "")}`}>
              {getInitials(user?.name ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="hidden items-start text-left sm:grid">
            <span className="text-xs font-semibold leading-tight">
              {user?.name}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">
              {user?.role ?? "Member"}
            </span>
          </div>
          <ChevronDown className="ml-0.5 h-3.5 w-3.5 text-muted-foreground" />

        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[260px] rounded-lg">
        <UserDropdownContent user={user} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
