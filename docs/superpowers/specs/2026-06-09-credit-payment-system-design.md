# Credit & Payment System Design

**Date:** 2026-06-09  
**Project:** SuperHRD - AI-Powered CV Screening  
**Feature:** Credit-based payment system with QRIS manual & Stripe auto top-up

## Overview

Add a credit-based payment system to SuperHRD where users consume credits for CV screening. Users get 5 free screenings per day (reset at 00:00 WIB), then pay 500 IDR per screening via credit top-up. Two payment methods: QRIS (manual approval, min 10k) and Stripe (auto, min 50k, initially disabled).

## Business Requirements

### Pricing Model
- **Per-screening cost:** 500 IDR
- **Daily free quota:** 5 screenings per user (resets 00:00 WIB)
- **Credit priority:** Free quota used first, then paid credits

### Bundle Pricing
| Package | Price (IDR) | Base Credit | Bonus | Total Credits | Effective Price |
|---------|-------------|-------------|-------|---------------|-----------------|
| Starter (QRIS only) | 10,000 | 20 | 0% | 20 | 500/screening |
| Basic | 50,000 | 100 | +10% | 110 | 454/screening |
| Pro | 150,000 | 300 | +17% | 350 | 428/screening |
| Enterprise | 500,000 | 1,000 | +25% | 1,250 | 400/screening |

**Note:** Only these 4 bundles are available. Validation must reject any other amounts.

### Payment Methods

**QRIS (Manual Approval):**
- Static QRIS from existing GoPay merchant
- User uploads payment proof screenshot
- Admin approves/rejects via dashboard
- Admin receives Email + Telegram notification
- Minimum top-up: 10,000 IDR
- Requests expire after 24 hours if not approved

**Stripe (Auto, Initially Disabled):**
- Automatic credit on successful payment
- Webhook-based verification
- Minimum top-up: 50,000 IDR
- Feature flag: `STRIPE_ENABLED=false` initially
- International card support ready

## Database Schema

### Extended User Model
```prisma
model User {
  id             String         @id @default(cuid())
  name           String
  email          String         @unique
  passwordHash   String
  creditBalance  Int            @default(0)        // Number of screening credits (not IDR)
  dailyQuotaUsed Int            @default(0)
  lastQuotaDate  String         @default("")       // "yyyy-MM-dd" in Asia/Jakarta timezone
  isAdmin        Boolean        @default(false)
  createdAt      DateTime       @default(now())
  candidates     Candidate[]
  transactions   Transaction[]
  topupRequests  TopupRequest[]
}
```

### Transaction Model
```prisma
enum TransactionType {
  topup_qris
  topup_stripe
  deduct_screening
  admin_adjustment
  daily_quota
  refund
}

model Transaction {
  id           String          @id @default(cuid())
  userId       String
  user         User            @relation(fields: [userId], references: [id])
  type         TransactionType
  creditDelta  Int             // +110 for topup, -1 for screening, 0 for free quota
  balanceAfter Int             // Credit balance after transaction
  amountIdr    Int?            // IDR amount for topups (null for deductions)
  description  String
  metadata     String?         // JSON: { candidateId?, topupRequestId?, stripeSessionId? }
  createdAt    DateTime        @default(now())
  
  @@index([userId, createdAt])
}
```

### TopupRequest Model
```prisma
enum PaymentMethod {
  qris
  stripe
}

enum TopupStatus {
  pending
  approved
  rejected
  expired
}

model TopupRequest {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  amountIdr     Int           // Amount in IDR
  creditAmount  Int           // Credits to be awarded (includes bonus)
  paymentMethod PaymentMethod
  status        TopupStatus   @default(pending)
  proofImageUrl String?       // For QRIS: uploaded proof URL
  notes         String?       // Admin rejection reason
  approvedBy    String?       // Admin user ID
  approvedAt    DateTime?
  expiresAt     DateTime      // 24h from creation
  createdAt     DateTime      @default(now())
  
  @@index([userId, status])
  @@index([status, createdAt])
}
```

### PricingConfig Model
```prisma
model PricingConfig {
  id        String   @id @default(cuid())
  key       String   @unique // "screening_price", "daily_free_quota", "qris_min_topup", "stripe_min_topup"
  value     String   // JSON string for flexibility
  updatedAt DateTime @updatedAt
}
```

