import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoleManagement } from "@/hooks/useRoleManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus, Shield, ShieldAlert, ShieldOff, Trash2, ArrowUpCircle,
  ArrowDownCircle, Clock, Loader2, Users, ScrollText,
} from "lucide-react";
import { format } from "date-fns";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-500/10 text-red-600 border-red-200",
  admin: "bg-blue-500/10 text-blue-600 border-blue-200",
  therapist: "bg-green-500/10 text-green-600 border-green-200",
  client: "bg-muted text-muted-foreground border-border",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  super_admin: <ShieldAlert className="w-3.5 h-3.5" />,
  admin: <Shield className="w-3.5 h-3.5" />,
  therapist: <Users className="w-3.5 h-3.5" />,
};

const ACTION_LABELS: Record<string, string> = {
  create_account: "Account Created",
  add_role: "Role Added",
  remove_role: "Role Removed",
  promote: "Promoted",
  demote: "Demoted",
};

export default function RoleManagementPanel() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const { users, logs, loading, fetchUsers, fetchLogs, addUser, removeRole, promote, demote } =
    useRoleManagement();

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<string>("therapist");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, []);

  const handleAddUser = async () => {
    if (!newEmail.trim()) return;
    setIsAdding(true);
    const ok = await addUser(newEmail.trim(), newRole);
    if (ok) {
      setNewEmail("");
      setNewRole("therapist");
      fetchLogs();
    }
    setIsAdding(false);
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    await removeRole(userId, role);
    fetchLogs();
  };

  const handlePromote = async (userId: string) => {
    await promote(userId);
    fetchLogs();
  };

  const handleDemote = async (userId: string) => {
    await demote(userId);
    fetchLogs();
  };

  return (
    <Tabs defaultValue="users" className="space-y-4">
      <TabsList>
        <TabsTrigger value="users" className="gap-1.5">
          <Users className="w-4 h-4" />
          Users
        </TabsTrigger>
        <TabsTrigger value="logs" className="gap-1.5">
          <ScrollText className="w-4 h-4" />
          Audit Log
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-4">
        {/* Add User Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="new-email" className="sr-only">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="therapist">Therapist</SelectItem>
                  {isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
              <Button
                variant="sage"
                onClick={handleAddUser}
                disabled={isAdding || !newEmail.trim()}
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User List */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Staff & Admin Accounts ({users.length})
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
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.email}</p>
                      {u.name && (
                        <p className="text-xs text-muted-foreground">{u.name}</p>
                      )}
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {u.roles.map((role) => (
                          <Badge
                            key={role}
                            variant="outline"
                            className={`text-[10px] gap-1 ${ROLE_COLORS[role] || ""}`}
                          >
                            {ROLE_ICONS[role]}
                            {role.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Promote: Only super_admin can promote admin → super_admin */}
                      {isSuperAdmin &&
                        u.roles.includes("admin") &&
                        !u.roles.includes("super_admin") &&
                        u.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Promote to Super Admin">
                                <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Promote to Super Admin?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.email} will gain full platform control including role management.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handlePromote(u.id)}>
                                  Promote
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                      {/* Demote: Only super_admin can demote super_admin → admin */}
                      {isSuperAdmin &&
                        u.roles.includes("super_admin") &&
                        u.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Demote to Admin">
                                <ArrowDownCircle className="w-4 h-4 text-orange-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Demote to Admin?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.email} will lose super admin privileges.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDemote(u.id)}>
                                  Demote
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                      {/* Remove role */}
                      {u.id !== user?.id &&
                        u.roles
                          .filter((role) => {
                            if (isSuperAdmin) return true;
                            if (isAdmin) return role === "therapist";
                            return false;
                          })
                          .map((role) => (
                            <AlertDialog key={role}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title={`Remove ${role}`}>
                                  <ShieldOff className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove {role} role?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {u.email} will lose {role.replace("_", " ")} access.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground"
                                    onClick={() => handleRemoveRole(u.id, role)}
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="logs">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Role Change History</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchLogs}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No role changes recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 text-sm"
                  >
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <Badge variant="outline" className="text-[10px] mr-1.5">
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                        {log.target_email || log.target_user_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.old_role && <span className="line-through mr-1">{log.old_role}</span>}
                        {log.old_role && log.new_role && "→ "}
                        {log.new_role && <span className="font-medium">{log.new_role}</span>}
                        {log.reason && <span className="ml-2 italic">({log.reason})</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {format(new Date(log.created_at), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
