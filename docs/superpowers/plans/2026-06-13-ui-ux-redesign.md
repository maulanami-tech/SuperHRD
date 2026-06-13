# SuperHRD UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform SuperHRD from basic functional UI to polished, professional SaaS product with Soft & Friendly design direction, Indigo Purple color scheme, and mobile-first experience.

**Architecture:** Component-driven approach using shadcn/ui primitives. Update design tokens first, then rebuild pages using consistent patterns. Each task is self-contained and verifiable.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide icons

---

## File Structure

```
src/
├── app/
│   ├── globals.css                    # MODIFY - Update color tokens
│   ├── layout.tsx                     # MODIFY - Add font weights
│   ├── page.tsx                       # CREATE - Landing page
│   ├── login/page.tsx                 # MODIFY - Update colors
│   ├── register/page.tsx              # MODIFY - Update colors
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # MODIFY - Add breadcrumb support
│   │   ├── dashboard/page.tsx         # MODIFY - Credit-focused redesign
│   │   ├── upload/page.tsx            # MODIFY - Update FileDropzone
│   │   ├── topup/page.tsx             # MODIFY - Add Header, shadcn Input
│   │   ├── credit-history/page.tsx    # MODIFY - Add Header, loading skeleton
│   │   └── candidates/[id]/page.tsx   # MODIFY - Minor updates
│   └── admin/topup-requests/page.tsx  # MODIFY - Replace prompt() with Dialog
├── components/
│   ├── ui/                            # KEEP - shadcn primitives
│   ├── app-sidebar.tsx                # MODIFY - Add nav items, update styling
│   ├── header.tsx                     # MODIFY - Add breadcrumb support
│   ├── empty-state.tsx                # MODIFY - Add more icon variants
│   ├── file-dropzone.tsx              # MODIFY - Accept DOCX/DOC
│   ├── loading-skeleton.tsx           # MODIFY - Add more skeleton variants
│   ├── mobile-nav.tsx                 # CREATE - Bottom navigation for mobile
│   ├── breadcrumb.tsx                 # CREATE - Breadcrumb component
│   └── credit-balance-card.tsx        # CREATE - Reusable credit balance card
└── lib/
    └── utils.ts                       # KEEP - cn() utility
```

---

## Task 1: Update Design Tokens (Color Scheme)

**Files:**
- Modify: `src/app/globals.css:6-41`

- [ ] **Step 1: Update CSS variables to Indigo Purple scheme**

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0.004 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0.004 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0.004 285.823);
  --primary: oklch(0.546 0.207 262.881);        /* Indigo 500 #6366f1 */
  --primary-foreground: oklch(0.985 0.001 285.823);
  --secondary: oklch(0.967 0.001 285.823);
  --secondary-foreground: oklch(0.205 0.006 285.823);
  --muted: oklch(0.967 0.001 285.823);
  --muted-foreground: oklch(0.556 0.005 285.823);
  --accent: oklch(0.967 0.001 285.823);
  --accent-foreground: oklch(0.205 0.006 285.823);
  --destructive: oklch(0.577 0.215 27.325);
  --destructive-foreground: oklch(0.985 0.001 285.823);
  --border: oklch(0.922 0.004 285.823);
  --input: oklch(0.922 0.004 285.823);
  --ring: oklch(0.546 0.207 262.881);
  --radius: 0.625rem;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update color tokens to Indigo Purple scheme"
```

---

## Task 2: Create Breadcrumb Component

**Files:**
- Create: `src/components/breadcrumb.tsx`

- [ ] **Step 1: Create Breadcrumb component**

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/breadcrumb.tsx
git commit -m "feat: add Breadcrumb component"
```

---

## Task 3: Create Mobile Navigation Component

**Files:**
- Create: `src/components/mobile-nav.tsx`

- [ ] **Step 1: Create MobileNav component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileUp, Wallet, History } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard },
  { title: "Upload", href: "/upload", icon: FileUp },
  { title: "Top Up", href: "/topup", icon: Wallet },
  { title: "History", href: "/credit-history", icon: History },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/mobile-nav.tsx
git commit -m "feat: add MobileNav component for bottom navigation"
```

---

## Task 4: Create Credit Balance Card Component

**Files:**
- Create: `src/components/credit-balance-card.tsx`

- [ ] **Step 1: Create CreditBalanceCard component**

```tsx
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreditBalanceCardProps {
  balance: number;
  dailyQuotaRemaining: number;
}

