"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadSchema, type UploadInput } from "@/lib/validations";
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
import { Textarea } from "@/components/ui/textarea";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <>
      <Header title="Upload CV" description="Submit a candidate CV for AI screening" />

      <main className="flex-1 p-4 md:p-6">
        <Card className="mx-auto max-w-2xl">
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
                  placeholder="e.g. Pengalaman minimal 3 tahun di Python"
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
                  placeholder="e.g. Tolong evaluasi CV yang diupload"
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
      </main>
    </>
  );
}