## Credit System Logic

### Daily Quota Reset
- **Cron job:** Runs at 00:00 WIB (17:00 UTC previous day)
- **Action:** Set all users `dailyQuotaUsed = 0`, `lastQuotaDate = current date in Asia/Jakarta`
- **Fallback:** On each screening, compare `lastQuotaDate` with current date in WIB timezone. If different, reset quota.

**Implementation Note:** Use `Intl.DateTimeFormat` or date-fns with `Asia/Jakarta` timezone to get current date as "yyyy-MM-dd" string. Comparing date strings is safer than DateTime objects for quota reset logic.

### Credit Check & Deduction Flow (Atomic)

```typescript
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

function getCurrentDateWIB(): string {
  const now = new Date();
  const wibDate = utcToZonedTime(now, 'Asia/Jakarta');
  return format(wibDate, 'yyyy-MM-dd');
}

async function canUserScreen(userId: string): Promise<{ canScreen: boolean; source?: 'free_quota' | 'paid_credit'; reason?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { canScreen: false, reason: 'User not found' };
  
  const todayWIB = getCurrentDateWIB();
  
  // Check if quota needs reset
  if (user.lastQuotaDate !== todayWIB) {
    // Quota needs reset, will be handled in deduction
    if (0 < 5) return { canScreen: true, source: 'free_quota' };
  } else {
    // Check current day quota
    if (user.dailyQuotaUsed < 5) return { canScreen: true, source: 'free_quota' };
  }
  
  // Check paid credit
  if (user.creditBalance >= 1) return { canScreen: true, source: 'paid_credit' };
  
  return { canScreen: false, reason: 'Insufficient credit' };
}

async function deductCredit(userId: string, candidateId: string): Promise<{ success: boolean; source: 'free_quota' | 'paid_credit'; newBalance: number; quotaRemaining?: number }> {
  const todayWIB = getCurrentDateWIB();
  
  // Try to use free quota first (with atomic update)
  // Path 1: Reset quota if new day
  const quotaResetResult = await prisma.user.updateMany({
    where: {
      id: userId,
      lastQuotaDate: { not: todayWIB } // New day detected
    },
    data: {
      dailyQuotaUsed: 1, // Reset to 1 (not increment from yesterday)
      lastQuotaDate: todayWIB
    }
  });
  
  if (quotaResetResult.count > 0) {
    // Quota reset and used successfully
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    await prisma.transaction.create({
      data: {
        userId,
        type: 'daily_quota',
        creditDelta: 0,
        balanceAfter: user.creditBalance,
        amountIdr: null,
        description: `Free daily quota (1/5)`,
        metadata: JSON.stringify({ candidateId })
      }
    });
    
    return {
      success: true,
      source: 'free_quota',
      newBalance: user.creditBalance,
      quotaRemaining: 4
    };
  }
  
  // Path 2: Use existing quota (same day)
  const quotaUseResult = await prisma.user.updateMany({
    where: {
      id: userId,
      lastQuotaDate: todayWIB,
      dailyQuotaUsed: { lt: 5 }
    },
    data: {
      dailyQuotaUsed: { increment: 1 }
    }
  });
  
  if (quotaUseResult.count > 0) {
    // Existing quota used successfully
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    await prisma.transaction.create({
      data: {
        userId,
        type: 'daily_quota',
        creditDelta: 0,
        balanceAfter: user.creditBalance,
        amountIdr: null,
        description: `Free daily quota (${user.dailyQuotaUsed}/5)`,
        metadata: JSON.stringify({ candidateId })
      }
    });
    
    return {
      success: true,
      source: 'free_quota',
      newBalance: user.creditBalance,
      quotaRemaining: 5 - user.dailyQuotaUsed
    };
  }
  
  // Try to deduct paid credit (with atomic update)
  const paidCreditResult = await prisma.user.updateMany({
    where: {
      id: userId,
      creditBalance: { gte: 1 }
    },
    data: {
      creditBalance: { decrement: 1 }
    }
  });
  
  if (paidCreditResult.count === 0) {
    throw new Error('Insufficient credit');
  }
  
  // Paid credit used successfully
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  await prisma.transaction.create({
    data: {
      userId,
      type: 'deduct_screening',
      creditDelta: -1,
      balanceAfter: user.creditBalance,
      amountIdr: null,
      description: 'CV screening',
      metadata: JSON.stringify({ candidateId })
    }
  });
  
  return {
    success: true,
    source: 'paid_credit',
    newBalance: user.creditBalance
  };
}
```

