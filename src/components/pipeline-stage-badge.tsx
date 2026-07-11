"use client";

import { cn } from "@/lib/utils";

export type StageColor =
  | "slate"
  | "blue"
  | "indigo"
  | "violet"
  | "pink"
  | "amber"
  | "emerald"
  | "red";

export const stageColorClasses: Record<StageColor, string> = {
  slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-500/20",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20",
  violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20",
  pink: "bg-pink-50 text-pink-700 ring-1 ring-pink-600/20",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  red: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
};

export const stageDotClasses: Record<StageColor, string> = {
  slate: "bg-slate-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
};

export const stageColorOptions: StageColor[] = [
  "slate",
  "blue",
  "indigo",
  "violet",
  "pink",
  "amber",
  "emerald",
  "red",
];

interface PipelineStageBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function PipelineStageBadge({ name, color, className }: PipelineStageBadgeProps) {
  const classes = stageColorClasses[color as StageColor] ?? stageColorClasses.slate;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        classes,
        className
      )}
    >
      {name}
    </span>
  );
}
