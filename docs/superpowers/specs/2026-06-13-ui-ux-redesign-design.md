# SuperHRD UI/UX Redesign Design Spec

**Date:** 2026-06-13  
**Status:** Draft  
**Author:** Sisyphus (AI Agent)

---

## Overview

SuperHRD is a SaaS product for AI-powered CV screening. This redesign focuses on transforming the current functional-but-basic UI into a polished, professional, and user-friendly experience that can be sold to HRD teams.

## Target Users

**SaaS product for HRD teams** who need AI-powered CV screening. Users are HRD professionals who may be first-time users of such tools, requiring an intuitive and approachable interface.

## Design Direction

**Soft & Friendly** — Rounded corners, soft shadows, warm colors. Approachable and HR-friendly. Similar to Gusto or Deel.

## Color Scheme

**Indigo Purple** — AI-first, premium feel. Primary color: `#6366f1`.

### Color Tokens

```css
:root {
  --primary: #6366f1;        /* Indigo 500 */
  --primary-light: #818cf8;  /* Indigo 400 */
  --primary-dark: #4f46e5;   /* Indigo 600 */
  --primary-bg: #eef2ff;     /* Indigo 50 */
  
  --success: #10b981;        /* Emerald 500 */
  --success-bg: #f0fdf4;     /* Emerald 50 */
  
  --warning: #f59e0b;        /* Amber 500 */
  --warning-bg: #fef3c7;     /* Amber 50 */
  
  --error: #ef4444;          /* Red 500 */
  --error-bg: #fef2f2;       /* Red 50 */
  
  --text-primary: #1e293b;   /* Slate 800 */
  --text-secondary: #64748b; /* Slate 500 */
  --text-muted: #94a3b8;     /* Slate 400 */
  
  --bg-page: #f8fafc;        /* Slate 50 */
  --bg-card: #ffffff;
  --border: #e2e8f0;         /* Slate 200 */
}
```

---

## Pages & Layouts

### 1. Landing Page (Unauthenticated)

