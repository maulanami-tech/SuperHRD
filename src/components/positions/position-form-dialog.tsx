"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { jobPositionSchema, type JobPositionInput } from "@/lib/validations";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobPositionListItem } from "@/lib/types";

interface PositionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position?: JobPositionListItem | null;
  onSaved: (position: JobPositionListItem) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

export function PositionFormDialog({
  open,
  onOpenChange,
  position,
  onSaved,
}: PositionFormDialogProps) {
  const { t } = useI18n();
  const isEdit = !!position;
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<JobPositionInput>({
    resolver: zodResolver(jobPositionSchema),
    defaultValues: {
      title: "",
      description: "",
      kriteria: "",
      prompt: "",
    },
  });

  const titleValue = watch("title");

  useEffect(() => {
    if (open) {
      reset({
        title: position?.title ?? "",
        description: position?.description ?? "",
        kriteria: position?.kriteria ?? "",
        prompt: position?.prompt ?? "",
      });
    }
  }, [open, position, reset]);

  async function handleGenerate() {
    if (!titleValue?.trim()) {
      toast.error("Please enter a position title first");
      return;
    }

    const confirmed = window.confirm(
      "Generate criteria and prompt for this role? This will use 1 paid credit. You can edit the result before saving."
    );
    if (!confirmed) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/upload/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posisi: titleValue, mode: "single" }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to generate prompt");
      }

      setValue("kriteria", result.kriteria, { shouldValidate: true });
      setValue("prompt", result.prompt, { shouldValidate: true });
      toast.success("Criteria and prompt generated. 1 paid credit used.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setGenerating(false);
    }
  }

  async function onSubmit(data: JobPositionInput) {
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/positions/${position!.id}` : "/api/positions";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error?.formErrors?.[0] || result.error || "Failed to save position");
      }

      toast.success(isEdit ? t("positions.updateSuccess") : t("positions.createSuccess"));
      onSaved(result);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save position");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("positions.editPosition") : t("positions.newPosition")}</DialogTitle>
          <DialogDescription>{t("positions.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="position-title">
              {t("positions.fieldTitle")} <span className="text-red-600">*</span>
            </Label>
            <Input
              id="position-title"
              placeholder="e.g. Senior Backend Developer"
              {...register("title")}
            />
            <FieldError message={errors.title?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position-description">{t("positions.fieldDescription")}</Label>
            <Textarea
              id="position-description"
              placeholder="Short job description (optional)"
              rows={3}
              {...register("description")}
            />
            <FieldError message={errors.description?.message} />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                <Sparkles className="h-4 w-4 text-blue-700" />
                Generate criteria with AI
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={generating || !titleValue?.trim()}
                onClick={handleGenerate}
                className="shrink-0 border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position-kriteria">
              {t("positions.fieldKriteria")} <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="position-kriteria"
              placeholder="e.g. Minimum 3 years of Python experience"
              rows={4}
              {...register("kriteria")}
            />
            <FieldError message={errors.kriteria?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position-prompt">
              {t("positions.fieldPrompt")} <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="position-prompt"
              placeholder="e.g. Evaluate this CV against the criteria above"
              rows={4}
              {...register("prompt")}
            />
            <FieldError message={errors.prompt?.message} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.save")}
                </>
              ) : (
                t("common.save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
