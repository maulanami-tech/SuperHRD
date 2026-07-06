"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export type CandidateStatus = "pending" | "processing" | "completed" | "failed";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<
  CandidateStatus,
  { labelKey: "statuses.pending" | "statuses.processing" | "statuses.completed" | "statuses.failed"; classes: string; icon?: boolean }
> = {
  pending: {
    labelKey: "statuses.pending",
    classes: "bg-slate-100 text-slate-700 ring-1 ring-slate-600/20",
  },
  processing: {
    labelKey: "statuses.processing",
    classes: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
    icon: true,
  },
  completed: {
    labelKey: "statuses.completed",
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  },
  failed: {
    labelKey: "statuses.failed",
    classes: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useI18n();
  const config =
    statusConfig[status as CandidateStatus] ?? statusConfig.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.classes,
        className
      )}
    >
      {config.icon && <Loader2 className="h-3 w-3 animate-spin" />}
      {t(config.labelKey)}
    </span>
  );
}