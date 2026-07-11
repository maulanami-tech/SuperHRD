"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/status-badge";
import { ScoreBadge } from "@/components/score-badge";
import type { Candidate, CandidateFieldDefinition } from "@/lib/types";

interface CandidateDrawerProps {
  candidate: Candidate | null;
  fields: CandidateFieldDefinition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (candidate: Candidate) => void;
}

export function CandidateDrawer({
  candidate,
  fields,
  open,
  onOpenChange,
  onUpdated,
}: CandidateDrawerProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (candidate) {
      const initial: Record<string, string> = {};
      for (const field of fields) {
        const value = candidate.fieldValues.find((v) => v.fieldDefinitionId === field.id);
        if (!value) continue;
        if (field.type === "number" || field.type === "currency") {
          initial[field.id] = value.valueNumber != null ? String(value.valueNumber) : "";
        } else if (field.type === "date") {
          initial[field.id] = value.valueDate ? value.valueDate.slice(0, 10) : "";
        } else {
          initial[field.id] = value.valueText ?? "";
        }
      }
      setValues(initial);
      setNotes(candidate.notes ?? "");
    }
  }, [candidate, fields]);

  async function handleSave() {
    if (!candidate) return;
    setSaving(true);
    try {
      const fieldValues = fields.map((field) => ({
        fieldDefinitionId: field.id,
        value: values[field.id] === "" || values[field.id] === undefined ? null : values[field.id],
      }));

      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, fieldValues }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save");

      onUpdated(result);
      toast.success("Candidate updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!candidate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{candidate.name}</SheetTitle>
          <SheetDescription>
            <Link href={`/candidates/${candidate.id}`} className="underline">
              View full candidate details
            </Link>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={candidate.status} />
            <ScoreBadge score={candidate.overallScore} />
          </div>

          {fields.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Custom fields
              </Label>
              {fields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <Label htmlFor={`field-${field.id}`}>{field.label}</Label>
                  <Input
                    id={`field-${field.id}`}
                    type={
                      field.type === "number" || field.type === "currency"
                        ? "number"
                        : field.type === "date"
                          ? "date"
                          : "text"
                    }
                    value={values[field.id] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="drawer-notes">Notes</Label>
            <Textarea
              id="drawer-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
