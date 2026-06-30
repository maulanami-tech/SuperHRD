import Link from "next/link";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { ResendVerificationForm } from "@/components/resend-verification-form";

type VerifyEmailPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const stateCopy = {
  success: {
    title: "Email verified",
    description: "Your SuperHRD account is ready. Sign in to continue to your dashboard.",
    icon: <CheckCircle2 className="h-8 w-8 text-emerald-600" />,
  },
  expired: {
    title: "Verification link expired",
    description: "For security, verification links expire after 30 minutes. Send a new link to continue activating your account.",
    icon: <Clock3 className="h-8 w-8 text-amber-600" />,
  },
  invalid: {
    title: "Verification link invalid",
    description: "This verification link has already been used or cannot be recognized. Send a new link if your account is not verified yet.",
    icon: <XCircle className="h-8 w-8 text-destructive" />,
  },
} as const;

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { status } = await searchParams;
  const state = status === "success" || status === "expired" ? status : "invalid";
  const copy = stateCopy[state];

  return (
    <AuthShell
      title={copy.title}
      description={copy.description}
      footer={
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Need a new account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create account
          </Link>
        </p>
      }
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
          {copy.icon}
        </div>

        {state === "success" ? (
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        ) : (
          <ResendVerificationForm compact />
        )}
      </div>
    </AuthShell>
  );
}