**Style:** Dark Hero + Stats  
**Purpose:** First impression for prospects. Dramatic, memorable, premium.

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  NAVBAR: Logo | Features | Pricing | Login | Get Started   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HERO SECTION (Dark gradient: #1e1b4b → #312e81)           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  AI-Powered Recruitment                              │   │
│  │  SuperHRD                                           │   │
│  │  Screen 100 CVs in minutes, not days                │   │
│  │                                                     │   │
│  │  [Get Started Free]  [Watch Demo]                   │   │
│  │                                                     │   │
│  │  10x Faster  |  95% Accuracy  |  24/7 Available     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  FEATURES SECTION                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ AI Scan  │  │ Instant  │  │ Detailed │                 │
│  │ Upload & │  │ Results  │  │ Analytics│                 │
│  │ let AI   │  │ in secs  │  │ & Reports│                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  PRICING SECTION (Credit-based)                             │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐                          │
│  │20  │  │110 │  │350 │  │1250│                          │
│  │crd │  │crd │  │crd │  │crd │                          │
│  └────┘  └────┘  └────┘  └────┘                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  FOOTER                                                    │
└─────────────────────────────────────────────────────────────┘
```

#### Components

- **Navbar:** Sticky top, glass morphism effect, logo + nav links + CTA buttons
- **Hero:** Full-width dark gradient background, large typography, stat counters
- **Features:** 3-column grid with icons and descriptions
- **Pricing:** 4-column card grid (existing bundles)
- **Footer:** Simple links, copyright

---

### 2. Login / Register Pages

**Style:** Centered card with gradient background  
**Status:** Already good, minimal changes needed

#### Structure

```
┌─────────────────────────────────────────┐
│         Gradient Background             │
│  ┌─────────────────────────────────┐   │
│  │         [Logo]                  │   │
│  │         SuperHRD                │   │
│  │  Sign in to access the CV       │   │
│  │  screening dashboard            │   │
│  │                                 │   │
│  │  [Email]                        │   │
│  │  [Password]                     │   │
│  │  [Sign in]                      │   │
│  │                                 │   │
│  │  Don't have account? Register   │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Changes Required

- Update primary color to Indigo Purple
- Add subtle animation on card hover
- Add loading state with skeleton

---

### 3. Dashboard (Main Page)

**Style:** Credit-Focused  
**Purpose:** First view after login. Credit balance prominent, quick actions accessible.

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │  BREADCRUMB: Dashboard                           │
│         │                                                   │
│ [Logo]  │  ┌─────────────────────────────────────────────┐ │
│         │  │  Credit Balance Card (Gradient Indigo)      │ │
│ Dashboard│  │  ┌─────────────────────────────────────┐   │ │
│ Upload  │  │  │  Your Credit Balance                 │   │ │
│ Top Up  │  │  │  45 credits                          │   │ │
│ History │  │  │  ≈ 45 CV screenings remaining        │   │ │
│         │  │  │  [Top Up Now]                        │   │ │
│         │  │  └─────────────────────────────────────┘   │ │
│         │  └─────────────────────────────────────────────┘ │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  Quick Stats                                │ │
│         │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐   │ │
│         │  │  │ Today's │  │ Avg     │  │ Total   │   │ │
│         │  │  │ Screening│  │ Score   │  │ Candidates│  │ │
│         │  │  │ 8       │  │ 76      │  │ 128     │   │ │
│         │  │  └─────────┘  └─────────┘  └─────────┘   │ │
│         │  └─────────────────────────────────────────────┘ │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  Recent Candidates                          │ │
│         │  │  [Table with search/filter]                 │ │
│         │  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Components

1. **Credit Balance Card**
   - Gradient background (Indigo → Purple)
   - Large credit number
   - "Top Up Now" CTA button
   - Free quota remaining

2. **Quick Stats Grid**
   - 3-column cards
   - Icons + values + labels
   - Today's screening count
   - Average score
   - Total candidates

3. **Candidates Table**
   - Search input with icon
   - Status filter dropdown
   - Sortable columns (Name, Position, Score, Status, Date)
   - Click row to view detail
   - Delete action in dropdown

---

### 4. Upload CV Page

**Style:** Centered card form  
**Purpose:** Upload candidate CV for AI screening

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │  BREADCRUMB: Dashboard > Upload CV                │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  Upload CV                                  │ │
│         │  │  Submit a candidate CV for AI screening     │ │
│         │  │                                             │ │
│         │  │  Candidate Information                     │ │
│         │  │  ┌─────────────────────────────────────┐   │ │
│         │  │  │  Name *                              │   │ │
│         │  │  │  [Input field]                       │   │ │
│         │  │  │                                     │   │ │
│         │  │  │  Email (optional)                   │   │ │
│         │  │  │  [Input field]                       │   │ │
│         │  │  │                                     │   │ │
│         │  │  │  Position *                         │   │ │
│         │  │  │  [Input field]                       │   │ │
│         │  │  │                                     │   │ │
│         │  │  │  Evaluation Criteria *              │   │ │
│         │  │  │  [Textarea]                         │   │ │
│         │  │  │                                     │   │ │
│         │  │  │  AI Prompt *                        │   │ │
│         │  │  │  [Textarea]                         │   │ │
│         │  │  │                                     │   │ │
│         │  │  │  CV File                            │   │ │
│         │  │  │  ┌─────────────────────────────┐   │   │ │
│         │  │  │  │  Drag & drop or click        │   │   │ │
│         │  │  │  │  PDF/DOCX, max 10MB          │   │   │ │
│         │  │  │  └─────────────────────────────┘   │   │ │
│         │  │  │                                     │   │ │
│         │  │  │  [Upload & Screen]                  │   │ │
│         │  │  └─────────────────────────────────────┘   │ │
│         │  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Changes Required

- Update FileDropzone to accept PDF, DOCX, DOC (currently PDF only)
- Add file type icons for DOCX/DOC
- Update validation messages
- Add form progress indicator

---

### 5. Candidate Detail Page

**Style:** Card-based layout with status states  
**Purpose:** View candidate details and screening results

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │  BREADCRUMB: Dashboard > Candidates > John Doe    │
│         │                                                   │
│         │  [← Back to Dashboard]              [Remove]     │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  John Doe                                   │ │
│         │  │  Submitted 2 hours ago by hrd@superhrd.com  │ │
│         │  │  [Pending] [Score: —]                       │ │
│         │  │                                             │ │
│         │  │  📋 Frontend Dev  📧 john@email.com         │ │
│         │  │  📄 cv.pdf  📅 2026-06-13                  │ │
│         │  └─────────────────────────────────────────────┘ │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  [Status-specific content]                  │ │
│         │  │  - Processing: Loading spinner              │ │
│         │  │  - Completed: Screening Results             │ │
│         │  │  - Failed: Error message + retry            │ │
│         │  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Status States

1. **Processing**
   - Animated spinner
   - "AI is screening this CV..."
   - Auto-refresh every 10 seconds

2. **Completed**
   - Score circle (color-coded: green ≥80, yellow ≥60, red <60)
   - Summary text
   - Criteria breakdown (accordion)

3. **Failed**
   - Error icon
   - Error message
   - "Upload Again" button

4. **Pending**
   - Clock icon
   - "Waiting to be processed"

---

### 6. Top Up Page

**Style:** Bundle selection cards  
**Purpose:** Purchase credits via QRIS

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │  BREADCRUMB: Dashboard > Top Up                   │
│         │                                                   │
│         │  Top Up Credits                                  │
│         │  Current balance: 45 credits | Free quota: 3/5   │
│         │                                                   │
│         │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│         │  │Starter │ │ Basic  │ │  Pro   │ │Enterprise│  │
│         │  │ Rp 10K │ │ Rp 50K │ │ Rp150K │ │ Rp500K │   │
│         │  │ 20 crd │ │110 crd │ │350 crd │ │1250 crd│   │
│         │  │        │ │Popular │ │+17%    │ │+25%    │   │
│         │  └────────┘ └────────┘ └────────┘ └────────┘   │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  Payment Instructions                       │ │
│         │  │  1. Scan QRIS code                          │ │
│         │  │  2. Upload payment proof URL                │ │
│         │  │  3. Submit request                          │ │
│         │  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Changes Required

- Add Header component (currently missing)
- Use shadcn Input instead of raw HTML input
- Add loading skeleton while fetching balance
- Add QRIS code image placeholder
- Improve proof upload UX (drag & drop or URL input)

---

### 7. Credit History Page

**Style:** Transaction list  
**Purpose:** View all credit transactions

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │  BREADCRUMB: Dashboard > Credit History           │
│         │                                                   │
│         │  Transaction History                             │
│         │  View all credit transactions                    │
│         │                                                   │
│         │  [Filter: All | Top Up | Deduction | Quota]      │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  All Transactions                           │ │
│         │  │                                             │ │
│         │  │  [Badge: topup_qris]  2026-06-13 10:30    │ │
│         │  │  Top up via QRIS                           │ │
│         │  │  Rp 50,000                      +20        │ │
│         │  │  Balance: 65                                │ │
│         │  │  ─────────────────────────────────────────  │ │
│         │  │  [Badge: deduct_screening]  2026-06-13 09:15│ │
│         │  │  CV screening for Frontend Dev              │ │
│         │  │  -1 credit                       -1         │ │
│         │  │  Balance: 45                                │ │
│         │  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Changes Required

- Add Header component (currently missing)
- Add loading skeleton (currently full-screen spinner)
- Use shadcn Badge with proper color variants
- Add empty state when no transactions

---

### 8. Admin Top-Up Requests Page

**Style:** Card list with approve/reject actions  
**Purpose:** Admin approves/rejects QRIS top-up requests

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │  BREADCRUMB: Dashboard > Admin > Top-Up Requests  │
│         │                                                   │
│         │  Top-Up Requests                                │
│         │  Manage QRIS top-up approvals                   │
│         │                                                   │
│         │  [Pending] [Approved] [Rejected] [All]          │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐ │
│         │  │  John Doe (john@email.com)    [Pending]    │ │
│         │  │  Current balance: 45 credits               │ │
│         │  │                                             │ │
│         │  │  Amount: Rp 50,000                         │ │
│         │  │  Credits: 110                              │ │
│         │  │  Submitted: 2026-06-13 10:30               │ │
│         │  │  Method: QRIS                              │ │
│         │  │                                             │ │
│         │  │  Payment Proof: [View Image]               │ │
│         │  │                                             │ │
│         │  │  [Approve]  [Reject]                       │ │
│         │  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Changes Required

- Replace `prompt()` for rejection reason with shadcn Dialog
- Add loading state per-card (not global)
- Add payment proof image preview (modal/lightbox)
- Add confirmation dialog before approve/reject

---

## Navigation

### Sidebar

```
┌─────────────────┐
│  ⬡ SuperHRD     │
│                  │
│  📊 Dashboard    │  ← Active state: bg-primary/10, text-primary
│  📄 Upload CV    │
│                  │
│  ─────────────── │
│                  │
│  💰 Top Up       │
│  📜 History      │
│                  │
│  ─────────────── │
│                  │
│  👤 Profile      │
│  [Sign out]      │
└─────────────────┘
```

### Breadcrumb

```
Dashboard / Candidates / John Doe
```

- Uses `>` separator
- Each segment is clickable
- Last segment is not clickable (current page)

---

## Mobile Experience

**Priority:** Mobile-First  
**Approach:** Optimized for touch targets, prominent credit balance

### Mobile Layout

```
┌─────────────────────┐
│  ⬡ SuperHRD    [👤] │
├─────────────────────┤
│                     │
│  ┌───────────────┐  │
│  │ Credit Balance│  │
│  │ 45 credits    │  │
│  │ [Top Up]      │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ 📄 Upload CV  │  │
│  └───────────────┘  │
│                     │
│  Recent             │
│  ┌───────────────┐  │
│  │ John Doe  85  │  │
│  │ Jane Smith    │  │
│  └───────────────┘  │
│                     │
├─────────────────────┤
│  📊  📄  💰  👤   │
│ Home Upload Top User│
└─────────────────────┘
```

### Mobile-Specific Features

- Bottom navigation bar (4 items: Home, Upload, Top Up, Profile)
- Credit balance card takes full width
- Touch targets minimum 44px
- Swipe gestures for table rows (delete action)
- Pull-to-refresh on lists

---

## Components to Update

### 1. FileDropzone

**Current:** Accepts PDF only  
**New:** Accepts PDF, DOCX, DOC

```typescript
const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
};
```

### 2. Header Component

**Current:** Basic sticky header  
**New:** Consistent header with breadcrumb support

```typescript
interface HeaderProps {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  children?: React.ReactNode;
}
```

### 3. Loading States

**Current:** Mixed (full-screen spinner vs skeleton)  
**New:** Consistent skeleton loading for all pages

| Page | Loading State |
|------|---------------|
| Dashboard | Table skeleton + stats skeleton |
| Upload | Form skeleton |
| Candidate Detail | Card + content skeleton |
| Top Up | Bundle cards skeleton |
| Credit History | List skeleton |
| Admin | Cards skeleton |

### 4. Empty States

**Current:** Basic "No data" text  
**New:** Illustrated empty states with CTAs

```typescript
interface EmptyStateProps {
  icon: "upload" | "candidates" | "transactions" | "requests";
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, bottom nav, stacked cards |
| Tablet | 640px - 1024px | Sidebar collapsed (icons only), 2-column grids |
| Desktop | > 1024px | Full sidebar, 3-4 column grids |

---

## Animations & Transitions

| Element | Animation | Duration |
|---------|-----------|----------|
| Cards | Hover scale 1.02 | 150ms |
| Buttons | Hover brightness | 150ms |
| Sidebar | Collapse/expand | 200ms |
| Page transitions | Fade in | 200ms |
| Loading skeletons | Shimmer effect | 1.5s infinite |

---

## Accessibility

- Color contrast ratio minimum 4.5:1 for text
- Focus visible states on all interactive elements
- ARIA labels on icon-only buttons
- Keyboard navigation support
- Screen reader friendly form labels

---

## Success Criteria

1. All pages use consistent Indigo Purple color scheme
2. Mobile experience is prioritized (touch targets, responsive)
3. Credit balance is prominent on dashboard
4. Loading states are consistent (skeletons everywhere)
5. FileDropzone supports PDF, DOCX, DOC
6. Admin rejection uses Dialog instead of `prompt()`
7. Build passes with no warnings
8. No TypeScript errors

---

## Out of Scope

- Dark mode (CSS variables defined but not implemented in this phase)
- Multi-user / team features
- Integration with external ATS
- Custom branding / white-label

---

## Next Steps

1. Get user approval on this spec
2. Create implementation plan with task breakdown
3. Execute refactoring in parallel subagents
4. Verify with build and visual QA
