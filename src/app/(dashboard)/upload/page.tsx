"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileArchive,
  FileText,
  Info,
  Loader2,
  PlusCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  batchUploadSchema,
  uploadSchema,
  type BatchUploadInput,
  type UploadInput,
} from "@/lib/validations";
import { Header } from "@/components/header";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PositionFormDialog } from "@/components/positions/position-form-dialog";
import type { JobPositionListItem } from "@/lib/types";

 type BatchInvalidFile = {
  fileName: string;
  reason: string;
};

type BatchSummary = {
  acceptedFiles: number;
  batchId?: string;
  invalidFiles: BatchInvalidFile[];
  rejectedFiles: number;
  totalFiles?: number;
};

type UploadMode = "single" | "batch";

const ZIP_ACCEPT = {
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

const MAX_ZIP_SIZE = 50 * 1024 * 1024;

function RequiredMark() {
  return <span className="text-red-600">*</span>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

function FormSection({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <section className="space-y-4 border-b border-slate-100 px-5 py-5 last:border-b-0 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function AiSetupPanel({
  disabled,
  generating,
  mode,
  onGenerate,
}: {
  disabled: boolean;
  generating: boolean;
  mode: UploadMode;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
            <Sparkles className="h-4 w-4 text-blue-700" />
            Generate criteria with AI
          </div>
          <p className="mt-1 text-sm leading-6 text-blue-900/75">
            Optional. Uses 1 paid credit and fills the criteria and prompt fields for this {mode === "batch" ? "batch role" : "candidate role"}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={generating || disabled}
          onClick={onGenerate}
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
      {disabled && !generating && (
        <p className="mt-3 text-xs font-medium text-blue-800">
          Enter a position first to enable generation.
        </p>
      )}
    </div>
  );
}

function WorkflowPanel({ mode }: { mode: UploadMode }) {
  const steps = mode === "single"
    ? [
        "Add candidate identity",
        "Set role and screening criteria",
        "Attach one CV file",
        "Queue AI screening",
      ]
    : [
        "Set one role for the batch",
        "Attach a ZIP with CV files",
        "Review accepted and skipped files",
        "Open the batch on dashboard",
      ];

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-base text-slate-950">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Screening workflow
          </CardTitle>
          <CardDescription>What happens after this form is submitted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, index) => (
            <div key={step} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                {index + 1}
              </div>
              <p className="pt-1 text-sm leading-5 text-slate-700">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-base text-slate-950">
            <Info className="h-4 w-4 text-blue-700" />
            File requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
          {mode === "single" ? (
            <>
              <p>Accepted: PDF, DOCX, or DOC.</p>
              <p>Maximum file size: 10MB.</p>
              <p>Use a clear role and criteria to improve screening quality.</p>
            </>
          ) : (
            <>
              <p>Accepted: one ZIP file up to 50MB.</p>
              <p>Up to 50 valid CVs can be queued in one batch.</p>
              <p>Skipped files are reported before you leave the page.</p>
            </>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

function BatchSummaryCard({
  summary,
  onViewBatch,
}: {
  summary: BatchSummary;
  onViewBatch: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Accepted</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-950">{summary.acceptedFiles}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Skipped</p>
          <p className="mt-1 text-2xl font-semibold text-amber-950">{summary.rejectedFiles}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{summary.totalFiles ?? "-"}</p>
        </div>
      </div>

      {summary.invalidFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Files to fix
          </div>
          <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white">
            {summary.invalidFiles.map((item, index) => (
              <div
                key={`${item.fileName}-${index}`}
                className="grid gap-1 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[1fr_1.2fr]"
              >
                <span className="truncate font-medium text-slate-900">{item.fileName}</span>
                <span className="text-slate-500">{item.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.batchId && (
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-slate-300 bg-white"
          onClick={onViewBatch}
        >
          View batch on dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

const CUSTOM_POSITION = "__custom__";
const CREATE_POSITION = "__create__";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [posisiValue, setPosisiValue] = useState("");
  const [batchPosisiValue, setBatchPosisiValue] = useState("");

  const [positions, setPositions] = useState<JobPositionListItem[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [selectedPositionId, setSelectedPositionId] = useState<string>(CUSTOM_POSITION);
  const [batchSelectedPositionId, setBatchSelectedPositionId] = useState<string>(CUSTOM_POSITION);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogTarget, setCreateDialogTarget] = useState<UploadMode>("single");
  const [savingToPosition, setSavingToPosition] = useState(false);
  const [batchSavingToPosition, setBatchSavingToPosition] = useState(false);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/positions?status=open");
      if (!res.ok) return;
      const data = await res.json();
      setPositions(data);
    } catch {
      // Position list is optional; upload still works without it.
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UploadInput>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: "",
      email: "",
      posisi: "",
      kriteria: "",
      prompt: "",
    },
  });

  const {
    register: registerBatch,
    handleSubmit: handleBatchSubmit,
    setValue: setBatchValue,
    watch: watchBatch,
    formState: { errors: batchErrors },
  } = useForm<BatchUploadInput>({
    resolver: zodResolver(batchUploadSchema),
    defaultValues: {
      posisi: "",
      kriteria: "",
      prompt: "",
    },
  });

  const kriteriaValue = watch("kriteria");
  const promptValue = watch("prompt");
  const batchKriteriaValue = watchBatch("kriteria");
  const batchPromptValue = watchBatch("prompt");

  function selectPosition(mode: UploadMode, value: string) {
    if (value === CREATE_POSITION) {
      setCreateDialogTarget(mode);
      setCreateDialogOpen(true);
      return;
    }

    if (mode === "batch") {
      setBatchSelectedPositionId(value);
      if (value === CUSTOM_POSITION) {
        setBatchValue("posisi", "");
        setBatchPosisiValue("");
        return;
      }
      const position = positions.find((p) => p.id === value);
      if (position) {
        setBatchValue("posisi", position.title, { shouldValidate: true });
        setBatchValue("kriteria", position.kriteria, { shouldValidate: true });
        setBatchValue("prompt", position.prompt, { shouldValidate: true });
        setBatchPosisiValue(position.title);
      }
    } else {
      setSelectedPositionId(value);
      if (value === CUSTOM_POSITION) {
        setValue("posisi", "");
        setPosisiValue("");
        return;
      }
      const position = positions.find((p) => p.id === value);
      if (position) {
        setValue("posisi", position.title, { shouldValidate: true });
        setValue("kriteria", position.kriteria, { shouldValidate: true });
        setValue("prompt", position.prompt, { shouldValidate: true });
        setPosisiValue(position.title);
      }
    }
  }

  function handlePositionCreated(created: JobPositionListItem) {
    setPositions((prev) => [created, ...prev]);
    selectPosition(createDialogTarget, created.id);
  }

  async function saveToPosition(mode: UploadMode) {
    const isBatch = mode === "batch";
    const positionId = isBatch ? batchSelectedPositionId : selectedPositionId;
    if (positionId === CUSTOM_POSITION || positionId === CREATE_POSITION) return;

    const kriteria = isBatch ? batchKriteriaValue : kriteriaValue;
    const prompt = isBatch ? batchPromptValue : promptValue;

    if (isBatch) setBatchSavingToPosition(true);
    else setSavingToPosition(true);

    try {
      const res = await fetch(`/api/positions/${positionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kriteria, prompt }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save to position");

      setPositions((prev) => prev.map((p) => (p.id === positionId ? { ...p, kriteria, prompt } : p)));
      toast.success("Saved to position. Future uploads will reuse this criteria.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save to position");
    } finally {
      if (isBatch) setBatchSavingToPosition(false);
      else setSavingToPosition(false);
    }
  }

  async function generatePrompt(mode: UploadMode) {
    const isBatch = mode === "batch";
    const currentPosisi = isBatch ? batchPosisiValue : posisiValue;
    if (!currentPosisi?.trim()) {
      toast.error("Please enter a position before generating");
      return;
    }

    const confirmed = window.confirm(
      "Generate criteria and prompt for this role? This will use 1 paid credit. You can edit the result before uploading.",
    );
    if (!confirmed) return;

    if (isBatch) {
      setBatchGenerating(true);
    } else {
      setGenerating(true);
    }

    try {
      const res = await fetch("/api/upload/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posisi: currentPosisi, mode }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to generate prompt");
      }

      if (isBatch) {
        setBatchValue("kriteria", result.kriteria, { shouldValidate: true });
        setBatchValue("prompt", result.prompt, { shouldValidate: true });
      } else {
        setValue("kriteria", result.kriteria, { shouldValidate: true });
        setValue("prompt", result.prompt, { shouldValidate: true });
      }

      toast.success("Criteria and prompt generated. 1 paid credit used.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      if (isBatch) {
        setBatchGenerating(false);
      } else {
        setGenerating(false);
      }
    }
  }

  async function onSubmit(data: UploadInput) {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.email) formData.append("email", data.email);
      formData.append("posisi", data.posisi);
      formData.append("kriteria", data.kriteria);
      formData.append("prompt", data.prompt);
      if (selectedPositionId !== CUSTOM_POSITION && selectedPositionId !== CREATE_POSITION) {
        formData.append("jobPositionId", selectedPositionId);
      }
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Upload failed");
      }

      toast.success("CV uploaded! AI screening in progress.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onBatchSubmit(data: BatchUploadInput) {
    if (!batchFile) {
      toast.error("Please select a ZIP file to upload");
      return;
    }

    setBatchSubmitting(true);
    setBatchSummary(null);
    try {
      const formData = new FormData();
      formData.append("posisi", data.posisi);
      formData.append("kriteria", data.kriteria);
      formData.append("prompt", data.prompt);
      if (batchSelectedPositionId !== CUSTOM_POSITION && batchSelectedPositionId !== CREATE_POSITION) {
        formData.append("jobPositionId", batchSelectedPositionId);
      }
      formData.append("file", batchFile);

      const res = await fetch("/api/upload/batch", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        setBatchSummary({
          acceptedFiles: result.acceptedFiles ?? 0,
          invalidFiles: result.invalidFiles ?? [],
          rejectedFiles: result.invalidFiles?.length ?? 0,
          totalFiles: result.totalFiles,
        });
        throw new Error(result.error || "Batch upload failed");
      }

      setBatchSummary({
        acceptedFiles: result.acceptedFiles,
        batchId: result.batchId,
        invalidFiles: result.invalidFiles ?? [],
        rejectedFiles: result.rejectedFiles,
        totalFiles: result.totalFiles,
      });
      toast.success(
        `Batch queued: ${result.acceptedFiles} CVs processing${
          result.rejectedFiles ? `, ${result.rejectedFiles} skipped` : ""
        }.`
      );
      if (!result.rejectedFiles) {
        router.push(`/dashboard?batchId=${result.batchId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch upload failed");
    } finally {
      setBatchSubmitting(false);
    }
  }

  return (
    <>
      <Header
        title="Screening intake"
        description="Upload CV files and configure evaluation criteria"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Upload" }]}
      />

      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5">
          <section className="overflow-hidden rounded-lg border border-blue-100 bg-gradient-to-br from-white via-blue-50/80 to-emerald-50/70 shadow-sm">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-5 sm:p-6 lg:p-7">
                <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-800 shadow-xs">
                  <ShieldCheck className="h-4 w-4" />
                  Upload workspace
                </div>
                <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Start a screening workflow with the right file and role brief.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Choose a single candidate or batch ZIP, add the role context, then queue AI screening with criteria your team can review later.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-white/85 p-3 shadow-xs">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Role context
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Tell the screening engine what role to evaluate.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white/85 p-3 shadow-xs">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Sparkles className="h-4 w-4 text-blue-700" />
                      AI criteria
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Generate or write criteria before upload.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white/85 p-3 shadow-xs">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Upload className="h-4 w-4 text-slate-700" />
                      Queue tracking
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Follow screening status from dashboard.</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-blue-100 bg-white/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
                <p className="text-sm font-semibold text-slate-950">Pick the right intake flow</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Both paths use the same screening engine and appear in the dashboard queue.
                </p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-md border border-slate-200 bg-white p-3 shadow-xs">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <FileText className="h-4 w-4 text-blue-700" />
                      Single CV
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Best for one candidate with personal details.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3 shadow-xs">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Archive className="h-4 w-4 text-blue-700" />
                      Batch ZIP
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Best for many CVs using one shared role brief.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Tabs defaultValue="single" className="gap-5">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-3 bg-transparent p-0 text-slate-600 shadow-none sm:grid-cols-2 lg:w-[760px]">
              <TabsTrigger
                value="single"
                className="h-auto justify-start rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40 data-[state=active]:border-blue-300 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Single CV</span>
                  <span className="mt-1 block text-xs font-normal text-slate-500">One candidate, one file, full profile context</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="batch"
                className="h-auto justify-start rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40 data-[state=active]:border-blue-300 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Archive className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Batch ZIP</span>
                  <span className="mt-1 block text-xs font-normal text-slate-500">Many CVs sharing one role brief</span>
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="min-w-0">
              <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="min-w-0 gap-0 rounded-lg border-slate-200 bg-white shadow-sm">
                  <CardHeader className="border-b border-slate-100 pb-5">
                    <CardTitle className="text-lg text-slate-950">Single candidate screening</CardTitle>
                    <CardDescription>
                      Use this flow when each CV has unique candidate information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <form onSubmit={handleSubmit(onSubmit)}>
                      <FormSection
                        icon={UserRound}
                        title="Candidate details"
                        description="Identify the person attached to this CV. Email is optional but useful for follow-up."
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="name">
                              Candidate Name <RequiredMark />
                            </Label>
                            <Input id="name" placeholder="Enter candidate name" {...register("name")} />
                            <FieldError message={errors.name?.message} />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">Email (optional)</Label>
                            <Input id="email" type="email" placeholder="candidate@example.com" {...register("email")} />
                            <FieldError message={errors.email?.message} />
                          </div>
                        </div>
                      </FormSection>

                      <FormSection
                        icon={Sparkles}
                        title="Screening brief"
                        description="Define the role and the exact criteria the AI should use during evaluation."
                      >
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="position-picker-single">
                              Job Position <RequiredMark />
                            </Label>
                            <Select
                              value={selectedPositionId}
                              onValueChange={(value) => selectPosition("single", value)}
                            >
                              <SelectTrigger id="position-picker-single" className="w-full">
                                <SelectValue placeholder="Select a job position" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={CUSTOM_POSITION}>
                                  <FileText className="h-4 w-4" />
                                  Custom (one-off role)
                                </SelectItem>
                                {!positionsLoading && positions.length > 0 && (
                                  <>
                                    {positions.map((position) => (
                                      <SelectItem key={position.id} value={position.id}>
                                        <Briefcase className="h-4 w-4" />
                                        {position.title}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                <SelectItem value={CREATE_POSITION}>
                                  <PlusCircle className="h-4 w-4" />
                                  Create new position...
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                              Reuse a saved position to skip retyping criteria, or choose custom for a one-off role.
                            </p>
                          </div>

                          {selectedPositionId === CUSTOM_POSITION && (
                            <div className="space-y-2">
                              <Label htmlFor="posisi">
                                Position title <RequiredMark />
                              </Label>
                              <Input
                                id="posisi"
                                placeholder="e.g. Senior Backend Developer"
                                {...register("posisi", {
                                  onChange: (event) => setPosisiValue(event.target.value),
                                })}
                              />
                              <FieldError message={errors.posisi?.message} />
                            </div>
                          )}

                          <AiSetupPanel
                            mode="single"
                            disabled={!posisiValue.trim()}
                            generating={generating}
                            onGenerate={() => generatePrompt("single")}
                          />

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="kriteria">
                                Evaluation Criteria <RequiredMark />
                              </Label>
                              <Textarea
                                id="kriteria"
                                placeholder="e.g. Minimum 3 years of Python experience"
                                rows={5}
                                {...register("kriteria")}
                              />
                              <FieldError message={errors.kriteria?.message} />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="prompt">
                                AI Prompt <RequiredMark />
                              </Label>
                              <Textarea
                                id="prompt"
                                placeholder="e.g. Evaluate this CV against the criteria above"
                                rows={5}
                                {...register("prompt")}
                              />
                              <FieldError message={errors.prompt?.message} />
                            </div>
                          </div>

                          {selectedPositionId !== CUSTOM_POSITION && selectedPositionId !== CREATE_POSITION && (
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={savingToPosition}
                                onClick={() => saveToPosition("single")}
                              >
                                {savingToPosition ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save to position
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormSection>

                      <FormSection
                        icon={Upload}
                        title="Source CV"
                        description="Attach the candidate document. Screening starts after upload succeeds."
                      >
                        <FileDropzone file={file} onFileChange={setFile} />
                      </FormSection>

                      <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <p className="text-sm text-slate-500">
                          The candidate will appear on the dashboard once queued.
                        </p>
                        <Button
                          type="submit"
                          className="bg-blue-700 text-white hover:bg-blue-800 sm:min-w-40"
                          disabled={submitting || !file}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              Upload & Screen
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <WorkflowPanel mode="single" />
              </div>
            </TabsContent>

            <TabsContent value="batch" className="min-w-0">
              <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="min-w-0 gap-0 rounded-lg border-slate-200 bg-white shadow-sm">
                  <CardHeader className="border-b border-slate-100 pb-5">
                    <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                      <FileArchive className="h-5 w-5 text-blue-700" />
                      Batch ZIP screening
                    </CardTitle>
                    <CardDescription>
                      Use this flow when many CVs share one role and one evaluation brief.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <form onSubmit={handleBatchSubmit(onBatchSubmit)}>
                      <FormSection
                        icon={Users}
                        title="Batch role"
                        description="All CVs in this ZIP will use the same role and screening criteria."
                      >
                        <div className="space-y-2">
                          <Label htmlFor="position-picker-batch">
                            Job Position <RequiredMark />
                          </Label>
                          <Select
                            value={batchSelectedPositionId}
                            onValueChange={(value) => selectPosition("batch", value)}
                          >
                            <SelectTrigger id="position-picker-batch" className="w-full">
                              <SelectValue placeholder="Select a job position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={CUSTOM_POSITION}>
                                <FileText className="h-4 w-4" />
                                Custom (one-off role)
                              </SelectItem>
                              {!positionsLoading && positions.length > 0 && (
                                <>
                                  {positions.map((position) => (
                                    <SelectItem key={position.id} value={position.id}>
                                      <Briefcase className="h-4 w-4" />
                                      {position.title}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                              <SelectItem value={CREATE_POSITION}>
                                <PlusCircle className="h-4 w-4" />
                                Create new position...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500">
                            Reuse a saved position to skip retyping criteria, or choose custom for a one-off role.
                          </p>
                        </div>

                        {batchSelectedPositionId === CUSTOM_POSITION && (
                          <div className="space-y-2">
                            <Label htmlFor="batch-posisi">
                              Position title <RequiredMark />
                            </Label>
                            <Input
                              id="batch-posisi"
                              placeholder="e.g. Senior Backend Developer"
                              {...registerBatch("posisi", {
                                onChange: (event) => setBatchPosisiValue(event.target.value),
                              })}
                            />
                            <FieldError message={batchErrors.posisi?.message} />
                          </div>
                        )}
                      </FormSection>

                      <FormSection
                        icon={Sparkles}
                        title="Shared screening brief"
                        description="Generate or write one consistent prompt for every CV in the batch."
                      >
                        <div className="space-y-4">
                          <AiSetupPanel
                            mode="batch"
                            disabled={!batchPosisiValue.trim()}
                            generating={batchGenerating}
                            onGenerate={() => generatePrompt("batch")}
                          />

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="batch-kriteria">
                                Evaluation Criteria <RequiredMark />
                              </Label>
                              <Textarea
                                id="batch-kriteria"
                                placeholder="e.g. Minimum 3 years of Python experience"
                                rows={5}
                                {...registerBatch("kriteria")}
                              />
                              <FieldError message={batchErrors.kriteria?.message} />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="batch-prompt">
                                AI Prompt <RequiredMark />
                              </Label>
                              <Textarea
                                id="batch-prompt"
                                placeholder="e.g. Evaluate every CV against the criteria above"
                                rows={5}
                                {...registerBatch("prompt")}
                              />
                              <FieldError message={batchErrors.prompt?.message} />
                            </div>
                          </div>

                          {batchSelectedPositionId !== CUSTOM_POSITION && batchSelectedPositionId !== CREATE_POSITION && (
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={batchSavingToPosition}
                                onClick={() => saveToPosition("batch")}
                              >
                                {batchSavingToPosition ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save to position
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormSection>

                      <FormSection
                        icon={Archive}
                        title="ZIP file"
                        description="Upload one ZIP. Invalid files will be listed here so the archive can be fixed."
                      >
                        <FileDropzone
                          accept={ZIP_ACCEPT}
                          description="ZIP - max 50MB, up to 50 valid CVs"
                          file={batchFile}
                          invalidTypeMessage="Invalid file type. Only ZIP files are accepted."
                          label="Drag & drop your ZIP here"
                          maxSize={MAX_ZIP_SIZE}
                          onFileChange={setBatchFile}
                          tooLargeMessage="ZIP is too large. Maximum size is 50MB."
                        />

                        {batchSummary && (
                          <BatchSummaryCard
                            summary={batchSummary}
                            onViewBatch={() => router.push(`/dashboard?batchId=${batchSummary.batchId}`)}
                          />
                        )}
                      </FormSection>

                      <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <p className="text-sm text-slate-500">
                          Accepted CVs will be queued immediately after upload.
                        </p>
                        <Button
                          type="submit"
                          className="bg-blue-700 text-white hover:bg-blue-800 sm:min-w-44"
                          disabled={batchSubmitting || !batchFile}
                        >
                          {batchSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading batch...
                            </>
                          ) : (
                            <>
                              Upload ZIP & Screen
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <WorkflowPanel mode="batch" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <PositionFormDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            if (createDialogTarget === "single" && selectedPositionId === CREATE_POSITION) {
              setSelectedPositionId(CUSTOM_POSITION);
            }
            if (createDialogTarget === "batch" && batchSelectedPositionId === CREATE_POSITION) {
              setBatchSelectedPositionId(CUSTOM_POSITION);
            }
          }
        }}
        onSaved={handlePositionCreated}
      />
    </>
  );
}