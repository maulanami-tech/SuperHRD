import { z } from 'zod';

// Valid bundle amounts for credit top-ups
const VALID_BUNDLE_AMOUNTS = [10000, 50000, 150000, 500000] as const;

export const topupRequestSchema = z.object({
  amountIdr: z.number().refine(
    (val) => VALID_BUNDLE_AMOUNTS.includes(val as typeof VALID_BUNDLE_AMOUNTS[number]),
    { message: `Amount must be one of: ${VALID_BUNDLE_AMOUNTS.join(', ')}` }
  ),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  proofImageUrl: z.string().url('Must be a valid URL'),
});

export const adminTopupActionSchema = z.object({
  topupId: z.string().min(1, 'Topup ID is required'),
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().optional(),
});

// Export types
export type TopupRequestInput = z.infer<typeof topupRequestSchema>;
export type AdminTopupActionInput = z.infer<typeof adminTopupActionSchema>;
