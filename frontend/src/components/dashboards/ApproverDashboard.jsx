import { useState, useEffect, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  STATUS_COLORS,
  formatCurrency,
  ROLE_LABELS,
  ROLE_TO_APPROVER_LABEL,
  CLAIM_DIVISION_STATUS_LIST,
  GIO_STATUS_LIST,
  INSURANCE_TYPES,
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
import ClaimWorkStatus from "@/components/dashboards/ClaimWorkStatus";

const PIE_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#f97316",
  "#8b5cf6",
];

const GIO_ROLES = new Set([
  "gio_claim_adjuster",
  "gio_claim_manager",
  "chief_of_gio",
]);

const CLAIM_DIVISION_ROLES = new Set([
  "secretary",
  "claim_adjuster",
  "surveyor",
  "principal_claim_officer",
  "claim_manager",
]);

/** director / admin / ceo → both */
function resolveScope(role) {
  if (role === "director" || role === "admin" || role === "ceo") return "all";
  if (GIO_ROLES.has(role)) return "GIO_Approval";
  if (CLAIM_DIVISION_ROLES.has(role)) return "Claim_Division";
  return "all";
}

export default function ApproverDashboard() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(null);

  const scope = useMemo(() => resolveScope(user?.role), [user?.role]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const q =
          scope === "GIO_Approval"
            ? "?workflow_type=GIO_Approval"
            : scope === "Claim_Division"
              ? "?workflow_type=Claim_Division"
              : "";
        const res = await api.get(`/claims${q}`);
        if (cancelled) return;
        let data = res.data.data || [];
        if (scope === "GIO_Approval") {
          data = data.filter((c) => c.workflow_type === "GIO_Approval");
        } else if (scope === "Claim_Division") {
          data = data.filter((c) => c.workflow_type !== "GIO_Approval");
        }
        setClaims(data);
        setNow(Date.now());
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const statusList = useMemo(() => {
    if (scope === "GIO_Approval") {
      return GIO_STATUS_LIST || [];
    }
    if (scope === "Claim_Division") {
      return ["Draft", ...(CLAIM_DIVISION_STATUS_LIST || [])];
    }
    return [
      ...new Set([
        "Draft",
        ...(CLAIM_DIVISION_STATUS_LIST || []),
        ...(GIO_STATUS_LIST || []),
      ]),
    ];
  }, [scope]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const myApproverLabel = ROLE_TO_APPROVER_LABEL[user?.role];

  const myPending = claims.filter((c) => {
    const isMine =
      c.current_approver_role === myApproverLabel ||
      c.current_approver_role === user?.role ||
      c.current_approver_id === user?.id ||
      c.current_owner_id === user?.id;

    if (!isMine) return false;

    const done = [
      "Approved",
      "Rejected",
      "Closed",
      "Claim_Closed",
      "Completed",
    ];
    if (done.includes(c.status)) return false;

    const pendingStatuses = [
      "Submitted",
      "Under_Review",
      "Escalated",
      "Principal_Review_Pending",
      "Claim_Manager_Review_Pending",
      "Director_Decision_Pending",
      "Chief_of_GIO_Approval_Pending",
      "CEO_Approval_Pending",
      "Notification_Received",
      "Claim_Registered",
      "Pending_Assignment",
      "Assigned_to_Principal_of_Claim",
      "Assigned_to_Claim_Adjuster",
      "Case_Received",
      "Pending_GIO_Assignment",
      "Assigned_to_GIO_Claim_Adjuster",
      "Document_Review_Pending",
      "GIO_Review_In_Progress",
    ];

    return pendingStatuses.includes(c.status) || Boolean(c.workflow_stage);
  });

  const aging = myPending.filter((c) => {
    const dateVal = c.submission_date || c.createdAt || c.created_date;
    if (!dateVal || !now) return false;
    const days = (now - new Date(dateVal).getTime()) / 86400000;
    return days > 3;
  });

  const allClaims = claims;
  const approved = allClaims.filter((c) => c.status === "Approved");
  const rejected = allClaims.filter((c) => c.status === "Rejected");
  const totalAmount = allClaims.reduce(
    (sum, c) => sum + (c.claim_amount || 0),
    0,
  );

  const statusData = statusList
    .map((s) => ({
      name: s.replace(/_/g, " "),
      count: allClaims.filter((c) => c.status === s || c.workflow_stage === s)
        .length,
    }))
    .filter((d) => d.count > 0);

  const typeData = INSURANCE_TYPES.map((type) => ({
    name: type,
    count: allClaims.filter((claim) => claim.insurance_type === type).length,
  })).filter((item) => item.count > 0);

  const scopeLabel =
    scope === "GIO_Approval"
      ? "GIO"
      : scope === "Claim_Division"
        ? "Claim Division"
        : "GIO & Claim Division";

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ROLE_LABELS[user?.role] || "Approver"} Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.full_name || "User"} ·{" "}
            {ROLE_LABELS[user?.role] || "Approver"} · {scopeLabel}
          </p>
        </div>
        <Link
          to="/approvals"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <ClipboardCheck className="w-4 h-4" /> Go to Approvals (
          {myPending.length})
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "My Pending Actions",
            value: myPending.length,
            icon: ClipboardCheck,
            color: "text-purple-600 bg-purple-50",
          },
          {
            label: "Aging (>3 days)",
            value: aging.length,
            icon: AlertTriangle,
            color: "text-red-600 bg-red-50",
          },
          {
            label: "Total Claims",
            value: allClaims.length,
            icon: FileText,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Approved",
            value: approved.length,
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "Rejected",
            value: rejected.length,
            icon: XCircle,
            color: "text-red-600 bg-red-50",
          },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">
              Total Claim Value
            </span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm border-l-4 border-l-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Claims Awaiting Your Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myPending.length > 0 ? (
            <div className="space-y-2">
              {myPending.slice(0, 5).map((claim) => {
                const isGio = claim.workflow_type === "GIO_Approval";
                return (
                  <Link
                    key={claim.id}
                    to={`/claims/${claim.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isGio ? "bg-purple-50" : "bg-blue-50"
                        }`}
                      >
                        <Clock
                          className={`w-4 h-4 ${
                            isGio ? "text-purple-600" : "text-blue-600"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {claim.claim_reference}
                          </p>
                          {scope === "all" && (
                            <Badge
                              variant="secondary"
                              className={`text-[9px] ${
                                isGio
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {isGio ? "GIO" : "Claim Division"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {claim.claimant_name} · {claim.insurance_type} ·{" "}
                          {formatCurrency(claim.claim_amount)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        STATUS_COLORS[claim.status] || ""
                      }`}
                    >
                      {claim.status?.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No claims pending your approval
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Claims by Status
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                ({scopeLabel})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusData}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-25}
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
                No claims data yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Claims by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="count"
                    label={({ name, count }) => `${name} (${count})`}
                  >
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No claims data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ClaimWorkStatus
        claims={myPending.length > 0 ? myPending : allClaims.slice(0, 10)}
        userRole={user?.role}
        title="Work Done on Claims Before Reaching You"
      />
    </div>
  );
}
