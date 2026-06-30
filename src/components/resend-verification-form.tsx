"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { resendVerificationEmail } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResendVerificationFormProps = {
  compact?: boolean;
};

export function ResendVerificationForm({ compact = false }: ResendVerificationFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSent(false);

    try {
      const result = await resendVerificationEmail(email);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      setSent(true);
      toast.success("Verification email sent");
    } catch {
      toast.error("Could not send verification email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div className="space-y-2">
        <Label htmlFor="verification-email">Email</Label>
        <Input
          id="verification-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="hrd@superhrd.com"
          autoComplete="email"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <MailCheck className="h-4 w-4" />
            Send verification email
          </>
        )}
      </Button>
      {sent && (
        <p className={compact ? "text-center text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
          If that email belongs to an unverified account, a new link has been sent.
        </p>
      )}
    </form>
  );
}