"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthShellProps = {
  children: ReactNode;
  description: string;
  footer: ReactNode;
  title: string;
};

const candidateRows = [
  { name: "Alya Pratama", role: "Product Designer", score: "92" },
  { name: "Raka Wijaya", role: "Frontend Engineer", score: "88" },
  { name: "Dina Kurnia", role: "People Ops", score: "84" },
];

export function AuthShell({
  children,
  description,
  footer,
  title,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden rounded-lg bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:min-h-[620px]">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-950">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-12 max-w-lg space-y-5 lg:mt-20">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-200">
              SuperHRD
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              CV screening yang rapi dari login pertama.
            </h1>
            <p className="text-base leading-7 text-slate-300">
              Upload CV, lihat ranking kandidat, dan pantau pemakaian credit
              dalam alur yang konsisten untuk tim HR.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Shortlist", value: "10x", icon: CheckCircle2 },
              { label: "Match rate", value: "95%", icon: BarChart3 },
              { label: "Secure flow", value: "24/7", icon: ShieldCheck },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/10 bg-white/[0.06] p-4"
              >
                <item.icon className="h-4 w-4 text-indigo-200" />
                <p className="mt-3 text-xl font-semibold">{item.value}</p>
                <p className="text-xs text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-sm font-medium text-white">
                  Candidate pipeline
                </p>
                <p className="text-xs text-slate-400">Screening batch today</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-100">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="divide-y divide-white/10">
              {candidateRows.map((candidate) => (
                <div
                  key={candidate.name}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {candidate.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {candidate.role}
                    </p>
                  </div>
                  <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                    {candidate.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex justify-center">
          <Card className="w-full max-w-md border-slate-200/80 shadow-xl shadow-slate-900/10">
            <CardHeader className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Users className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-semibold tracking-normal">
                  {title}
                </CardTitle>
                <CardDescription className="text-sm leading-6">
                  {description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {children}
              {footer}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