**Key Points:**
- `creditBalance` is number of screening credits (Integer), not IDR
- 1 screening = 1 credit
- Free quota checked first with atomic `updateMany` conditional update
- Paid credit deducted atomically to prevent race conditions
- Date comparison uses WIB timezone string format "yyyy-MM-dd"

## QRIS Payment Flow

### User Flow
1. Navigate to `/dashboard/topup`
2. Select bundle: **Only 10k, 50k, 150k, or 500k** (hardcoded, no custom amounts)
3. Click "Top Up via QRIS"
4. See QRIS instructions page:
   - Display static QRIS image
   - Instructions: Scan → Pay exact amount → Screenshot → Upload
5. Upload payment proof (JPG/PNG, max 5MB)
6. Submit → Create `TopupRequest` (status: pending, expiresAt: now + 24h)
7. Show confirmation: "Payment being verified, you'll receive email notification in 1-24 hours"

### Admin Notification
**Telegram Alert:**
```
🔔 New Top-Up Request

User: John Doe (john@example.com)
Amount: Rp 50,000
Time: 09 Jun 2026, 20:33 WIB

[Review Now] → Link to /admin/topup-requests
```

**Email Alert:**
```
Subject: New Top-Up Request - Rp 50,000

User: John Doe (john@example.com)  
Amount: Rp 50,000  
Submitted: 09 Jun 2026, 20:33 WIB

View payment proof and approve:  
[Dashboard Link]
```

### Admin Approval Flow
1. Admin sees notification or checks `/admin/topup-requests`
2. Pending requests list shows:
   - User name, email, amount, timestamp
   - Screenshot thumbnail preview
   - Actions: View Details / Approve / Reject
3. Click "View Details":
   - Full-size screenshot
   - User info: current balance, transaction history
   - Approve button → Calculate credit with bonus → Add to balance → Send success email
   - Reject button → Modal for rejection reason → Send rejection email

### Credit Application on Approval (Idempotent & Atomic)

```typescript
async function approveTopup(requestId: string, adminUserId: string) {
  // Use transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    // Idempotent approval using conditional updateMany
    const approvalResult = await tx.topupRequest.updateMany({
      where: {
        id: requestId,
        status: 'pending' // Only approve if still pending
      },
      data: {
        status: 'approved',
        approvedBy: adminUserId,
        approvedAt: new Date()
      }
    });
    
    if (approvalResult.count === 0) {
      // Already processed
      const existing = await tx.topupRequest.findUnique({
        where: { id: requestId }
      });
      throw new Error(`Request already ${existing.status}`);
    }
    
    // Fetch approved request
    const request = await tx.topupRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });
    
    // Calculate credits (already includes bonus)
    const BUNDLES = [
      { amountIdr: 10000, credits: 20 },
      { amountIdr: 50000, credits: 110 },
      { amountIdr: 150000, credits: 350 },
      { amountIdr: 500000, credits: 1250 },
    ];
    const bundle = BUNDLES.find(b => b.amountIdr === request.amountIdr);
    if (!bundle) throw new Error('Invalid bundle amount');
    
    const creditToAdd = bundle.credits;
    
    // Increment user balance atomically
    const updatedUser = await tx.user.update({
      where: { id: request.userId },
      data: {
        creditBalance: { increment: creditToAdd }
      }
    });
    
    // Create transaction record
    await tx.transaction.create({
      data: {
        userId: request.userId,
        type: 'topup_qris',
        creditDelta: creditToAdd,
        balanceAfter: updatedUser.creditBalance,
        amountIdr: request.amountIdr,
        description: `QRIS top-up: Rp ${request.amountIdr.toLocaleString()} → ${creditToAdd} credits`,
        metadata: JSON.stringify({ topupRequestId: requestId })
      }
    });
    
    return { newBalance: updatedUser.creditBalance, creditToAdd };
  });
  
  // Send success email outside transaction
  // (email failure shouldn't rollback credit)
}
```

