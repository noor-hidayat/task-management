import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type NavSecondarySubItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
};

export type NavSecondaryItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavSecondarySubItem[];
};

function isUrlActive(url: string, pathname: string) {
  return pathname === url || pathname.startsWith(url + "/");
}

export function NavSecondary({
  label,
  items,
  pathname,
  className,
}: {
  label?: string;
  items: NavSecondaryItem[];
  pathname: string;
  className?: string;
}) {
  return (
    <SidebarGroup className={className}>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            if (item.children && item.children.length > 0) {
              const childActive = item.children.some((c) => isUrlActive(c.url, pathname));
              const parentActive = isUrlActive(item.url, pathname) || childActive;
              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={childActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title} isActive={parentActive}>
                        <item.icon />
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.children.map((sub) => {
                          const active = isUrlActive(sub.url, pathname);
                          const SubIcon = sub.icon;
                          return (
                            <SidebarMenuSubItem key={sub.title}>
                              <SidebarMenuSubButton asChild isActive={active}>
                                <NavLink to={sub.url}>
                                  {SubIcon && <SubIcon />}
                                  <span>{sub.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }
            const active = isUrlActive(item.url, pathname);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={active}>
                  <NavLink to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
                {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
