import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type CandidateStatus = "pending" | "processing" | "completed" | "failed";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<
  CandidateStatus,
  { label: string; classes: string; icon?: boolean }
> = {
  pending: {
    label: "Pending",
    classes: "bg-slate-100 text-slate-700 ring-1 ring-slate-600/20",
  },
  processing: {
    label: "Processing",
    classes: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
    icon: true,
  },
  completed: {
    label: "Completed",
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  },
  failed: {
    label: "Failed",
    classes: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
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
      {config.icon && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {config.label}
    </span>
  );
}
