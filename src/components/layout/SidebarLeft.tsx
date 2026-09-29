import { useLocation } from "react-router-dom";
import {
  AudioWaveform,
  BarChart3,
  CircleDot,
  ClipboardList,
  Command,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { TeamSwitcher } from "@/components/layout/TeamSwitcher";
import { NavMain } from "@/components/layout/NavMain";
import { NavSecondary } from "@/components/layout/NavSecondary";
import { CreateTaskButton } from "@/components/layout/CreateTask";

const teams = [
  { name: "Production A", logo: Command, plan: "Shift ops" },
  { name: "Maintenance", logo: AudioWaveform, plan: "Support" },
];

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
        <div className="px-0 pt-1">
          <CreateTaskButton className="w-full" />
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
              { title: "Reporting", url: "/reporting", icon: BarChart3 },
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
            items={[{ title: "Settings", url: "/settings", icon: Settings }]}
          />
        </SidebarContent>
        <SidebarFooter />
        <SidebarRail />
      </Sidebar>
  );
}
