import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CheckCircle2,
  ArrowRight,
  Users,
  Shield,
  Settings,
  TrendingUp,
} from "lucide-react";
import { STATUS_COLORS, formatCurrency } from "@/lib/roleConfig";
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

export default function AdminDashboard() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [claimsRes, usersRes, staffRes] = await Promise.all([
          api.get("/claims"),
          api.get("/users"),
          api.get("/staff"),
        ]);
        if (cancelled) return;
        setClaims(claimsRes.data.data || []);
        setUsers(usersRes.data.data || []);
        setStaff(staffRes.data.data || []);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalAmount = claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
  const approvedAmount = claims
    .filter((c) => c.status === "Approved")
    .reduce((sum, c) => sum + (c.claim_amount || 0), 0);

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

  const statusData = [
    "Submitted",
    "Under_Review",
    "Approved",
    "Rejected",
    "Returned",
    "Escalated",
    "Additional_Info_Requested",
  ]
    .map((s) => ({
      name: s.replace(/_/g, " "),
      count: claims.filter((c) => c.status === s).length,
    }))
    .filter((d) => d.count > 0);

  // eslint-disable-next-line no-unused-vars
  const typeData = [
    "Motor",
    "Fire",
    "Marine",
    "Engineering",
    "Liability",
    "Agriculture",
    "Life",
    "Health",
    "Other",
  ]
    .map((t) => ({
      name: t,
      count: claims.filter((c) => c.insurance_type === t).length,
    }))
    .filter((d) => d.count > 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> System Administration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.full_name || "Admin"} · System Administrator
        </p>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 bg-blue-50">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">{claims.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Claims</p>
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
              {users.length} logged in · {staff.length} in directory
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-amber-600 bg-amber-50">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total Claim Value
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(approvedAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Approved Value</p>
          </CardContent>
        </Card>
      </div>

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
                  Invite users, assign roles & departments
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
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Claims by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
                No claims data yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Users by Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roleData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
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
      </div>

      {/* Recent Claims */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold">Recent Claims</CardTitle>
          <Link
            to="/claims/all"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {claims.length > 0 ? (
            <div className="space-y-2">
              {claims.slice(0, 6).map((claim) => (
                <Link
                  key={claim.id}
                  to={`/claims/${claim.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {claim.claim_reference}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {claim.claimant_name} · {claim.insurance_type} ·{" "}
                        {claim.current_department
                          ? claim.current_department.replace(/_/g, " ")
                          : claim.originating_office ||
                            claim.workflow_type?.replace(/_/g, " ") ||
                            "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {formatCurrency(claim.claim_amount)}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${STATUS_COLORS[claim.status]}`}
                    >
                      {claim.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No claims yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
