import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export const uploadSchema = z.object({
  name: z.string().min(1, "Candidate name is required"),
  email: z.email().optional(),
});

export const fileSchema = z.object({
  type: z.string().refine(
    (t) =>
      t === "application/pdf" ||
      t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    { message: "Only PDF and DOCX files are allowed" }
  ),
  size: z.number().max(10 * 1024 * 1024, "File size must be under 10MB"),
});

export const n8nCallbackSchema = z.object({
  runId: z.string().min(1),
  overallScore: z.number(),
  summary: z.string(),
  criteria: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      notes: z.string(),
    })
  ),
  rawResponse: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type N8nCallbackInput = z.infer<typeof n8nCallbackSchema>;
