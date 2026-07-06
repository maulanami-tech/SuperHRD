"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  Gauge,
  LogOut,
  BarChart3,
  Wallet,
  History,
  Settings,
  TicketPercent,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/lib/actions";
import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/messages";

const navItems: Array<{ titleKey: MessageKey; href: string; icon: typeof LayoutDashboard }> = [
  { titleKey: "common.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { titleKey: "common.uploadCv", href: "/upload", icon: FileUp },
  { titleKey: "common.analytics", href: "/analytics", icon: BarChart3 },
  { titleKey: "common.topUp", href: "/topup", icon: Wallet },
  { titleKey: "common.history", href: "/credit-history", icon: History },
  { titleKey: "settings.title", href: "/settings", icon: Settings },
];

const adminNavItems: Array<{ titleKey: MessageKey; href: string; icon: typeof Gauge }> = [
  { titleKey: "adminOverview.title", href: "/admin/overview", icon: Gauge },
  { titleKey: "adminPromo.title", href: "/admin/promo-codes", icon: TicketPercent },
];

interface AppSidebarProps {
  isAdmin: boolean;
}

export function AppSidebar({ isAdmin }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { t } = useI18n();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex h-14 items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img
            src="/superhrd-logo-mark.svg"
            alt=""
            className="h-8 w-8 shrink-0"
            width={32}
            height={32}
          />
          <span className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            SuperHRD
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("common.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const title = t(item.titleKey);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={title}
                      className="transition-colors duration-200 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/10 data-[active=true]:to-violet-100 data-[active=true]:text-primary data-[active=true]:font-medium"
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("common.admin")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const title = t(item.titleKey);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={title}
                        className="transition-colors duration-200 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/10 data-[active=true]:to-violet-100 data-[active=true]:text-primary data-[active=true]:font-medium"
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpenMobile(false)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <Separator className="mb-2" />
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2 transition-colors duration-200 hover:bg-red-50 hover:text-red-600"
            size="sm"
          >
            <LogOut className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">
              {t("common.signOut")}
            </span>
          </Button>
        </form>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}