**Key Changes:**
- Wrapped in Prisma transaction for atomicity
- Status check prevents double approval
- creditBalance is Int (number of credits)
- amountIdr stored separately for audit
- creditDelta is credits added (+110), not IDR

## Stripe Integration (Prepared, Disabled)

### Setup
```typescript
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export const STRIPE_ENABLED = process.env.STRIPE_ENABLED === 'true';
```

### Checkout Session Creation
```typescript
// POST /api/stripe/create-checkout
async function createCheckout(userId: string, bundleAmount: number) {
  const bundle = BUNDLES.find(b => b.amount === bundleAmount);
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'idr',
        product_data: {
          name: `${bundle.credit} CV Screening Credits`,
          description: `Rp ${bundle.amount} (+${bundle.bonus}% bonus)`,
        },
        unit_amount: bundle.amount * 100, // Stripe amount uses smallest currency unit (verify IDR behavior before Phase 4)
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${APP_URL}/dashboard/topup/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/dashboard/topup`,
    customer_email: user.email,
    metadata: {
      userId,
      creditAmount: bundle.credit.toString(),
    }
  });
  
  return { url: session.url };
}
```

### Webhook Handler
```typescript
// POST /api/stripe/webhook
async function handleStripeWebhook(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();
  
  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, creditAmount } = session.metadata;
    
    // Idempotent credit addition using transaction
    await prisma.$transaction(async (tx) => {
      // Check if already processed
      const existing = await tx.transaction.findFirst({
        where: {
          metadata: { contains: session.id }
        }
      });
      
      if (existing) {
        console.log('Stripe session already processed:', session.id);
        return; // Already processed
      }
      
      // Increment user balance atomically
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: { increment: parseInt(creditAmount) }
        }
      });
      
      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: "topup_stripe",
          creditDelta: parseInt(creditAmount),
          balanceAfter: updatedUser.creditBalance,
          amountIdr: session.amount_total / 100, // Stripe uses cents
          description: `Stripe top-up: ${creditAmount} credits`,
          metadata: JSON.stringify({ stripeSessionId: session.id })
        }
      });
    });
    
    // Send success email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await sendEmail({
      to: user.email,
      subject: "Payment Successful!",
      html: `Your payment was successful. ${creditAmount} credits added to your account.`
    });
  }
}
```

## API Routes

### New Routes
```
POST   /api/topup/qris              - Create QRIS top-up request
GET    /api/topup/requests          - List user's top-up requests
GET    /api/credit/balance          - Get balance & daily quota
GET    /api/credit/transactions     - Get transaction history

POST   /api/admin/topup/:id/approve - Approve top-up request (admin only)
POST   /api/admin/topup/:id/reject  - Reject top-up request (admin only)
GET    /api/admin/topup-requests    - List all requests (admin only)

