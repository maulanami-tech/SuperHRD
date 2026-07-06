"use client";

import { ClipboardList, FileUp, Inbox, ReceiptText, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: "upload" | "users" | "transactions" | "requests" | "inbox";
  action?: {
    label: string;
    href: string;
  } | null;
}

export function EmptyState({
  title,
  description,
  icon = "users",
  action,
}: EmptyStateProps) {
  const { t } = useI18n();
  const icons = {
    upload: FileUp,
    users: Users,
    transactions: ReceiptText,
    requests: ClipboardList,
    inbox: Inbox,
  };
  const Icon = icons[icon];
  const resolvedTitle = title ?? t("empty.candidatesTitle");
  const resolvedDescription = description ?? t("empty.candidatesDescription");
  const resolvedAction = action === undefined ? { label: t("common.uploadCv"), href: "/upload" } : action;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{resolvedTitle}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {resolvedDescription}
      </p>
      {resolvedAction && (
        <Button asChild className="mt-6">
          <Link href={resolvedAction.href}>{resolvedAction.label}</Link>
        </Button>
      )}
    </div>
  );
}