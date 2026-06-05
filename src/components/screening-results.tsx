"use client";

import { cn } from "@/lib/utils";
import type { CriteriaItem } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ScreeningResultsProps {
  overallScore: number;
  summary: string;
  criteria: CriteriaItem[];
}

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-600"
      : score >= 60
        ? "text-amber-600"
        : "text-red-600";
  const bgColor =
    score >= 80
      ? "bg-emerald-50"
      : score >= 60
        ? "bg-amber-50"
        : "bg-red-50";

  return (
    <div
      className={cn(
        "flex h-24 w-24 items-center justify-center rounded-full ring-4",
        bgColor,
        score >= 80 && "ring-emerald-200",
        score >= 60 && score < 80 && "ring-amber-200",
        score < 60 && "ring-red-200"
      )}
    >
      <div className="text-center">
        <span className={cn("text-3xl font-bold", color)}>
          {Math.round(score)}
        </span>
        <span className="block text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

export function ScreeningResults({
  overallScore,
  summary,
  criteria,
}: ScreeningResultsProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <ScoreCircle score={overallScore} />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg font-semibold">Overall Assessment</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </div>
      </div>

      {criteria.length > 0 && (
        <div>
          <h3 className="mb-3 text-base font-semibold">Criteria Breakdown</h3>
          <Accordion type="single" collapsible className="space-y-2">
            {criteria.map((criterion, index) => (
              <AccordionItem
                key={index}
                value={`criterion-${index}`}
                className="rounded-lg border px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center gap-3 pr-2">
                    <span className="text-sm font-medium text-left">
                      {criterion.name}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="hidden w-24 sm:block">
                        <ScoreBar score={criterion.score} />
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          criterion.score >= 80
                            ? "text-emerald-600"
                            : criterion.score >= 60
                              ? "text-amber-600"
                              : "text-red-600"
                        )}
                      >
                        {Math.round(criterion.score)}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pb-2">
                    <div className="sm:hidden">
                      <ScoreBar score={criterion.score} />
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {criterion.notes}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}
