"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stageDotClasses, type StageColor } from "@/components/pipeline-stage-badge";
import { KanbanCard } from "@/components/recruitment/kanban-card";
import { StageFormDialog } from "@/components/recruitment/stage-form-dialog";
import { CandidateDrawer } from "@/components/recruitment/candidate-drawer";
import type { Candidate, CandidateFieldDefinition, PipelineStage } from "@/lib/types";

interface KanbanBoardProps {
  stages: PipelineStage[];
  fields: CandidateFieldDefinition[];
  candidates: Candidate[];
  onStagesChange: (stages: PipelineStage[]) => void;
  onCandidateUpdated: (candidate: Candidate) => void;
}

const UNASSIGNED_STAGE_ID = "__unassigned__";

function KanbanColumn({
  id,
  name,
  color,
  candidates,
  fields,
  onEditStage,
  onCardClick,
  emptyLabel = "Drop candidates here",
}: {
  id: string;
  name: string;
  color: string;
  candidates: Candidate[];
  fields: CandidateFieldDefinition[];
  onEditStage?: () => void;
  onCardClick: (candidate: Candidate) => void;
  emptyLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100/80 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stageDotClasses[color as StageColor] ?? stageDotClasses.slate}`} />
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-500/15">
            {candidates.length}
          </span>
        </div>
        {onEditStage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEditStage}>Edit stage</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-28 flex-1 flex-col gap-2 p-2 transition-colors ${isOver ? "bg-blue-50" : ""}`}
      >
        {candidates.map((candidate) => (
          <KanbanCard
            key={candidate.id}
            candidate={candidate}
            fields={fields}
            onClick={() => onCardClick(candidate)}
          />
        ))}
        {candidates.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  stages,
  fields,
  candidates,
  onStagesChange,
  onCandidateUpdated,
}: KanbanBoardProps) {
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const candidate = candidates.find((c) => c.id === active.id);
    if (!candidate) return;

    const droppedOnUnassigned = over.id === UNASSIGNED_STAGE_ID;
    const targetStageId = droppedOnUnassigned ? null : String(over.id);
    if ((candidate.pipelineStageId ?? null) === targetStageId) return;

    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStageId: targetStageId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to move candidate");
      onCandidateUpdated(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move candidate");
    }
  }

  function openCardDrawer(candidate: Candidate) {
    setActiveCandidate(candidate);
    setDrawerOpen(true);
  }

  function handleStageSaved(stage: PipelineStage) {
    const exists = stages.some((s) => s.id === stage.id);
    onStagesChange(
      exists ? stages.map((s) => (s.id === stage.id ? { ...s, ...stage } : s)) : [...stages, stage]
    );
  }

  function handleStageDeleted(id: string) {
    onStagesChange(stages.filter((s) => s.id !== id));
  }

  const unassignedCandidates = candidates.filter((c) => !c.pipelineStageId);

  return (
    <div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {unassignedCandidates.length > 0 && (
            <KanbanColumn
              id={UNASSIGNED_STAGE_ID}
              name="Unassigned"
              color="slate"
              candidates={unassignedCandidates}
              fields={fields}
              onCardClick={openCardDrawer}
              emptyLabel="Drag here to unassign"
            />
          )}
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              id={stage.id}
              name={stage.name}
              color={stage.color}
              candidates={candidates.filter((c) => c.pipelineStageId === stage.id)}
              fields={fields}
              onEditStage={() => {
                setEditingStage(stage);
                setStageDialogOpen(true);
              }}
              onCardClick={openCardDrawer}
            />
          ))}
          <div className="shrink-0">
            <Button
              variant="outline"
              className="h-10 border-dashed border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700"
              onClick={() => {
                setEditingStage(null);
                setStageDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add stage
            </Button>
          </div>
        </div>
      </DndContext>

      <StageFormDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        stage={editingStage}
        onSaved={handleStageSaved}
        onDeleted={handleStageDeleted}
      />

      <CandidateDrawer
        candidate={activeCandidate}
        fields={fields}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdated={(updated) => {
          onCandidateUpdated(updated);
          setActiveCandidate(updated);
        }}
      />
    </div>
  );
}
