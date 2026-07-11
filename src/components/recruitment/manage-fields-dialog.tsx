"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CandidateFieldDefinition, CandidateFieldType } from "@/lib/types";

interface ManageFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: CandidateFieldDefinition[];
  onFieldsChange: (fields: CandidateFieldDefinition[]) => void;
}

const typeLabels: Record<CandidateFieldType, string> = {
  number: "Number",
  currency: "Currency (Rp)",
  text: "Text",
  date: "Date",
};

export function ManageFieldsDialog({
  open,
  onOpenChange,
  fields,
  onFieldsChange,
}: ManageFieldsDialogProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CandidateFieldType>("currency");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!label.trim()) {
      toast.error("Field label is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/pipeline-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), type }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create field");

      onFieldsChange([...fields, result]);
      setLabel("");
      toast.success("Field created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create field");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(field: CandidateFieldDefinition) {
    try {
      const res = await fetch(`/api/pipeline-fields/${field.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete field");

      onFieldsChange(fields.filter((f) => f.id !== field.id));
      toast.success("Field deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete field");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage custom fields</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-sm text-slate-500">No custom fields yet.</p>
          ) : (
            fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{field.label}</p>
                  <p className="text-xs text-slate-500">{typeLabels[field.type]}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(field)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <Label>Add new field</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Nominal Tawaran"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1"
            />
            <Select value={type} onValueChange={(v) => setType(v as CandidateFieldType)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="currency">Currency (Rp)</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={handleAdd} disabled={submitting}>
            {submitting ? "Adding..." : "Add field"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
