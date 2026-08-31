import { useState, useEffect } from "react";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  UserX,
  UserCheck,
  KeyRound,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/roleConfig";
import StaffFormDialog, {
  generatePassword,
} from "@/components/admin/StaffFormDialog";
import StaffDetailsDialog from "@/components/admin/StaffDetailsDialog";
import ExportButton from "@/components/ExportButton";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";

const ROLES = Object.entries(ROLE_LABELS);

const SORT_ACCESSORS = {
  name: (s) =>
    [s.first_name, s.middle_name, s.last_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  role: (s) => (ROLE_LABELS[s.role] || s.role || "").toLowerCase(),
  department: (s) => (s.department || "").toLowerCase(),
  phone: (s) => (s.phone || "").toLowerCase(),
  status: (s) => (s.status || "Active").toLowerCase(),
};

function SortIcon({ active, direction }) {
  if (!active) {
    return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
  }
  return direction === "asc" ? (
    <ArrowUp className="w-3 h-3 text-foreground" />
  ) : (
    <ArrowDown className="w-3 h-3 text-foreground" />
  );
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [credentialsDialog, setCredentialsDialog] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/staff");
        if (!cancelled) setStaff(res.data.data || []);
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load staff.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get("/staff");
      setStaff(res.data.data || []);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load staff.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fullName = (s) =>
    [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/staff/${editing.id}`, form);
        toast({
          title: "User updated",
          description: `${fullName(form)}'s details were saved.`,
          duration: 3000,
        });
      } else {
        await api.post("/staff", form);
        toast({
          title: "User created",
          description: `${fullName(form)} can now log in.`,
          duration: 3000,
        });
        setCredentialsDialog({ email: form.email, password: form.password });
      }
      setFormOpen(false);
      setEditing(null);
      loadStaff();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to save user.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (s) => {
    const newStatus = s.status === "Active" ? "Inactive" : "Active";
    try {
      await api.patch(`/staff/${s.id}/status`, { status: newStatus });
      toast({
        title: `User ${newStatus === "Active" ? "activated" : "deactivated"}`,
        description: fullName(s),
        duration: 3000,
      });
      setDeactivateTarget(null);
      loadStaff();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update status.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (s) => {
    try {
      await api.delete(`/staff/${s.id}`);
      toast({
        title: "User deleted",
        description: `${fullName(s)} was removed from the directory.`,
        duration: 3000,
      });
      setDeleteTarget(null);
      loadStaff();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Could not delete user.",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (s) => {
    const newPassword = generatePassword();
    try {
      await api.patch(`/staff/${s.id}/reset-password`, {
        password: newPassword,
      });
      toast({
        title: "Password reset",
        description: `New password generated for ${fullName(s)}.`,
        duration: 3000,
      });
      setCredentialsDialog({ email: s.email, password: newPassword });
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Could not reset password.",
        variant: "destructive",
      });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filtered = staff.filter((s) => {
    const matchesSearch =
      !search ||
      fullName(s).toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.employee_id?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const sorted = sortField
    ? [...filtered].sort((a, b) => {
        const accessor = SORT_ACCESSORS[sortField];
        const va = accessor(a);
        const vb = accessor(b);
        if (va < vb) return sortDirection === "asc" ? -1 : 1;
        if (va > vb) return sortDirection === "asc" ? 1 : -1;
        return 0;
      })
    : filtered;

  const exportStaff = (format) => {
    const headers = [
      "#",
      "Full Name",
      "Email",
      "Phone",
      "Role",
      "Department",
      "Work Location",
      "Employee ID",
      "Status",
    ];
    const rows = sorted.map((s, i) => [
      i + 1,
      fullName(s),
      s.email,
      s.phone || "",
      ROLE_LABELS[s.role] || s.role,
      s.department ? s.department.replace(/_/g, " ") : "",
      s.work_location || "Head Office",
      s.employee_id || "",
      s.status || "Active",
    ]);
    const fn = `users_export_${new Date().toISOString().slice(0, 10)}`;
    if (format === "pdf") {
      exportToPDF(
        fn,
        "EIC — User Directory Export",
        headers,
        rows,
        [0.4, 1.8, 2.2, 1.2, 1.5, 1.4, 1.4, 1, 0.8],
      );
    } else {
      exportToCSV(fn, headers, rows);
    }
    toast({
      title: `Exported ${sorted.length} users`,
      description: `Downloaded as ${format.toUpperCase()}.`,
      duration: 3000,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {staff.length} user(s) in the directory
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="gap-1.5"
        >
          <UserPlus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportButton onExport={exportStaff} disabled={sorted.length === 0} />
      </div>

      {sorted.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-8">#</TableHead>
                  <TableHead className="pl-4">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      User{" "}
                      <SortIcon
                        active={sortField === "name"}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("role")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Role{" "}
                      <SortIcon
                        active={sortField === "role"}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <button
                      onClick={() => handleSort("department")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Department{" "}
                      <SortIcon
                        active={sortField === "department"}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <button
                      onClick={() => handleSort("phone")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Phone{" "}
                      <SortIcon
                        active={sortField === "phone"}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Status{" "}
                      <SortIcon
                        active={sortField === "status"}
                        direction={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-4 text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                          {(fullName(s) || s.email || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fullName(s) || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {ROLE_LABELS[s.role] || s.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      <div>
                        {s.department ? s.department.replace(/_/g, " ") : "—"}
                      </div>
                      <div className="text-[10px]">
                        {s.work_location || "Head Office"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {s.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          s.status === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {s.status || "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(s)}>
                            <Eye className="w-4 h-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(s);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleResetPassword(s)}
                          >
                            <KeyRound className="w-4 h-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {s.status === "Active" ? (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeactivateTarget(s)}
                            >
                              <UserX className="w-4 h-4" /> Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-emerald-600 focus:text-emerald-600"
                              onClick={() => toggleStatus(s)}
                            >
                              <UserCheck className="w-4 h-4" /> Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <StaffFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initial={editing}
        saving={saving}
      />

      <StaffDetailsDialog staff={viewing} onClose={() => setViewing(null)} />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && fullName(deleteTarget)} will be permanently
              removed from the directory, along with their login account. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={() => setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget && fullName(deactivateTarget)} will be marked as
              inactive and won't be able to log in. You can reactivate them at
              any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => toggleStatus(deactivateTarget)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!credentialsDialog}
        onOpenChange={() => setCredentialsDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login credentials</AlertDialogTitle>
            <AlertDialogDescription>
              Copy these and share them with the user directly (in person,
              phone, or a secure message). They won't be shown again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="p-3 rounded-lg bg-muted font-mono text-sm space-y-1">
              <div>Email: {credentialsDialog?.email}</div>
              <div>Password: {credentialsDialog?.password}</div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                navigator.clipboard.writeText(
                  `Email: ${credentialsDialog?.email}\nPassword: ${credentialsDialog?.password}`,
                );
                toast({ title: "Copied to clipboard", duration: 2000 });
              }}
            >
              <Copy className="w-4 h-4 mr-1.5" /> Copy & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
