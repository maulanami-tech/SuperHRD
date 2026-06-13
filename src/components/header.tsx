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
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="flex flex-1 items-center justify-between gap-4">
        <div className="min-w-0">
          {items && items.length > 0 && (
            <Breadcrumb items={items} className="mb-1" />
          )}
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="hidden text-sm text-muted-foreground sm:block">
              {description}
            </p>
          )}
        </div>
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
