import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  ArrowRight,
  Users,
  Shield,
  Settings,
  TrendingUp,
  ShieldCheck,
  Workflow,
  SlidersHorizontal,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  formatCurrency,
  CLAIM_DIVISION_STATUS_LIST,
  GIO_STATUS_LIST,
} from "@/lib/roleConfig";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
];

const APPROVAL_CRITICAL_ROLES = [
  "director",
  "chief_of_gio",
  "ceo",
  "claim_manager",
  "gio_claim_manager",
];

export default function AdminDashboard() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [workflowStages, setWorkflowStages] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [failedLoginsToday, setFailedLoginsToday] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [staffName, setStaffName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
          claimsRes,
          usersRes,
          staffRes,
          stagesRes,
          thresholdsRes,
          failedLoginsRes,
          recentActivityRes,
        ] = await Promise.all([
          api.get("/claims"),
          api.get("/users"),
          api.get("/staff"),
          api.get("/workflow-stages?is_active=true"),
          api.get("/approval-thresholds"),
          api
            .get(
              `/audit/access-logs?action=LOGIN_FAILED&from=${todayStart.toISOString()}&limit=1`,
            )
            .catch(() => null), // audit endpoint is optional — don't block the dashboard if it's unavailable
          api.get("/audit/data-changes?limit=6").catch(() => null),
        ]);
        if (cancelled) return;

        setClaims(claimsRes.data.data || []);
        setUsers(usersRes.data.data || []);
        setStaff(staffRes.data.data || []);
        setWorkflowStages(stagesRes.data.data || []);
        setThresholds(thresholdsRes.data.data || []);
        setFailedLoginsToday(failedLoginsRes?.data?.total ?? 0);
        setRecentActivity(recentActivityRes?.data?.data || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The User (login) table has no name field — the real name lives on
  // StaffMember, matched by email.
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(
          `/staff?email=${encodeURIComponent(user.email)}`,
        );
        const list = res.data?.data || [];
        if (!cancelled && list.length > 0) {
          const s = list[0];
          const name = [s.first_name, s.middle_name].filter(Boolean).join(" ");
          if (name) setStaffName(name);
        }
      } catch {
        // non-fatal
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const claimDivisionClaims = claims.filter(
    (c) => c.workflow_type !== "GIO_Approval",
  );
  const gioClaims = claims.filter((c) => c.workflow_type === "GIO_Approval");

  const claimDivisionAmount = claimDivisionClaims.reduce(
    (sum, c) => sum + (c.claim_amount || 0),
    0,
  );
  const gioAmount = gioClaims.reduce(
    (sum, c) => sum + (c.claim_amount || 0),
    0,
  );

  // Role distribution
  const roleBreakdown = {};
  users.forEach((u) => {
    const r = u.role || "unknown";
    roleBreakdown[r] = (roleBreakdown[r] || 0) + 1;
  });
  const roleData = Object.entries(roleBreakdown).map(([name, count]) => ({
    name,
    count,
  }));

  // where a status actually has claims in it.
  const cdStatusCounts = CLAIM_DIVISION_STATUS_LIST.map((s) => ({
    name: s.replace(/_/g, " "),
    count: claimDivisionClaims.filter((c) => c.status === s).length,
  })).filter((d) => d.count > 0);

  const gioStatusCounts = GIO_STATUS_LIST.map((s) => ({
    name: s.replace(/_/g, " "),
    count: gioClaims.filter((c) => c.status === s).length,
  })).filter((d) => d.count > 0);

  const activeStageCount = workflowStages.length;
  const activeThresholdCount = thresholds.filter((t) => t.is_active).length;

  const lockedAccountsCount = users.filter(
    (u) => u.locked_until && new Date(u.locked_until) > new Date(),
  ).length;

  const staffWithoutLogin = staff.filter(
    (s) => !users.some((u) => u.email === s.email),
  );

  const rolesWithNoActiveUser = APPROVAL_CRITICAL_ROLES.filter(
    (role) => !users.some((u) => u.role === role && u.is_active !== false),
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> System Administration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {staffName || user?.email || "Admin"} · System Administrator
        </p>
      </div>

      {/* System health strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/admin/workflow">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <Workflow className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {activeStageCount} active stages
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Workflow configuration
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/thresholds">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {activeThresholdCount} active thresholds
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Approval routing rules
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/audit">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  failedLoginsToday > 0 ? "bg-red-50" : "bg-emerald-50"
                }`}
              >
                <AlertTriangle
                  className={`w-4 h-4 ${
                    failedLoginsToday > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {failedLoginsToday} failed login
                  {failedLoginsToday === 1 ? "" : "s"} today
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Security audit
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Overview stats — Claim Division / GIO split */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 bg-slate-100">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">{claimDivisionClaims.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Claim Division Claims
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 bg-purple-50">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">{gioClaims.length}</p>
            <p className="text-xs text-muted-foreground mt-1">GIO Claims</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">
              {staff.filter((s) => s.status === "Active").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Active Users</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              {users.length} logins · {staff.length} in directory
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  lockedAccountsCount > 0
                    ? "text-red-600 bg-red-50"
                    : "text-emerald-600 bg-emerald-50"
                }`}
              >
                <Lock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">{lockedAccountsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Locked Accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Value split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="w-5 h-5 text-slate-600" />
              <span className="text-sm text-muted-foreground">
                Claim Division Value
              </span>
            </div>
            <p className="text-xl font-bold">
              {formatCurrency(claimDivisionAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-muted-foreground">GIO Value</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(gioAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration gaps */}
      {(rolesWithNoActiveUser.length > 0 || staffWithoutLogin.length > 0) && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Configuration
              Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rolesWithNoActiveUser.map((role) => (
              <div
                key={role}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  No active user assigned to{" "}
                  <strong className="text-foreground">
                    {role.replace(/_/g, " ")}
                  </strong>
                </span>
                <Link
                  to="/admin/users"
                  className="text-xs text-primary hover:underline"
                >
                  Fix
                </Link>
              </div>
            ))}
            {staffWithoutLogin.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {staffWithoutLogin.length} staff record(s) with no matching
                  login account
                </span>
                <Link
                  to="/admin/users"
                  className="text-xs text-primary hover:underline"
                >
                  Review
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/admin/users" className="block">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">User Management</p>
                <p className="text-xs text-muted-foreground">
                  Create users, assign roles & departments
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/thresholds" className="block">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Settings className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Approval Thresholds</p>
                <p className="text-xs text-muted-foreground">
                  Configure workflow routing rules
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/system-settings" className="block">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                <Settings className="w-6 h-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">System Settings</p>
                <p className="text-xs text-muted-foreground">
                  Audit, document, and security policy
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/audit" className="block">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Audit Log</p>
                <p className="text-xs text-muted-foreground">
                  Access history and data-change trail
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Claim Division — Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cdStatusCounts.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={cdStatusCounts}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="hsl(217, 71%, 35%)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No Claim Division claims yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              GIO — Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gioStatusCounts.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={gioStatusCounts}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No GIO claims yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Users by Role</CardTitle>
        </CardHeader>
        <CardContent>
          {roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="count"
                  label={({ name, count }) => `${name} (${count})`}
                >
                  {roleData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              No users yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Admin Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold">
            Recent Admin Activity
          </CardTitle>
          <Link
            to="/audit"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View full log <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {event.action?.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.actorName || event.actorId || "—"} ·{" "}
                        {event.entityType || "—"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
