"use client";

import { Menu } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

interface HeaderProps {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  breadcrumbItems?: { label: string; href?: string }[];
  children?: React.ReactNode;
}

export function Header({
  title,
  description,
  breadcrumb,
  breadcrumbItems,
  children,
}: HeaderProps) {
  const { toggleSidebar } = useSidebar();
  const items = breadcrumb ?? breadcrumbItems;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80">
      <div className="flex min-h-16 items-center gap-4 px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="min-w-0 py-2">
            {items && items.length > 0 && (
              <Breadcrumb items={items} className="mb-1 text-xs" />
            )}
            <div className="flex min-w-0 items-baseline gap-3">
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950">
                {title}
              </h1>
              {description && (
                <p className="hidden truncate text-sm text-slate-500 lg:block">
                  {description}
                </p>
              )}
            </div>
            {description && (
              <p className="mt-0.5 hidden text-sm text-slate-500 sm:block lg:hidden">
                {description}
              </p>
            )}
          </div>
          {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-blue-600/70 via-slate-200 to-emerald-500/60" />
    </header>
  );
}