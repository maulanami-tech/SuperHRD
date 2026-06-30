import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileUp,
  Shield,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnimatedSection } from "@/components/ui/animated-section";

const features = [
  {
    icon: FileUp,
    title: "Upload CVs",
    description:
      "Drag & drop multiple CVs at once. Supports PDF, DOCX, and image formats with instant parsing.",
  },
  {
    icon: Brain,
    title: "AI Screening",
    description:
      "Score candidates against your custom criteria automatically. No more manual resume scanning.",
  },
  {
    icon: BarChart3,
    title: "Hiring Insights",
    description:
      "Visualize score distributions, position comparisons, and pipeline health at a glance.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description:
      "Enterprise-grade security. Your candidate data is encrypted and never shared with third parties.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Screen 100+ CVs in under 5 minutes. What used to take days now takes minutes.",
  },
  {
    icon: Target,
    title: "Custom Criteria",
    description:
      "Define role-specific requirements. AI evaluates candidates based on YOUR priorities.",
  },
];

const steps = [
  {
    step: "01",
    icon: FileUp,
    title: "Upload CVs",
    description: "Drop your candidate resumes into SuperHRD. We handle the rest.",
  },
  {
    step: "02",
    icon: Brain,
    title: "AI Screens & Scores",
    description:
      "Our AI analyzes each CV against your criteria and generates match scores.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "Review & Decide",
    description:
      "Browse ranked candidates, compare scores, and make data-driven hiring decisions.",
  },
];

const bundles = [
  {
    label: "Starter",
    price: "Rp 10K",
    credits: "20",
    description: "Perfect for trying out SuperHRD",
    features: ["20 CV screenings", "Basic AI scoring", "Email support", "7-day validity"],
  },
  {
    label: "Basic",
    price: "Rp 50K",
    credits: "110",
    popular: true,
    description: "Best for small hiring batches",
    features: [
      "110 CV screenings",
      "Advanced AI scoring",
      "Analytics dashboard",
      "Priority support",
      "30-day validity",
    ],
  },
  {
    label: "Pro",
    price: "Rp 150K",
    credits: "350",
    description: "For growing teams with regular hiring",
    features: [
      "350 CV screenings",
      "Advanced AI scoring",
      "Full analytics suite",
      "Custom criteria",
      "Priority support",
      "60-day validity",
    ],
  },
  {
    label: "Enterprise",
    price: "Rp 500K",
    credits: "1250",
    description: "For high-volume recruitment teams",
    features: [
      "1,250 CV screenings",
      "Advanced AI scoring",
      "Full analytics suite",
      "Custom criteria",
      "Dedicated support",
      "90-day validity",
      "API access",
    ],
  },
];

const testimonials = [
  {
    name: "Rina Susanti",
    role: "HR Manager at TechCorp",
    quote:
      "SuperHRD cut our screening time from 3 days to 30 minutes. The AI scoring is remarkably accurate.",
    score: "98%",
  },
  {
    name: "Budi Santoso",
    role: "Talent Acquisition Lead",
    quote:
      "We screened 500+ candidates for our expansion. SuperHRD identified our top 10 in under an hour.",
    score: "95%",
  },
  {
    name: "Maya Putri",
    role: "Head of People at StartupX",
    quote:
      "The analytics dashboard gives me instant visibility into our hiring pipeline. Game changer for HR.",
    score: "97%",
  },
];

