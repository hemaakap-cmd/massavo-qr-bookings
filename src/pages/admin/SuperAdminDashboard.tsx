import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRoleManagement } from "@/hooks/useAdminRoleManagement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Building2, BarChart3, Settings, Shield, ShieldAlert, ShieldOff,
  LogOut, Home, Globe, Loader2, Users, Heart, ArrowRight,
  Package, Calendar, Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import massavoLogo from "@/assets/massavo-logo-3d.png";
import RoleManagementPanel from "@/components/admin/RoleManagementPanel";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-500/10 text-red-600 border-red-200",
  admin: "bg-blue-500/10 text-blue-600 border-blue-200",
  therapist: "bg-green-500/10 text-green-600 border-green-200",
};

const SuperAdminDashboard = () => {
  const { user, isSuperAdmin, signOut } = useAuth();
  const { users, loading, fetchUsers, addAdmin, removeAdmin } = useAdminRoleManagement();

  useEffect(() => {
    if (isSuperAdmin) fetchUsers();
  }, [isSuperAdmin]);

  const handleSignOut = async () => {
    await signOut();
    window.location.replace("/admin/login");
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <img src={massavoLogo} alt="MASSAVO" className="w-8 h-8" />
          <span className="font-display text-lg font-bold text-foreground">Super Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><Home className="w-4 h-4 mr-1" />Site</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin"><Settings className="w-4 h-4 mr-1" />Admin Panel</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-1" />Sign Out
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Global platform management & role control</p>
        </div>

        {/* Quick Links */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Package, label: "Services", desc: "Manage services & pricing", url: "/admin/services" },
            { icon: Building2, label: "Gyms", desc: "Manage gym locations", url: "/admin/gyms" },
            { icon: Globe, label: "Countries", desc: "Multi-country settings", url: "/admin" },
            { icon: BarChart3, label: "Financials", desc: "Revenue overview", url: "/admin/financial" },
            { icon: Users, label: "Therapists", desc: "Team management", url: "/admin/therapists" },
            { icon: Calendar, label: "Bookings", desc: "All bookings", url: "/admin/bookings" },
            { icon: Shield, label: "Schedules", desc: "Gym schedules", url: "/admin/schedules" },
            { icon: Activity, label: "Monitoring", desc: "Live event feed", url: "/admin/monitoring" },
          ].map(({ icon: Icon, label, desc, url }) => (
            <Link key={label} to={url} className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all group">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">{label}</span>
                <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>

        {/* Smart Recovery Profiles */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Smart Recovery Profiles</h3>
                <p className="text-xs text-muted-foreground">Clinical pain evolution, trends & per-client insights across all locations</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/pain-evolution">
                View <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Admin Management Section */}
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Admin Management
          </h2>
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">
                <Users className="w-4 h-4 inline mr-1.5" />
                Staff Users ({users.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchUsers} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {loading && users.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No staff users found.</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => {
                    const isAdmin = u.roles.includes("admin");
                    const isSA = u.roles.includes("super_admin");
                    const isSelf = u.id === user?.id;

                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{u.email}</p>
                          {u.name && <p className="text-xs text-muted-foreground">{u.name}</p>}
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {u.roles.map((role) => (
                              <Badge
                                key={role}
                                variant="outline"
                                className={`text-[10px] ${ROLE_COLORS[role] || ""}`}
                              >
                                {role.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {!isSelf && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Make Admin */}
                            {!isAdmin && !isSA && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1.5">
                                    <Shield className="w-3.5 h-3.5" />
                                    Make Admin
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Grant Admin Role?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {u.email} will gain admin access to the platform.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => addAdmin(u.id)}>
                                      Confirm
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {/* Remove Admin (not for super_admins) */}
                            {isAdmin && !isSA && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30">
                                    <ShieldOff className="w-3.5 h-3.5" />
                                    Remove Admin
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Admin Role?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {u.email} will lose admin access.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground"
                                      onClick={() => removeAdmin(u.id)}
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Full Role Management */}
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">
            User & Role Management
          </h2>
          <RoleManagementPanel />
        </section>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
