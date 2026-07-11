"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import type { JobPositionStatus } from "@/lib/types";

const statusConfig: Record<JobPositionStatus, { labelKey: "positions.statusOpen" | "positions.statusClosed" | "positions.statusArchived"; classes: string }> = {
  open: {
    labelKey: "positions.statusOpen",
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  },
  closed: {
    labelKey: "positions.statusClosed",
    classes: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  },
  archived: {
    labelKey: "positions.statusArchived",
    classes: "bg-slate-100 text-slate-600 ring-1 ring-slate-500/20",
  },
};

export function PositionStatusBadge({
  status,
  className,
}: {
  status: JobPositionStatus;
  className?: string;
}) {
  const { t } = useI18n();
  const config = statusConfig[status] ?? statusConfig.open;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.classes,
        className
      )}
    >
      {t(config.labelKey)}
    </span>
  );
}