function HeroMockup() {
  return (
    <div className="relative mx-auto mt-12 max-w-4xl lg:mt-16">
      <div className="absolute -inset-1 rounded-2xl animate-gradient-border opacity-60 blur-sm" />
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl shadow-indigo-950/10">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src="/superhrd-logo-mark.svg"
              alt="SuperHRD"
              className="h-8 w-8"
              width={32}
              height={32}
            />
            <span className="text-sm font-semibold">SuperHRD</span>
          </div>
          <div className="hidden items-center gap-1 text-xs text-slate-400 sm:flex">
            <span className="rounded-md px-2 py-1 text-primary bg-primary/5 font-medium">
              Dashboard
            </span>
            <span className="rounded-md px-2 py-1 hover:bg-slate-100 cursor-pointer transition-colors">
              Upload CV
            </span>
            <span className="rounded-md px-2 py-1 hover:bg-slate-100 cursor-pointer transition-colors">
              Analytics
            </span>
          </div>
        </div>
        <div className="grid md:grid-cols-[200px_1fr]">
          <aside className="hidden border-r bg-slate-50/80 p-3 md:block">
            {["Dashboard", "Upload CV", "Analytics", "Top Up", "History"].map(
              (item, index) => (
                <div
                  key={item}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    index === 0
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {item}
                </div>
              )
            )}
          </aside>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="animate-float rounded-xl bg-gradient-to-br from-primary via-primary to-violet-600 p-5 text-white">
              <div className="text-sm text-white/80">Credit Balance</div>
              <div className="mt-1 text-3xl font-bold lg:text-4xl">45</div>
              <div className="mt-1 text-xs text-white/70">
                45 screenings remaining
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                ["Today", "8"],
                ["Avg Score", "76"],
                ["Total", "128"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="animate-float-delayed rounded-lg border border-slate-200 p-3 text-center"
                >
                  <div className="text-[10px] text-slate-400 sm:text-xs">
                    {label}
                  </div>
                  <div className="text-lg font-bold text-slate-900 sm:text-xl">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {[
                ["Alya Pratama", "Frontend Dev", "92"],
                ["Rafi Nugroho", "Backend Dev", "84"],
                ["Dina Maharani", "PM", "-"],
              ].map(([name, role, score]) => (
                <div
                  key={name}
                  className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {name}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {role}
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      score !== "-"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <img
              src="/superhrd-logo.svg"
              alt="SuperHRD"
              className="h-9 w-auto"
              width={168}
              height={45}
            />
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            <a
              href="#features"
              className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              How it Works
            </a>
            <a
              href="#pricing"
              className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">
                Get Started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pb-8 pt-16 sm:pt-20 lg:pb-12 lg:pt-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(79,70,229,0.08),transparent)]" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="mx-auto max-w-3xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Trusted by 50+ HR teams across Indonesia
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  Screen 100 CVs in{" "}
                  <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                    Minutes
                  </span>
                  ,{" "}
                  <br className="hidden sm:block" />
                  Not Days
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                  AI-powered candidate screening that ranks, scores, and
                  shortlists candidates based on YOUR criteria. Make every hire
                  data-driven.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button size="lg" asChild className="px-6">
                    <Link href="/register">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    asChild
                    className="px-6"
                  >
                    <Link href="#how-it-works">
                      See How it Works
                      <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={200}>
              <HeroMockup />
            </AnimatedSection>
          </div>
        </section>

        {/* Social Proof Bar */}
        <section className="border-y border-slate-200/60 bg-slate-50/50 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                {[
                  { value: "10x", label: "Faster screening", icon: Zap },
                  { value: "95%", label: "Criteria accuracy", icon: Target },
                  { value: "24/7", label: "Always available", icon: Clock3 },
                  { value: "50+", label: "HR teams trust us", icon: Users },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {item.value}
                    </div>
                    <div className="text-sm text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                  How it Works
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Three steps to smarter hiring
                </h2>
                <p className="mt-3 text-lg text-slate-600">
                  No complex setup. No learning curve. Just upload, screen, and
                  decide.
                </p>
              </div>
            </AnimatedSection>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {steps.map((item, index) => (
                <AnimatedSection key={item.step} delay={index * 150}>
                  <div className="relative text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-100">
                      <item.icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Step {item.step}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                    {index < steps.length - 1 && (
                      <div className="absolute left-[calc(50%+40px)] top-8 hidden w-[calc(100%-80px)] border-t-2 border-dashed border-slate-200 md:block" />
                    )}
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section
          id="features"
          className="border-t border-slate-200/60 bg-slate-50/50 py-20 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Features
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Everything you need to hire better
                </h2>
                <p className="mt-3 text-lg text-slate-600">
                  Built for HR teams who want to make faster, fairer hiring
                  decisions.
                </p>
              </div>
            </AnimatedSection>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <AnimatedSection key={feature.title} delay={index * 100}>
                  <Card className="h-full border-slate-200/80 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/5 hover:-translate-y-0.5">
                    <CardHeader>
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Testimonials
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Loved by HR professionals
                </h2>
                <p className="mt-3 text-lg text-slate-600">
                  See what our users have to say about SuperHRD.
                </p>
              </div>
            </AnimatedSection>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <AnimatedSection key={testimonial.name} delay={index * 150}>
                  <Card className="h-full border-slate-200/80">
                    <CardContent className="pt-6">
                      <div className="mb-3 flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className="h-4 w-4 fill-amber-400 text-amber-400"
                          />
                        ))}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600">
                        &ldquo;{testimonial.quote}&rdquo;
                      </p>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {testimonial.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {testimonial.role}
                          </div>
                        </div>
                        <div className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">
                          {testimonial.score}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="border-t border-slate-200/60 bg-slate-50/50 py-20 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Pricing
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Credit-based pricing
                </h2>
                <p className="mt-3 text-lg text-slate-600">
                  Buy credits when you need them. No subscription required.
                </p>
              </div>
            </AnimatedSection>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {bundles.map((bundle, index) => (
                <AnimatedSection key={bundle.label} delay={index * 100}>
                  <Card
                    className={`relative h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                      bundle.popular
                        ? "border-primary ring-2 ring-primary/20 shadow-md shadow-primary/10"
                        : "border-slate-200/80"
                    }`}
                  >
                    {bundle.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">{bundle.label}</CardTitle>
                      <div className="mt-1">
                        <span className="text-3xl font-bold text-slate-900">
                          {bundle.price}
                        </span>
                      </div>
                      <CardDescription className="mt-1 text-sm">
                        {bundle.credits} credits
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-slate-500">
                        {bundle.description}
                      </p>
                      <ul className="space-y-2">
                        {bundle.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2 text-sm text-slate-600"
                          >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="mt-4 w-full"
                        variant={bundle.popular ? "default" : "outline"}
                        asChild
                      >
                        <Link href="/register">
                          Get Started
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-violet-600 px-6 py-16 text-center sm:px-12">
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  Ready to transform your hiring?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
                  Join 50+ HR teams already using SuperHRD to make faster, smarter
                  hiring decisions.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    variant="secondary"
                    asChild
                    className="px-8"
                  >
                    <Link href="/register">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    asChild
                    className="text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link href="/login">Sign In</Link>
                  </Button>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center">
                <img
                  src="/superhrd-logo.svg"
                  alt="SuperHRD"
                  className="h-8 w-auto"
                  width={152}
                  height={40}
                />
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                AI-powered CV screening dashboard for modern HR teams.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Product</h3>
              <ul className="mt-3 space-y-2">
                {["Features", "Pricing", "How it Works"].map((item) => (
                  <li key={item}>
                    <a
                      href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-sm text-slate-500 transition-colors hover:text-slate-900"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Company</h3>
              <ul className="mt-3 space-y-2">
                {["About", "Blog", "Contact"].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-slate-500 transition-colors hover:text-slate-900"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
              <ul className="mt-3 space-y-2">
                {["Privacy", "Terms", "Security"].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-slate-500 transition-colors hover:text-slate-900"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-slate-200/60 pt-6">
            <p className="text-center text-xs text-slate-400">
              &copy; {new Date().getFullYear()} SuperHRD. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