export function CreditBalanceCard({ balance, dailyQuotaRemaining }: CreditBalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10" />
      
      <div className="relative">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <Wallet className="h-4 w-4" />
          <span>Your Credit Balance</span>
        </div>
        <div className="mt-2 text-4xl font-bold">{balance}</div>
        <div className="mt-1 text-sm text-white/80">
          ≈ {balance} CV screenings remaining
        </div>
        <div className="mt-1 text-xs text-white/60">
          Free quota: {dailyQuotaRemaining}/5 today
        </div>
        <Link href="/topup">
          <Button className="mt-4 bg-white text-indigo-600 hover:bg-white/90" size="sm">
            Top Up Now
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/credit-balance-card.tsx
git commit -m "feat: add CreditBalanceCard component"
```

---

## Task 5: Update Header Component with Breadcrumb Support

**Files:**
- Modify: `src/components/header.tsx`

- [ ] **Step 1: Update Header component**

```tsx
"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Breadcrumb } from "@/components/breadcrumb";

interface HeaderProps {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  children?: React.ReactNode;
}

export function Header({ title, description, breadcrumb, children }: HeaderProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="flex flex-1 items-center justify-between">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <Breadcrumb items={breadcrumb} className="mb-1" />
          )}
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="hidden text-sm text-muted-foreground sm:block">
              {description}
            </p>
          )}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/header.tsx
git commit -m "feat: add breadcrumb support to Header component"
```

---

## Task 6: Update Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx:29-32`

- [ ] **Step 1: Add nav items for Top Up and History**

```tsx
const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Upload CV", href: "/upload", icon: FileUp },
];

const secondaryItems = [
  { title: "Top Up", href: "/topup", icon: Wallet },
  { title: "History", href: "/credit-history", icon: History },
];
```

- [ ] **Step 2: Add import for Wallet and History icons**

```tsx
import {
  LayoutDashboard,
  FileUp,
  LogOut,
  Users,
  Wallet,
  History,
} from "lucide-react";
```

- [ ] **Step 3: Update sidebar JSX to include secondary items**

Add a second SidebarGroup after the first one with the secondaryItems.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add Top Up and History to sidebar navigation"
```

---

## Task 7: Update Login Page Colors

**Files:**
- Modify: `src/app/login/page.tsx:56`

- [ ] **Step 1: Update gradient background**

```tsx
<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 px-4">
```

- [ ] **Step 2: Update logo background color**

```tsx
<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
```
(Already uses `bg-primary`, so it will automatically use the new Indigo color)

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "style: update Login page gradient to use Indigo"
```

---

## Task 8: Update Register Page Colors

**Files:**
- Modify: `src/app/register/page.tsx:59`

- [ ] **Step 1: Update gradient background**

```tsx
<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 px-4">
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "style: update Register page gradient to use Indigo"
```

---

## Task 9: Redesign Dashboard Page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Import new components**

```tsx
import { CreditBalanceCard } from "@/components/credit-balance-card";
import { Header } from "@/components/header";
```

- [ ] **Step 2: Replace credit balance section with CreditBalanceCard**

Replace the existing credit balance div with:
```tsx
{balance && (
  <div className="px-4 md:px-6 mb-4">
    <CreditBalanceCard 
      balance={balance.creditBalance} 
      dailyQuotaRemaining={balance.dailyQuotaRemaining} 
    />
  </div>
)}
```

- [ ] **Step 3: Add quick stats grid**

Add after CreditBalanceCard:
```tsx
<div className="px-4 md:px-6 mb-4 grid grid-cols-3 gap-4">
  <div className="rounded-lg border bg-card p-4">
    <div className="text-sm text-muted-foreground">Today&apos;s Screening</div>
    <div className="text-2xl font-bold">{candidates?.length || 0}</div>
  </div>
  <div className="rounded-lg border bg-card p-4">
    <div className="text-sm text-muted-foreground">Total Candidates</div>
    <div className="text-2xl font-bold">{candidates?.length || 0}</div>
  </div>
  <div className="rounded-lg border bg-card p-4">
    <div className="text-sm text-muted-foreground">Credits</div>
    <div className="text-2xl font-bold">{balance?.creditBalance || 0}</div>
  </div>
</div>
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: redesign Dashboard with CreditBalanceCard and quick stats"
```

