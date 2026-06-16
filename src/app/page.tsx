import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: FileUp,
    title: "Upload CVs",
    description: "Submit candidate profiles with criteria and role context.",
  },
  {
    icon: Brain,
    title: "AI Screening",
    description: "Score candidates against your requirements automatically.",
  },
  {
    icon: BarChart3,
    title: "Hiring Insights",
    description: "Track score distribution, positions, and top candidates.",
  },
];

const bundles = [
  { label: "Starter", price: "Rp 10K", credits: "20" },
  { label: "Basic", price: "Rp 50K", credits: "110", popular: true },
  { label: "Pro", price: "Rp 150K", credits: "350" },
  { label: "Enterprise", price: "Rp 500K", credits: "1250" },
];

function ProductMockup() {
  return (
    <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-lg border border-white/15 bg-white text-slate-900 shadow-2xl shadow-indigo-950/40">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Users className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">SuperHRD</span>
        </div>
        <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
          <span>Dashboard</span>
          <span>Upload CV</span>
          <span>Analytics</span>
          <span>Top Up</span>
        </div>
      </div>
      <div className="grid md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r bg-slate-50 p-4 md:block">
          {["Dashboard", "Upload CV", "Analytics", "Top Up", "History"].map(
            (item, index) => (
              <div
                key={item}
                className={`rounded-md px-3 py-2 text-sm ${
                  index === 0
                    ? "bg-indigo-50 font-medium text-primary"
                    : "text-slate-500"
                }`}
              >
                {item}
              </div>
            )
          )}
        </aside>
        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 via-primary to-violet-600 p-5 text-white">
            <div className="text-sm text-white/75">Your Credit Balance</div>
            <div className="mt-2 text-4xl font-semibold">45</div>
            <div className="mt-1 text-sm text-white/75">
              45 paid screenings remaining • Free quota: 3/5 today
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Today's Screening", "8"],
              ["Average Score", "76"],
              ["Total Candidates", "128"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border">
            {[
              ["Alya Pratama", "Frontend Developer", "92", "Completed"],
              ["Rafi Nugroho", "Backend Developer", "84", "Completed"],
              ["Dina Maharani", "Product Manager", "-", "Processing"],
            ].map(([name, role, score, status]) => (
              <div
                key={name}
                className="grid grid-cols-[1fr_auto] gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_160px_80px_110px]"
              >
                <div>
                  <div className="text-sm font-medium">{name}</div>
                  <div className="text-xs text-slate-500 sm:hidden">{role}</div>
                </div>
                <div className="hidden text-sm text-slate-500 sm:block">{role}</div>
                <div className="text-sm font-semibold text-primary">{score}</div>
                <div className="hidden text-sm text-slate-500 sm:block">{status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Users className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">SuperHRD</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950 pb-10 pt-20 text-white sm:pt-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm text-white/75">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                AI-powered recruitment dashboard
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
                SuperHRD
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">
                Screen 100 CVs in minutes, rank candidates with AI, and keep
                every hiring decision tied to clear criteria.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-white/70">
                <div>
                  <div className="text-2xl font-semibold text-white">10x</div>
                  Faster screening
                </div>
                <div>
                  <div className="text-2xl font-semibold text-white">95%</div>
                  Criteria coverage
                </div>
                <div>
                  <div className="text-2xl font-semibold text-white">24/7</div>
                  Always available
                </div>
              </div>
            </div>
            <ProductMockup />
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Built for repeatable HR screening
              </h2>
              <p className="mt-3 text-muted-foreground">
                SuperHRD keeps the daily workflow simple: upload, review ranked
                results, and inspect analytics when hiring volume grows.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title}>
                  <CardHeader>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Hiring signals at a glance
              </h2>
              <p className="mt-3 text-muted-foreground">
                Analytics v1 summarizes screening health without requiring
                custom reports or spreadsheet cleanup.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
              {[
                {
                  icon: BarChart3,
                  title: "Score distribution",
                  description: "See the quality spread.",
                },
                {
                  icon: Briefcase,
                  title: "Position insights",
                  description: "Compare roles quickly.",
                },
                {
                  icon: Clock3,
                  title: "Pipeline status",
                  description: "Track pending work.",
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardHeader>
                    <item.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{item.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Credit-based pricing
              </h2>
              <p className="mt-3 text-muted-foreground">
                Buy credits when you need them. No subscription is required for
                teams with seasonal hiring volume.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {bundles.map((bundle) => (
                <Card
                  key={bundle.label}
                  className={bundle.popular ? "border-primary ring-2 ring-primary/20" : ""}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{bundle.label}</CardTitle>
                      {bundle.popular && (
                        <span className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                          Popular
                        </span>
                      )}
                    </div>
                    <CardDescription>{bundle.price}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">{bundle.credits}</div>
                    <p className="text-sm text-muted-foreground">credits</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Users className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            SuperHRD
          </div>
          <p>AI-powered CV screening dashboard</p>
        </div>
      </footer>
    </div>
  );
}
