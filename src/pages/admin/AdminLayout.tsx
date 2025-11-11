import { Navigate, Link, useLocation } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { LayoutDashboard, Trophy, Users, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const location = useLocation();

  if (authLoading || roleLoading) {
    return (
      <div className="container py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: "/admin", label: "Overview", icon: LayoutDashboard },
    { path: "/admin/competitions", label: "Competitions", icon: Trophy },
    { path: "/admin/submissions", label: "Submissions", icon: Users },
    { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-background">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Back to Site
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <Card className="p-4">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </Card>
          </aside>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
