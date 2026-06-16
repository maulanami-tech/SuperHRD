"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  History,
  BarChart3,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Upload", href: "/upload", icon: FileUp },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Top Up", href: "/topup", icon: Wallet },
  { title: "History", href: "/credit-history", icon: History },
];

const adminNavItems = [
  { title: "Approve", href: "/admin/topup-requests", icon: ShieldCheck },
];

interface MobileNavProps {
  isAdmin: boolean;
}

export function MobileNav({ isAdmin }: MobileNavProps) {
  const pathname = usePathname();
  const items = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
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

          return (
            <Link
              key={item.href + item.title}
              href={item.href}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-1 py-1 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