POST   /api/stripe/create-checkout  - Create Stripe checkout (disabled)
POST   /api/stripe/webhook          - Stripe webhook handler (disabled)
```

### Modified Routes
```typescript
// POST /api/upload - Deduct credit FIRST, refund if n8n fails
async function uploadHandler(req: Request) {
  const session = await auth();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  
  // Check if user can screen
  const check = await canUserScreen(user.id);
  if (!check.canScreen) {
    return NextResponse.json(
      { error: "Insufficient credit. Please top up your account." },
      { status: 402 }
    );
  }
  
  // ... existing file upload logic ...
  // ... create candidate record ...
  
  // Deduct credit BEFORE triggering n8n
  let deductionResult;
  try {
    deductionResult = await deductCredit(user.id, candidate.id);
  } catch (err) {
    // Credit deduction failed
    return NextResponse.json(
      { error: "Credit deduction failed. Please try again." },
      { status: 500 }
    );
  }
  
  // Trigger n8n webhook
  const n8nResult = await fetch(N8N_WEBHOOK_URL, { ... });
  
  if (!n8nResult.ok) {
    // N8N failed - refund the credit
    if (deductionResult.source === 'paid_credit') {
      const refundedUser = await prisma.user.update({
        where: { id: user.id },
        data: { creditBalance: { increment: 1 } }
      });
      
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'refund',
          creditDelta: 1,
          balanceAfter: refundedUser.creditBalance,
          amountIdr: null,
          description: 'Refund: screening service unavailable',
          metadata: JSON.stringify({ candidateId: candidate.id, reason: 'n8n_failed' })
        }
      });
    } else {
      // Was free quota - restore dailyQuotaUsed and record for audit
      const restoredUser = await prisma.user.update({
        where: { id: user.id },
        data: { dailyQuotaUsed: { decrement: 1 } }
      });
      
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'refund',
          creditDelta: 0,
          balanceAfter: restoredUser.creditBalance,
          amountIdr: null,
          description: 'Quota restored: screening service unavailable',
          metadata: JSON.stringify({ candidateId: candidate.id, reason: 'n8n_failed' })
        }
      });
    }
    
    return NextResponse.json(
      { error: "Screening service unavailable. Credit refunded." },
      { status: 503 }
    );
  }
  
  return NextResponse.json({ success: true, candidate });
}
```

**Charging Policy:**
- Credit is deducted BEFORE n8n call
- If n8n fails, credit is refunded immediately (paid credit) or quota is restored (free quota)
- This prevents unpaid screenings while ensuring users only pay for successful jobs
- Refund creates audit trail via transaction record

## UI Components & Pages

### New Pages

**`/dashboard/topup`** - Top-Up Page
- Credit balance card (show balance + daily quota: "3/5 free today")
- Payment tabs: "QRIS Manual" | "Stripe Auto" (grayed out with "Coming Soon")
- Bundle cards grid with pricing, bonus badge, "Most Popular" label
- QRIS flow: Static QR display → Upload form
- Recent transactions list (last 10)

**`/dashboard/credit-history`** - Full History
- Filterable table: All / Top-ups / Deductions
- Date range picker
- Export CSV button
- Pagination (20 per page)

**`/admin/topup-requests`** - Admin Dashboard
- Badge count: "3 Pending"
- Filter tabs: Pending / Approved / Rejected / Expired / All
- Table columns: User, Amount, Proof, Time, Status, Actions
- Click image thumbnail → Full-size modal
- Approve/Reject buttons with confirmation

### Modified Pages

**`/dashboard`** - Main Dashboard
- Top-right credit widget: "Balance: 50 credits | Free: 2/5 today"
- "Top Up" button next to balance
- Low credit banner: "Running low on credits! Top up now to continue screening."

**`/upload`** - CV Upload Page
- Before upload button: "This screening costs 1 credit (or uses 1 free daily quota if available)"
- If insufficient: Disable upload, show "Insufficient credit" + link to top-up page

### New Components

```typescript
// components/credit-balance-widget.tsx
- Compact display: Balance + quota + CTA

// components/bundle-card.tsx
- Pricing card with bonus badge, "Most Popular" label
- Shows: Price, credit amount, effective price per screening

// components/qris-upload-form.tsx
- File upload with image preview
- Max 5MB validation
- JPG/PNG only

// components/topup-request-card.tsx
- Admin view: User info, screenshot preview, approve/reject

