import { z } from 'zod';

// Valid bundle amounts for credit top-ups
const VALID_BUNDLE_AMOUNTS = [10000, 50000, 150000, 500000] as const;

export const topupRequestSchema = z.object({
  amountIdr: z.number().refine(
    (val) => VALID_BUNDLE_AMOUNTS.includes(val as typeof VALID_BUNDLE_AMOUNTS[number]),
    { message: `Amount must be one of: ${VALID_BUNDLE_AMOUNTS.join(', ')}` }
  ),
  paymentMethod: z.enum(['qris', 'stripe']),
  proofImageUrl: z.string().url().optional(),
});

export const adminTopupActionSchema = z.object({
  topupId: z.string().cuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(500).optional(),
});

// Export types
export type TopupRequestInput = z.infer<typeof topupRequestSchema>;
export type AdminTopupActionInput = z.infer<typeof adminTopupActionSchema>;