---

## Task 10: Update FileDropzone to Accept DOCX/DOC

**Files:**
- Modify: `src/components/file-dropzone.tsx:16-18`

- [ ] **Step 1: Update ACCEPT constant**

```tsx
const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
};
```

- [ ] **Step 2: Update file type description**

```tsx
<p className="mt-1 text-xs text-muted-foreground">
  PDF, DOCX, DOC only, max 10MB
</p>
```

- [ ] **Step 3: Update toast error message**

```tsx
case "file-invalid-type":
  toast.error("Invalid file type. Only PDF, DOCX, and DOC files are accepted.");
  break;
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/file-dropzone.tsx
git commit -m "feat: update FileDropzone to accept DOCX and DOC files"
```

---

## Task 11: Update Top Up Page

**Files:**
- Modify: `src/app/(dashboard)/topup/page.tsx`

- [ ] **Step 1: Import Header and shadcn Input**

```tsx
import { Header } from "@/components/header";
import { Input } from "@/components/ui/input";
```

- [ ] **Step 2: Add Header component**

Replace the existing header div with:
```tsx
<Header 
  title="Top Up Credits" 
  description="Purchase credits for CV screening"
  breadcrumb={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Top Up" }
  ]}
/>
```

- [ ] **Step 3: Replace raw input with shadcn Input**

Replace:
```tsx
<input
  type="text"
  placeholder="https://example.com/proof.jpg"
  value={proofImage}
  onChange={(e) => setProofImage(e.target.value)}
  className="w-full px-3 py-2 border rounded-md"
/>
```

With:
```tsx
<Input
  type="text"
  placeholder="https://example.com/proof.jpg"
  value={proofImage}
  onChange={(e) => setProofImage(e.target.value)}
/>
```

- [ ] **Step 4: Add loading skeleton**

Replace the full-screen spinner with:
```tsx
if (loading) {
  return (
    <>
      <Header title="Top Up Credits" />
      <main className="flex-1 p-4 md:p-6">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/topup/page.tsx
git commit -m "feat: update Top Up page with Header, shadcn Input, loading skeleton"
```

---

## Task 12: Update Credit History Page

**Files:**
- Modify: `src/app/(dashboard)/credit-history/page.tsx`

- [ ] **Step 1: Import Header component**

```tsx
import { Header } from "@/components/header";
```

- [ ] **Step 2: Add Header component**

Replace the existing header div with:
```tsx
<Header 
  title="Transaction History" 
  description="View all credit transactions"
  breadcrumb={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Credit History" }
  ]}
/>
```

- [ ] **Step 3: Add loading skeleton**

Replace the full-screen spinner with:
```tsx
if (loading) {
  return (
    <>
      <Header title="Transaction History" />
      <main className="flex-1 p-4 md:p-6">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between border-b pb-4">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-3 w-48 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/credit-history/page.tsx
git commit -m "feat: update Credit History page with Header and loading skeleton"
```

---

## Task 13: Update Admin Top-Up Requests Page

**Files:**
- Modify: `src/app/admin/topup-requests/page.tsx`

- [ ] **Step 1: Import Dialog components**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

- [ ] **Step 2: Add state for rejection dialog**

```tsx
const [rejectTarget, setRejectTarget] = useState<string | null>(null);
const [rejectReason, setRejectReason] = useState("");
```

- [ ] **Step 3: Replace prompt() with Dialog**

