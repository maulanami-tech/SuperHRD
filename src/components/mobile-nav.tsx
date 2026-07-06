"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  Gauge,
  History,
  BarChart3,
  Wallet,
  Settings,
  TicketPercent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/messages";

const navItems: Array<{ titleKey: MessageKey; href: string; icon: typeof LayoutDashboard }> = [
  { titleKey: "common.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { titleKey: "nav.upload", href: "/upload", icon: FileUp },
  { titleKey: "common.analytics", href: "/analytics", icon: BarChart3 },
  { titleKey: "common.topUp", href: "/topup", icon: Wallet },
  { titleKey: "common.history", href: "/credit-history", icon: History },
  { titleKey: "settings.title", href: "/settings", icon: Settings },
];

const adminNavItems: Array<{ titleKey: MessageKey; href: string; icon: typeof Gauge }> = [
  { titleKey: "adminOverview.title", href: "/admin/overview", icon: Gauge },
  { titleKey: "adminPromo.title", href: "/admin/promo-codes", icon: TicketPercent },
];

interface MobileNavProps {
  isAdmin: boolean;
}

export function MobileNav({ isAdmin }: MobileNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="grid h-16 items-center px-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");
          const title = t(item.titleKey);

          return (
            <Link
              key={item.href + title}
              href={item.href}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-1 py-1 text-[11px] font-medium transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="max-w-full truncate">{title}</span>
              {isActive && (
                <div className="absolute -bottom-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-violet-600" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}