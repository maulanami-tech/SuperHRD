import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  email: z.email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const uploadSchema = z.object({
  name: z.string().min(1, "Candidate name is required").max(200, "Name is too long"),
  email: z.email().optional(),
  posisi: z.string().min(1, "Position is required").max(200, "Position is too long"),
  kriteria: z.string().min(1, "Evaluation criteria is required").max(5000, "Criteria is too long"),
  prompt: z.string().min(1, "Prompt is required").max(5000, "Prompt is too long"),
});

export const batchUploadSchema = uploadSchema.pick({
  posisi: true,
  kriteria: true,
  prompt: true,
});

export const fileSchema = z.object({
  type: z.string().refine(
    (t) => [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(t),
    { message: "Only PDF, DOC, and DOCX files are allowed" }
  ),
  size: z.number().max(10 * 1024 * 1024, "File size must be under 10MB"),
});

export const n8nCallbackSchema = z.object({
  runId: z.string().min(1),
  candidateId: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
  status: z.enum(["completed", "error"]).optional(),
  overallScore: z.number().min(0).max(100).optional(),
  summary: z.string().max(5000).optional(),
  criteria: z.array(
    z.object({
      name: z.string().max(200),
      score: z.number().min(0).max(100),
      notes: z.string().max(2000),
    })
  ).max(20).optional(),
  rawResponse: z.string().max(50000).optional(),
  error: z.string().max(5000).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type BatchUploadInput = z.infer<typeof batchUploadSchema>;
export type N8nCallbackInput = z.infer<typeof n8nCallbackSchema>;
