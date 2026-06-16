import { ClipboardList, FileUp, Inbox, ReceiptText, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: "upload" | "users" | "transactions" | "requests" | "inbox";
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({
  title = "No candidates yet",
  description = "Upload a CV to get started. AI will automatically screen and score each candidate.",
  icon = "users",
  action = { label: "Upload CV", href: "/upload" },
}: EmptyStateProps) {
  const icons = {
    upload: FileUp,
    users: Users,
    transactions: ReceiptText,
    requests: ClipboardList,
    inbox: Inbox,
  };
  const Icon = icons[icon];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button asChild className="mt-6">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
