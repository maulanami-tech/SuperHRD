"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Loader2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

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

const ZIP_ACCEPT = {
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

const MAX_ZIP_SIZE = 50 * 1024 * 1024;

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
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
    formState: { errors: batchErrors },
  } = useForm<BatchUploadInput>({
    resolver: zodResolver(batchUploadSchema),
    defaultValues: {
      posisi: "",
      kriteria: "",
      prompt: "",
    },
  });

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
        title="Upload CV"
        description="Submit a candidate CV for AI screening"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Upload CV" }]}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-3xl">
          <Tabs defaultValue="single" className="gap-4">
            <TabsList className="grid w-full grid-cols-2 sm:w-[360px]">
              <TabsTrigger value="single">Single CV</TabsTrigger>
              <TabsTrigger value="batch">Batch ZIP</TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <Card>
                <CardHeader>
                  <CardTitle>Candidate Information</CardTitle>
                  <CardDescription>
                    Fill in the details and upload the candidate&apos;s CV
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Candidate Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter candidate name"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="candidate@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="posisi">
                  Position <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="posisi"
                  placeholder="e.g. Senior Backend Developer"
                  {...register("posisi")}
                />
                {errors.posisi && (
                  <p className="text-sm text-destructive">{errors.posisi.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="kriteria">
                  Evaluation Criteria <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="kriteria"
                  placeholder="e.g. Minimum 3 years of Python experience"
                  rows={3}
                  {...register("kriteria")}
                />
                {errors.kriteria && (
                  <p className="text-sm text-destructive">{errors.kriteria.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">
                  AI Prompt <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g. Evaluate this CV against the criteria above"
                  rows={3}
                  {...register("prompt")}
                />
                {errors.prompt && (
                  <p className="text-sm text-destructive">{errors.prompt.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>CV File</Label>
                <FileDropzone file={file} onFileChange={setFile} />
              </div>

              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={submitting || !file}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload & Screen"
                )}
              </Button>
            </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="batch">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Archive className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Batch ZIP Screening</CardTitle>
                      <CardDescription>
                        Upload many CVs for one role and review skipped files
                        before fixing the ZIP.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleBatchSubmit(onBatchSubmit)}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="batch-posisi">
                        Position <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="batch-posisi"
                        placeholder="e.g. Senior Backend Developer"
                        {...registerBatch("posisi")}
                      />
                      {batchErrors.posisi && (
                        <p className="text-sm text-destructive">
                          {batchErrors.posisi.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="batch-kriteria">
                        Evaluation Criteria{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="batch-kriteria"
                        placeholder="e.g. Minimum 3 years of Python experience"
                        rows={3}
                        {...registerBatch("kriteria")}
                      />
                      {batchErrors.kriteria && (
                        <p className="text-sm text-destructive">
                          {batchErrors.kriteria.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="batch-prompt">
                        AI Prompt <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="batch-prompt"
                        placeholder="e.g. Evaluate every CV against the criteria above"
                        rows={3}
                        {...registerBatch("prompt")}
                      />
                      {batchErrors.prompt && (
                        <p className="text-sm text-destructive">
                          {batchErrors.prompt.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>ZIP File</Label>
                      <FileDropzone
                        accept={ZIP_ACCEPT}
                        description="ZIP — max 50MB, up to 50 valid CVs"
                        file={batchFile}
                        invalidTypeMessage="Invalid file type. Only ZIP files are accepted."
                        label="Drag & drop your ZIP here"
                        maxSize={MAX_ZIP_SIZE}
                        onFileChange={setBatchFile}
                        tooLargeMessage="ZIP is too large. Maximum size is 50MB."
                      />
                    </div>

                    {batchSummary && (
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <p className="text-muted-foreground">Accepted</p>
                            <p className="text-xl font-semibold">
                              {batchSummary.acceptedFiles}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Skipped</p>
                            <p className="text-xl font-semibold">
                              {batchSummary.rejectedFiles}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <p className="text-xl font-semibold">
                              {batchSummary.totalFiles ?? "-"}
                            </p>
                          </div>
                        </div>

                        {batchSummary.invalidFiles.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium">
                              Files to fix
                            </p>
                            <div className="max-h-44 overflow-auto rounded-lg border bg-background">
                              {batchSummary.invalidFiles.map((item, index) => (
                                <div
                                  key={`${item.fileName}-${index}`}
                                  className="grid gap-1 border-b px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[1fr_1.2fr]"
                                >
                                  <span className="truncate font-medium">
                                    {item.fileName}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {item.reason}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {batchSummary.batchId && (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-4"
                            onClick={() =>
                              router.push(`/dashboard?batchId=${batchSummary.batchId}`)
                            }
                          >
                            View batch on dashboard
                          </Button>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full sm:w-auto"
                      disabled={batchSubmitting || !batchFile}
                    >
                      {batchSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading batch...
                        </>
                      ) : (
                        "Upload ZIP & Screen"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
