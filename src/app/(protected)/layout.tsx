import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AuthSessionProvider>
      <AppShell>{children}</AppShell>
    </AuthSessionProvider>
  );
}
