"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ScoreBadge } from "@/components/score-badge";
import type { Candidate, CandidateFieldDefinition } from "@/lib/types";

function formatFieldValue(
  definition: CandidateFieldDefinition,
  candidate: Candidate
): string | null {
  const value = candidate.fieldValues.find((v) => v.fieldDefinitionId === definition.id);
  if (!value) return null;

  if (definition.type === "number") {
    return value.valueNumber != null ? value.valueNumber.toLocaleString("id-ID") : null;
  }
  if (definition.type === "currency") {
    return value.valueNumber != null
      ? `Rp ${value.valueNumber.toLocaleString("id-ID")}`
      : null;
  }
  if (definition.type === "date") {
    return value.valueDate ? new Date(value.valueDate).toLocaleDateString("id-ID") : null;
  }
  return value.valueText || null;
}

interface KanbanCardProps {
  candidate: Candidate;
  fields: CandidateFieldDefinition[];
  onClick: () => void;
}

export function KanbanCard({ candidate, fields, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const visibleFields = fields
    .map((f) => ({ field: f, value: formatFieldValue(f, candidate) }))
    .filter((f) => f.value !== null)
    .slice(0, 2);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-950">
          {candidate.name}
        </p>
        <ScoreBadge score={candidate.overallScore} size="sm" />
      </div>
      {(candidate.jobPositionId || candidate.posisi) && (
        <p className="mt-1 truncate text-xs text-slate-500">
          {candidate.posisi}
        </p>
      )}
      {visibleFields.length > 0 && (
        <div className="mt-2 space-y-1">
          {visibleFields.map(({ field, value }) => (
            <p key={field.id} className="truncate text-xs text-slate-600">
              <span className="text-slate-400">{field.label}:</span> {value}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
