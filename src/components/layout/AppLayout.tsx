import { Link, Outlet, useLocation } from "react-router-dom";

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
import { SidebarLeft } from "@/components/layout/SidebarLeft";

const crumbs: Record<string, string> = {
  "/": "Dashboard",
  "/my-task": "My Task",
  "/core-work": "Core Work",
  "/tasks": "Tasks",
  "/handover": "Inbox",
  "/inbox": "Inbox",
  "/notes": "Notes",
  "/reporting": "Reporting",
  "/history": "History",
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

  return (
    <SidebarProvider>
      <SidebarLeft />
      <SidebarInset>
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
            <Badge variant="outline" className="hidden xl:inline-flex">
              Sat, 26 Sep 2026
            </Badge>
            <Badge variant="progress">Shift 1 · 07:00 - 15:00</Badge>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="w-full">
            <Outlet />
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              ONE WORK · ONE OWNER · ONE STATUS · ONE HISTORY · EVIDENCE ·
              COMPLETE OR HANDOVER
            </p>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
