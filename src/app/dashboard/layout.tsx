import AuthGuard from "@/components/AuthGuard";
import TopNav from "@/components/TopNav";
import RoleGuard from "@/components/RoleGuard";
import GlobalFloatingActionMenu from "@/components/GlobalFloatingActionMenu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TopNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RoleGuard>{children}</RoleGuard>
        <GlobalFloatingActionMenu />
      </main>
    </AuthGuard>
  );
}