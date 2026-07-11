import { z } from "zod";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/messages";

function tv(locale: Locale, key: Parameters<typeof translate>[1]) {
  return translate(locale, key);
}

export function createLoginSchema(locale: Locale = defaultLocale) {
  return z.object({
    email: z.email(),
    password: z.string().min(1, tv(locale, "validation.passwordRequired")),
  });
}

export function createRegisterSchema(locale: Locale = defaultLocale) {
  return z.object({
    name: z.string().min(1, tv(locale, "validation.nameRequired")).max(100, tv(locale, "validation.nameTooLong")),
    email: z.email(),
    password: z.string().min(6, tv(locale, "validation.passwordMin")),
    confirmPassword: z.string().min(1, tv(locale, "validation.confirmPassword")),
    promoCode: z.string()
      .trim()
      .max(32, tv(locale, "validation.promoCodeFormat"))
      .regex(/^[A-Za-z0-9_-]*$/, tv(locale, "validation.promoCodeFormat"))
      .optional()
      .or(z.literal("")),
  }).refine((data) => data.password === data.confirmPassword, {
    message: tv(locale, "validation.passwordsMismatch"),
    path: ["confirmPassword"],
  });
}

export function createPromoCodeSchema(locale: Locale = defaultLocale) {
  return z.object({
    code: z.string()
      .trim()
      .min(3, tv(locale, "validation.promoCodeFormat"))
      .max(32, tv(locale, "validation.promoCodeFormat"))
      .regex(/^[A-Za-z0-9_-]+$/, tv(locale, "validation.promoCodeFormat")),
    creditAmount: z.number().int().min(1).max(100000),
    maxRedemptions: z.number().int().min(1).max(1000000).nullable().optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
  });
}

export function createForgotPasswordSchema(locale: Locale = defaultLocale) {
  return z.object({
    email: z.email(tv(locale, "validation.validEmail")),
  });
}

export function createResetPasswordSchema(locale: Locale = defaultLocale) {
  return z.object({
    password: z.string().min(6, tv(locale, "validation.passwordMin")),
    confirmPassword: z.string().min(1, tv(locale, "validation.confirmPassword")),
  }).refine((data) => data.password === data.confirmPassword, {
    message: tv(locale, "validation.passwordsMismatch"),
    path: ["confirmPassword"],
  });
}

export function createChangePasswordSchema(locale: Locale = defaultLocale) {
  return z.object({
    currentPassword: z.string().min(1, tv(locale, "validation.currentPasswordRequired")),
    newPassword: z.string().min(6, tv(locale, "validation.passwordMin")),
    confirmPassword: z.string().min(1, tv(locale, "validation.confirmPassword")),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: tv(locale, "validation.passwordsMismatch"),
    path: ["confirmPassword"],
  }).refine((data) => data.newPassword !== data.currentPassword, {
    message: tv(locale, "validation.newPasswordSameAsOld"),
    path: ["newPassword"],
  });
}

export function createUploadSchema(locale: Locale = defaultLocale) {
  return z.object({
    name: z.string().min(1, tv(locale, "validation.candidateNameRequired")).max(200, tv(locale, "validation.nameTooLong")),
    email: z.email().optional(),
    posisi: z.string().min(1, tv(locale, "validation.positionRequired")).max(200, tv(locale, "validation.positionTooLong")),
    kriteria: z.string().min(1, tv(locale, "validation.criteriaRequired")).max(5000, tv(locale, "validation.criteriaTooLong")),
    prompt: z.string().min(1, tv(locale, "validation.promptRequired")).max(5000, tv(locale, "validation.promptTooLong")),
  });
}

export function createBatchUploadSchema(locale: Locale = defaultLocale) {
  return createUploadSchema(locale).pick({
    posisi: true,
    kriteria: true,
    prompt: true,
  });
}

export function createFileSchema(locale: Locale = defaultLocale) {
  return z.object({
    type: z.string().refine(
      (t) => [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(t),
      { message: tv(locale, "validation.fileType") }
    ),
    size: z.number().max(10 * 1024 * 1024, tv(locale, "validation.fileSize")),
  });
}

export const loginSchema = createLoginSchema();
export const registerSchema = createRegisterSchema();
export const forgotPasswordSchema = createForgotPasswordSchema();
export const promoCodeSchema = createPromoCodeSchema();
export const resetPasswordSchema = createResetPasswordSchema();
export const changePasswordSchema = createChangePasswordSchema();
export const uploadSchema = createUploadSchema();
export const batchUploadSchema = createBatchUploadSchema();
export const fileSchema = createFileSchema();

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

export function createJobPositionSchema(locale: Locale = defaultLocale) {
  return z.object({
    title: z.string().min(1, tv(locale, "validation.positionRequired")).max(200, tv(locale, "validation.positionTooLong")),
    description: z.string().max(2000, tv(locale, "validation.descriptionTooLong")).optional().or(z.literal("")),
    kriteria: z.string().min(1, tv(locale, "validation.criteriaRequired")).max(5000, tv(locale, "validation.criteriaTooLong")),
    prompt: z.string().min(1, tv(locale, "validation.promptRequired")).max(5000, tv(locale, "validation.promptTooLong")),
  });
}

export function createJobPositionUpdateSchema(locale: Locale = defaultLocale) {
  return createJobPositionSchema(locale).partial().extend({
    status: z.enum(["open", "closed", "archived"]).optional(),
  });
}

export const jobPositionSchema = createJobPositionSchema();
export const jobPositionUpdateSchema = createJobPositionUpdateSchema();

export const stageColorEnum = z.enum([
  "slate",
  "blue",
  "indigo",
  "violet",
  "pink",
  "amber",
  "emerald",
  "red",
]);

export const pipelineStageSchema = z.object({
  name: z.string().min(1, "Stage name is required").max(100, "Stage name is too long"),
  color: stageColorEnum.default("slate"),
});

export const pipelineStageUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: stageColorEnum.optional(),
  order: z.number().int().min(0).optional(),
});

export const fieldTypeEnum = z.enum(["number", "currency", "text", "date"]);

export const candidateFieldDefinitionSchema = z.object({
  label: z.string().min(1, "Field label is required").max(100, "Field label is too long"),
  type: fieldTypeEnum,
});

export const candidateFieldDefinitionUpdateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
});

export const candidatePatchSchema = z.object({
  pipelineStageId: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).optional(),
  fieldValues: z
    .array(
      z.object({
        fieldDefinitionId: z.string().min(1),
        value: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .optional(),
}).refine(
  (data) => data.pipelineStageId !== undefined || data.notes !== undefined || data.fieldValues !== undefined,
  { message: "At least one field must be provided" }
);

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type PromoCodeInput = z.infer<typeof promoCodeSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type BatchUploadInput = z.infer<typeof batchUploadSchema>;
export type N8nCallbackInput = z.infer<typeof n8nCallbackSchema>;
export type JobPositionInput = z.infer<typeof jobPositionSchema>;
export type JobPositionUpdateInput = z.infer<typeof jobPositionUpdateSchema>;
export type PipelineStageInput = z.infer<typeof pipelineStageSchema>;
export type PipelineStageUpdateInput = z.infer<typeof pipelineStageUpdateSchema>;
export type CandidateFieldDefinitionInput = z.infer<typeof candidateFieldDefinitionSchema>;
export type CandidateFieldDefinitionUpdateInput = z.infer<typeof candidateFieldDefinitionUpdateSchema>;
export type CandidatePatchInput = z.infer<typeof candidatePatchSchema>;