import * as React from "react";
import { useLocation } from "react-router-dom";
import {
  AudioWaveform,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Command,
  History,
  Inbox,
  LayoutDashboard,
  NotebookPen,
  Search,
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
import { NavUser } from "@/components/layout/NavUser";
import { CreateTaskButton } from "@/components/layout/CreateTask";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

const teams = [
  { name: "Production A", logo: Command, plan: "Shift ops" },
  { name: "Maintenance", logo: AudioWaveform, plan: "Support" },
];

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <>
      <Sidebar className="border-r-0" {...props}>
        <SidebarHeader>
          <TeamSwitcher teams={teams} />
          <div className="px-0 pt-1">
            <CreateTaskButton className="w-full" />
          </div>
          <NavMain
            pathname={pathname}
            items={[
              { title: "Search", icon: Search, onClick: () => setSearchOpen(true) },
              { title: "Dashboard", url: "/", icon: LayoutDashboard },
              { title: "My Task", url: "/my-task", icon: ClipboardList },
              { title: "Inbox", url: "/inbox", icon: Inbox, badge: "2" },
            ]}
          />
        </SidebarHeader>
        <SidebarContent>
          <NavSecondary
            label="Notes & Report"
            pathname={pathname}
            items={[
              { title: "Notes", url: "/notes", icon: NotebookPen },
              { title: "Reporting", url: "/reporting", icon: BarChart3 },
            ]}
          />
          <NavSecondary
            label="Teams"
            pathname={pathname}
            items={[
              { title: "Teams", url: "/teams", icon: Users },
              { title: "Schedule", url: "/schedule", icon: CalendarDays },
              { title: "History", url: "/history", icon: History },
            ]}
          />
          <NavSecondary
            label="Setting"
            pathname={pathname}
            className="mt-auto"
            items={[{ title: "Settings", url: "/settings", icon: Settings }]}
          />
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
