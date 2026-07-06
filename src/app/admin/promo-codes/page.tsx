import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PromoCodesClient } from "./promo-codes-client";

export default async function AdminPromoCodesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    redirect("/dashboard");
  }

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { redemptions: { select: { status: true } } },
  });

  const initialCodes = codes.map(({ redemptions, ...code }) => ({
    ...code,
    expiresAt: code.expiresAt?.toISOString() ?? null,
    createdAt: code.createdAt.toISOString(),
    claimedCount: redemptions.filter((r) => r.status === "claimed").length,
    pendingCount: redemptions.filter((r) => r.status === "pending").length,
  }));

  return (
    <SidebarProvider>
      <AppSidebar isAdmin />
      <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
        <PromoCodesClient initialCodes={initialCodes} />
      </div>
      <MobileNav isAdmin />
    </SidebarProvider>
  );
}
