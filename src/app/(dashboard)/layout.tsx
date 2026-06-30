import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  const isAdmin = user?.isAdmin === true;

  return (
    <SidebarProvider>
      <AppSidebar isAdmin={isAdmin} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
        {children}
      </div>
      <MobileNav isAdmin={isAdmin} />
    </SidebarProvider>
  );
}