Replace the `handleReject` function:
```tsx
async function handleReject(id: string) {
  setRejectTarget(id);
  setRejectReason("");
}

async function confirmReject() {
  if (!rejectTarget || !rejectReason) return;
  
  setProcessing(rejectTarget);
  try {
    const res = await fetch(`/api/admin/topup/${rejectTarget}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: rejectReason }),
    });

    if (res.ok) {
      toast.success('Request rejected');
      fetchRequests();
    } else {
      toast.error('Failed to reject');
    }
  } catch (error) {
    toast.error('Failed to reject request');
  } finally {
    setProcessing(null);
    setRejectTarget(null);
    setRejectReason("");
  }
}
```

- [ ] **Step 4: Add Dialog JSX**

Add before the closing `</div>`:
```tsx
<Dialog open={!!rejectTarget} onOpenChange={(open) => {
  if (!open && !processing) {
    setRejectTarget(null);
    setRejectReason("");
  }
}}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Reject Top-Up Request</DialogTitle>
      <DialogDescription>
        Please provide a reason for rejecting this request.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reject-reason">Rejection Reason</Label>
        <Input
          id="reject-reason"
          placeholder="Enter reason for rejection..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </div>
    </div>
    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        disabled={processing === rejectTarget}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        onClick={confirmReject}
        disabled={processing === rejectTarget || !rejectReason}
      >
        {processing === rejectTarget ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Reject
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/topup-requests/page.tsx
git commit -m "feat: replace prompt() with Dialog for admin rejection"
```

---

## Task 14: Update Dashboard Layout for Mobile Nav

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Import MobileNav**

```tsx
import { MobileNav } from "@/components/mobile-nav";
```

- [ ] **Step 2: Add MobileNav to layout**

```tsx
return (
  <SidebarProvider>
    <AppSidebar />
    <div className="flex min-h-screen flex-1 flex-col">
      {children}
    </div>
    <MobileNav />
  </SidebarProvider>
);
```

- [ ] **Step 3: Add bottom padding for mobile nav**

Update the main content area to have bottom padding on mobile:
```tsx
<div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
  {children}
</div>
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: add MobileNav to dashboard layout"
```

---

## Task 15: Create Landing Page

**Files:**
- Create: `src/app/page.tsx` (replace existing)

- [ ] **Step 1: Create Landing Page**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, BarChart3, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">S</span>
            </div>
            <span className="text-lg font-bold">SuperHRD</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 py-24 text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-4 text-sm uppercase tracking-widest text-indigo-300">
            AI-Powered Recruitment
          </p>
          <h1 className="text-5xl font-bold md:text-6xl">SuperHRD</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-indigo-200">
            Screen 100 CVs in minutes, not days
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-white text-indigo-600 hover:bg-white/90">
                Get Started Free
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              Watch Demo
            </Button>
          </div>
          <div className="mt-16 flex items-center justify-center gap-12 text-indigo-200">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">10x</div>
              <div className="text-sm">Faster</div>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">95%</div>
              <div className="text-sm">Accuracy</div>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-sm">Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold">Why SuperHRD?</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">AI Screening</h3>
              <p className="mt-2 text-muted-foreground">
                Upload CV and let AI analyze qualifications automatically
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Instant Results</h3>
              <p className="mt-2 text-muted-foreground">
                Get detailed scores and analysis in seconds
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Detailed Analytics</h3>
              <p className="mt-2 text-muted-foreground">
                Track hiring insights and optimize your recruitment
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to Transform Hiring?</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join HRD teams who are already screening candidates 10x faster with AI
          </p>
          <Link href="/register" className="mt-8 inline-block">
            <Button size="lg">Start Free Trial</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 SuperHRD. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: create Landing Page with hero, features, and CTA sections"
```

---

## Task 16: Add Card Hover Animations

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add animation utilities**

```css
@layer utilities {
  .transition-all-150 {
    transition: all 150ms ease-in-out;
  }
}
```

- [ ] **Step 2: Add hover scale to card components**

Update any Card components to include hover effects:
```tsx
className="transition-all duration-150 hover:scale-[1.02] hover:shadow-md"
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add card hover animations"
```

---

## Task 17: Final Build Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore: final UI/UX redesign verification"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Update Design Tokens | 5 min |
| 2 | Create Breadcrumb | 5 min |
| 3 | Create MobileNav | 10 min |
| 4 | Create CreditBalanceCard | 10 min |
| 5 | Update Header | 5 min |
| 6 | Update Sidebar | 10 min |
| 7 | Update Login Page | 5 min |
| 8 | Update Register Page | 5 min |
| 9 | Redesign Dashboard | 15 min |
| 10 | Update FileDropzone | 5 min |
| 11 | Update Top Up Page | 15 min |
| 12 | Update Credit History | 10 min |
| 13 | Update Admin Page | 15 min |
| 14 | Update Dashboard Layout | 5 min |
| 15 | Create Landing Page | 20 min |
| 16 | Add Animations | 5 min |
| 17 | Final Verification | 10 min |
| **Total** | | **~150 min** |

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-13-ui-ux-redesign.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