// components/transaction-history-table.tsx
- Reusable transaction list with type icons and colors
```

## Background Jobs

### Daily Quota Reset
```typescript
// Runs at 00:00 WIB (17:00 UTC previous day)
// For Next.js: Only reliable on long-running Node server
// Fallback: on-demand reset in canUserScreen is REQUIRED
cron.schedule('0 17 * * *', async () => {
  const todayWIB = getCurrentDateWIB();
  await prisma.user.updateMany({
    data: {
      dailyQuotaUsed: 0,
      lastQuotaDate: todayWIB
    }
  });
  console.log('[CRON] Daily quota reset completed');
});
```

**Deployment Strategy:**
- **Serverless (Vercel):** Cron won't work. Rely 100% on on-demand reset in `canUserScreen`
- **Long-running Node:** Cron is optimization, fallback still required
- **Future:** Consider external cron service (Vercel Cron, GitHub Actions) to hit `/api/admin/reset-quotas` endpoint

### Expire Old QRIS Requests
```typescript
// Runs hourly
// For serverless: Handle on-read in admin list instead
cron.schedule('0 * * * *', async () => {
  const now = new Date();
  const result = await prisma.topupRequest.updateMany({
    where: {
      status: 'pending',
      paymentMethod: 'qris',
      expiresAt: { lt: now }
    },
    data: { status: 'expired' }
  });
  console.log(`[CRON] Expired ${result.count} QRIS requests`);
});
```

**Alternative for Serverless:**
```typescript
// In GET /api/admin/topup-requests
// Expire old pending requests on-read
await prisma.topupRequest.updateMany({
  where: {
    status: 'pending',
    expiresAt: { lt: new Date() }
  },
  data: { status: 'expired' }
});
```

## Notifications

### Telegram Setup
```typescript
// lib/notifications/telegram.ts
export async function sendTelegramAlert(message: string, url?: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        reply_markup: url ? {
          inline_keyboard: [[{
            text: "Review Now",
            url
          }]]
        } : undefined
      })
    }
  );
  
  if (!response.ok) {
    console.error('Telegram notification failed:', await response.text());
  }
}
```

### Email Templates
```typescript
// lib/notifications/email.ts
export const EMAIL_TEMPLATES = {
  topupPending: (user: User, amount: number) => ({
    to: process.env.ADMIN_EMAIL!,
    subject: `New Top-Up Request - Rp ${amount.toLocaleString()}`,
    html: `
      <h2>New Top-Up Request</h2>
      <p><strong>User:</strong> ${user.name} (${user.email})</p>
      <p><strong>Amount:</strong> Rp ${amount.toLocaleString()}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
      <p><a href="${process.env.APP_URL}/admin/topup-requests">Review Now</a></p>
    `
  }),
  
  topupApproved: (user: User, amount: number, credits: number) => ({
    to: user.email,
    subject: 'Top-Up Approved!',
    html: `
      <h2>Payment Approved</h2>
      <p>Hi ${user.name},</p>
      <p>Your top-up of <strong>Rp ${amount.toLocaleString()}</strong> has been approved.</p>
      <p>You received <strong>${credits} screening credits</strong>.</p>
      <p><a href="${process.env.APP_URL}/dashboard">Go to Dashboard</a></p>
    `
  }),
  
  topupRejected: (user: User, amount: number, reason: string) => ({
    to: user.email,
    subject: 'Top-Up Request Issue',
    html: `
      <h2>Payment Verification Issue</h2>
      <p>Hi ${user.name},</p>
      <p>We couldn't verify your top-up of Rp ${amount.toLocaleString()}.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please submit a new request with a clear payment proof.</p>
      <p><a href="${process.env.APP_URL}/dashboard/topup">Try Again</a></p>
    `
  })
};
```

## Security Considerations

### Input Validation
```typescript
// Zod schemas
const topupRequestSchema = z.object({
  amountIdr: z.number()
    .refine(val => [10000, 50000, 150000, 500000].includes(val), 
      "Invalid amount. Only 10k, 50k, 150k, or 500k allowed"),
  paymentMethod: z.enum(['qris', 'stripe']),
  proofImage: z.string().url().optional(),
});

