import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export type NavMainItem = {
  title: string;
  url?: string;
  icon: LucideIcon;
  badge?: string;
  onClick?: () => void;
};

function isItemActive(item: NavMainItem, pathname: string) {
  if (!item.url) return false;
  if (item.url === "/") return pathname === "/";
  return pathname === item.url || pathname.startsWith(item.url + "/");
}

export function NavMain({
  items,
  pathname,
}: {
  items: NavMainItem[];
  pathname: string;
}) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild={!!item.url}
            isActive={isItemActive(item, pathname)}
            onClick={item.url ? undefined : item.onClick}
          >
            {item.url ? (
              <NavLink to={item.url}>
                <item.icon />
                <span>{item.title}</span>
              </NavLink>
            ) : (
              <>
                <item.icon />
                <span>{item.title}</span>
              </>
            )}
          </SidebarMenuButton>
          {item.badge && (
            <SidebarMenuBadge>
              <Badge variant="destructive" className="px-1.5">
                {item.badge}
              </Badge>
            </SidebarMenuBadge>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
