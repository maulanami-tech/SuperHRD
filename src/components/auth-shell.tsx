"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  description: string;
  footer: ReactNode;
  title: string;
};

export function AuthShell({
  children,
  description,
  footer,
  title,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(79,70,229,0.08),transparent)]" />

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mx-auto mb-8 flex items-center justify-center"
        >
          <img
            src="/superhrd-logo.svg"
            alt="SuperHRD"
            className="h-10 w-auto"
            width={180}
            height={48}
          />
        </Link>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-10">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          </div>

          {children}

          {footer}
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            10x Faster
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            95% Accuracy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            24/7
          </span>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} SuperHRD. All rights reserved.
        </p>
      </div>
    </main>
  );
}