const adminActionSchema = z.object({
  topupRequestId: z.string().cuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(500).optional(),
});
```

### Authorization

**Admin Routes:**
- Add `isAdmin` to JWT/session callback in `src/lib/auth.ts`
- Middleware checks `session.user.isAdmin === true` for `/api/admin/*` routes
- Update seed to set `isAdmin: true` for default admin user

**User Routes:**
- Users can only access own top-up requests and transactions
- Enforce `userId` match in query filters

**File Uploads:**
- Validate MIME type: `image/jpeg`, `image/png` only
- Max file size: 5MB
- For MVP: Store in local `/uploads/payment-proofs/` directory
- For Production: Must migrate to Cloudinary/S3 before deploying to serverless

### Rate Limiting
- Max 5 top-up requests per 15 minutes per user
- Use simple in-memory Map for MVP (consider Redis for production)

### Stripe Webhook Security (When Enabled)
- Add `/api/stripe/webhook` to middleware exception list (like `/api/n8n/callback`)
- Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
- Implement idempotency: check if `session.id` already processed before crediting
- Return 200 OK immediately (Stripe will retry on failure)

### Transaction Safety
- All credit operations wrapped in Prisma `$transaction`
- Use `updateMany` with WHERE conditions for atomic updates
- Never allow negative creditBalance (enforce with conditional updates)
- Log all credit changes for audit trail

## Environment Variables

```env
# Database
DATABASE_URL=file:./dev.db

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# App
APP_URL=http://localhost:3000

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ADMIN_CHAT_ID=123456789

# Email (example: Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=SuperHRD <noreply@superhrd.com>
ADMIN_EMAIL=admin@superhrd.com

# Stripe (disabled initially)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ENABLED=false

# File Storage (for QRIS proof images)
CLOUDINARY_URL=cloudinary://...
# or AWS S3 credentials
```

## Testing Strategy

### Unit Tests
- Credit deduction logic (free quota → paid credit flow)
- Daily quota reset logic
- Bundle price calculation
- Transaction record creation

### Integration Tests
- QRIS upload → pending → admin approve → credit added
- Insufficient credit → upload blocked
- Daily quota: 5 free → 6th requires credit
- Stripe webhook → credit auto-added (when enabled)

### E2E Tests (Playwright)
- User journey: Low credit → Top-up page → QRIS upload → Wait approval
- Admin journey: Notification → Dashboard → Approve → User gets credit
- Edge cases: Expired requests, double approval prevention

## Rollout Plan

### Phase 1: Database & Core Logic (Day 1-2)

1. Create migration for new models (User extensions, Transaction, TopupRequest, PricingConfig)
2. Add `isAdmin` field to User model, update seed script
3. Seed initial `PricingConfig` data (bundle pricing)
4. Implement `src/lib/credits.ts`:
   - `getCurrentDateWIB()` helper
   - `canUserScreen()` with WIB date check
   - `deductCredit()` with atomic updates
5. Update `src/lib/auth.ts` to include `isAdmin` in JWT/session
6. Modify `/api/upload` to check credit BEFORE n8n, deduct AFTER n8n accepts
7. Unit tests for credit logic

### Phase 2: QRIS Flow (Day 3-4)

1. Build `/dashboard/topup` page:
   - Bundle selection (only 4 options)
   - QRIS instructions + static QR display
   - File upload form (local storage for MVP)
2. Implement `/api/topup/qris` endpoint (create TopupRequest)
3. Build `/admin/topup-requests` page:
   - Pending list with image preview
   - Approve/Reject actions
4. Implement `/api/admin/topup/:id/approve` and `/reject` with idempotency
5. Setup Telegram bot notification (optional, not blocker)
6. Email notification (optional, not blocker)
7. Integration tests

### Phase 3: UI Polish & Testing (Day 5)

1. Add credit balance widget to main dashboard
2. Build `/dashboard/credit-history` page
3. Add low credit warnings on upload page
4. Expire old pending requests on admin list load (serverless workaround)
5. E2E tests with Playwright
6. Documentation update
7. Deploy to staging/production

### Phase 4: Stripe Prep (Future - When Ready)

1. Create Stripe account, get API keys
2. Add Stripe dependency to package.json
3. Implement checkout & webhook handlers
4. Add `/api/stripe/webhook` to middleware exceptions
5. Test in Stripe test mode
6. Set `STRIPE_ENABLED=true` in production when ready

**Note:** Phase 4 is completely separate - Phase 1-3 can go live without Stripe.

## Success Metrics

- **User adoption:** % of users who top-up within 7 days
- **Payment method preference:** QRIS vs Stripe usage ratio
- **Admin efficiency:** Avg time from request to approval
- **Revenue:** Total top-up volume per week
- **Churn:** % users who hit credit limit and don't top-up

## Future Enhancements

- **Subscription plans:** Monthly unlimited screening
- **Referral credits:** Give credits for referring new users
- **Credit expiration:** Credits expire after 1 year
- **Bulk discount:** Special pricing for >1000 screening purchases
- **API key for developers:** Programmatic access with credit tracking
