import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

type VerifyEmailPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { status } = await searchParams;
  const success = status === "success";

  return (
    <AuthShell
      title={success ? "Email verified" : "Verification link invalid"}
      description={
        success
          ? "Your SuperHRD account is ready. Sign in to continue to your dashboard."
          : "This verification link is invalid or expired. Register again or contact support if the problem continues."
      }
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
          {success ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
