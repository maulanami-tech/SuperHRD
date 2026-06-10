# Credit Payment System Documentation

## Overview

SuperHRD uses a credit-based payment system where users consume credits for CV screening.

## User Features

### Free Daily Quota
- Every user gets 5 free CV screenings per day
- Quota resets at 00:00 WIB (Asia/Jakarta timezone)
- Free quota is used first, then paid credits

### Credit Bundles

| Package | Price | Credits | Bonus | Price/Credit |
|---------|-------|---------|-------|--------------|
| Starter | Rp 10,000 | 20 | 0% | Rp 500 |
| Basic | Rp 50,000 | 110 | +10% | Rp 454 |
| Pro | Rp 150,000 | 350 | +17% | Rp 428 |
| Enterprise | Rp 500,000 | 1,250 | +25% | Rp 400 |

### Payment Methods

**QRIS (Available Now)**
- Pay via QRIS static code
- Upload payment proof
- Manual admin approval (1-24 hours)
- Minimum: Rp 10,000

**Stripe (Coming Soon)**
- Automatic credit on payment
- International cards supported
- Minimum: Rp 50,000

## Technical Architecture

### Database Models

**User Extensions:**
- `creditBalance`: Number of screening credits available
- `dailyQuotaUsed`: Count of free screenings used today
- `lastQuotaDate`: Date string in WIB timezone for quota reset
- `isAdmin`: Flag for admin access

**Transaction:**
- Records all credit movements
- Types: topup_qris, topup_stripe, deduct_screening, daily_quota, refund, admin_adjustment
- Tracks creditDelta and balanceAfter for audit

**TopupRequest:**
- Stores QRIS top-up requests
- Status: pending, approved, rejected, expired
- Links to payment proof image URL

### Credit Deduction Flow

1. Check if user can screen (free quota or paid credit available)
2. Deduct credit BEFORE calling n8n
3. If n8n fails, refund credit immediately
4. Record transaction for audit trail

### Atomic Operations

All credit operations use Prisma `updateMany` with conditional WHERE clauses:
- Prevents race conditions
- Ensures balance integrity
- Idempotent operations

### Timezone Handling

Uses `date-fns-tz` to convert UTC to WIB:
```typescript
import { toZonedTime } from 'date-fns-tz';
const wibDate = toZonedTime(new Date(), 'Asia/Jakarta');
```

## API Endpoints

### User APIs
- `GET /api/credit/balance` - Get current balance and quota
- `GET /api/credit/transactions` - Transaction history with pagination
- `POST /api/topup/qris` - Submit QRIS top-up request
- `GET /api/topup/requests` - List user's top-up requests

### Admin APIs
- `GET /api/admin/topup-requests` - List all top-up requests with pagination
- `POST /api/admin/topup/[id]/approve` - Approve request
- `POST /api/admin/topup/[id]/reject` - Reject request

### Idempotency

The `/api/upload` endpoint supports idempotency via the `Idempotency-Key` header:

```bash
curl -X POST /api/upload \
  -H "Idempotency-Key: unique-request-id" \
  -F "file=@cv.pdf"
```

**Features:**
- If no key provided, one is auto-generated
- Duplicate requests within 24 hours return cached response with `cached: true` flag
- Prevents double-charging on network retries
- Key format: any string (client's choice) or auto-generated UUID

**Response for duplicate:**
```json
{
  "candidateId": "clxxx...",
  "status": "processing",
  "cached": true
}
```

## Admin Guide

### Approving Top-Ups

1. Navigate to `/admin/topup-requests`
2. Review pending requests
3. Click payment proof link to verify
4. Click "Approve" to credit user
5. Or "Reject" with reason

### Creating Admin Users

Update `isAdmin` field in database:
```sql
UPDATE User SET isAdmin = 1 WHERE email = 'admin@example.com';
```

Or use seed script:
```bash
npm run prisma:seed
```

Default admin credentials:
- Email: hrd@superhrd.com
- Password: (see seed output, random on first run)

**Warning:** Change password after first login

## Future Enhancements

- Stripe integration (Phase 4)
- Email/Telegram notifications
- Subscription plans
- Referral credits
- Credit expiration
- Bulk discounts
