"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/msword": [".doc"],
};

const MAX_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({ file, onFileChange, error }: FileDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) {
        onFileChange(accepted[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0];
      onFileChange(null);
      switch (err?.code) {
        case "file-invalid-type":
          toast.error(
            "Invalid file type. Only PDF, DOCX, and DOC files are accepted."
          );
          break;
        case "file-too-large":
          toast.error("File is too large. Maximum size is 10MB.");
          break;
        default:
          toast.error("File was rejected. Please try another file.");
      }
    },
  });

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onFileChange(null)}
          type="button"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove file</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50 hover:bg-muted/50",
        isDragActive && "border-primary bg-primary/5",
        error && "border-destructive"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Upload className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium">
        {isDragActive ? "Drop the file here" : "Drag & drop your CV here"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        PDF, DOCX, DOC — max 10MB
      </p>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
