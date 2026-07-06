import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminOverviewStats } from "@/lib/admin-stats";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { OverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
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

  const stats = await getAdminOverviewStats();

  return (
    <SidebarProvider>
      <AppSidebar isAdmin />
      <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
        <OverviewClient stats={stats} />
      </div>
      <MobileNav isAdmin />
    </SidebarProvider>
  );
}
