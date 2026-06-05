import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreBadge({ score, size = "md", className }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
          size === "sm" && "h-6 min-w-6 px-2 text-xs",
          size === "md" && "h-7 min-w-7 px-2.5 text-sm",
          size === "lg" && "h-10 min-w-10 px-3 text-base",
          className
        )}
      >
        —
      </span>
    );
  }

  const colorClass =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
      : score >= 60
        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
        : "bg-red-50 text-red-700 ring-1 ring-red-600/20";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold",
        size === "sm" && "h-6 min-w-6 px-2 text-xs",
        size === "md" && "h-7 min-w-7 px-2.5 text-sm",
        size === "lg" && "h-10 min-w-10 px-3 text-base",
        colorClass,
        className
      )}
    >
      {Math.round(score)}
    </span>
  );
}
