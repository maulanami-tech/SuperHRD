"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StageColorPicker } from "@/components/recruitment/stage-color-picker";
import type { StageColor } from "@/components/pipeline-stage-badge";
import type { PipelineStage } from "@/lib/types";

interface StageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage?: PipelineStage | null;
  onSaved: (stage: PipelineStage) => void;
  onDeleted?: (id: string) => void;
}

export function StageFormDialog({
  open,
  onOpenChange,
  stage,
  onSaved,
  onDeleted,
}: StageFormDialogProps) {
  const isEdit = !!stage;
  const [name, setName] = useState("");
  const [color, setColor] = useState<StageColor>("slate");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(stage?.name ?? "");
      setColor((stage?.color as StageColor) ?? "slate");
    }
  }, [open, stage]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Stage name is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/pipeline-stages/${stage!.id}` : "/api/pipeline-stages";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save stage");

      onSaved(result);
      onOpenChange(false);
      toast.success(isEdit ? "Stage updated" : "Stage created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save stage");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!stage) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pipeline-stages/${stage.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete stage");

      onDeleted?.(stage.id);
      onOpenChange(false);
      toast.success("Stage deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete stage");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit stage" : "New stage"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Stage name</Label>
            <Input
              id="stage-name"
              placeholder="e.g. Technical Interview"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <StageColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDelete}
              disabled={deleting || submitting}
            >
              {deleting ? "Deleting..." : "Delete stage"}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={handleSubmit} disabled={submitting || deleting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
