import { useLocation } from "react-router-dom";
import {
  BarChart3,
  CircleDot,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { AppLogo } from "@/components/layout/AppLogo";
import { NavMain } from "@/components/layout/NavMain";
import { NavSecondary } from "@/components/layout/NavSecondary";
import { CreateIssueButton } from "@/components/layout/CreateIssue";
import { useAuth } from "@/contexts/AuthContext";

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0" {...props}>
      <SidebarHeader className="gap-1">
        <AppLogo className="px-2 py-3" />
        <div className="px-0">
          <CreateIssueButton className="w-full" />
        </div>
        <NavMain
          pathname={pathname}
          items={[
            { title: "Dashboard", url: "/", icon: LayoutDashboard },
            { title: "My Work", url: "/my-work", icon: ClipboardList },
            { title: "Issues", url: "/issues", icon: CircleDot },
            { title: "Tasks", url: "/tasks", icon: ListChecks },
          ]}
        />
      </SidebarHeader>
        <SidebarContent>
          <NavSecondary
            label="Report"
            pathname={pathname}
            items={[
              {
                title: "Reporting",
                url: "/reporting",
                icon: BarChart3,
                children: [
                  { title: "Issue Report", url: "/reporting/issues" },
                  { title: "Task Report", url: "/reporting/tasks" },
                ],
              },
            ]}
          />
          <NavSecondary
            label="Teams"
            pathname={pathname}
            items={[
              { title: "Teams", url: "/teams", icon: Users },
            ]}
          />
          <NavSecondary
            label="Setting"
            pathname={pathname}
            className="mt-auto"
            items={[
              { title: "Settings", url: "/settings", icon: Settings },
              ...(isAdmin
                ? [{ title: "User Management", url: "/users", icon: ShieldCheck }]
                : []),
            ]}
          />
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>
  );
}
