import { useState, useEffect, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  STATUS_COLORS,
  formatCurrency,
  ROLE_LABELS,
  ROLE_TO_APPROVER_LABEL,
  APPROVER_ROLE_MAP,
  CLAIM_DIVISION_STATUS_LIST,
  GIO_STATUS_LIST,
  INSURANCE_TYPES,
  getWorkflowScopeForRole,
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

const COMPLETED_STATUSES = new Set([
  "Approved",
  "Completed",
  "Claim_Closed",
  "Closed",
  "Payment_Completed",
  "Payment_Document_Approved",
  "Forwarded_to_Finance",
]);

const EXCLUDED_FROM_IN_PROGRESS = new Set([
  "Draft",
  "Rejected",
  ...COMPLETED_STATUSES,
]);

const DONE_FOR_PENDING = new Set(["Draft", "Rejected", ...COMPLETED_STATUSES]);

function isGio(claim) {
  return claim?.workflow_type === "GIO_Approval";
}

function isClaimDivision(claim) {
  return !isGio(claim);
}

function splitCdGio(list) {
  return {
    cd: list.filter(isClaimDivision).length,
    gio: list.filter(isGio).length,
  };
}

function isAssignedToMe(claim, user) {
  if (!user?.id || !claim) return false;

  if (claim.current_approver_id === user.id) return true;
  if (claim.current_owner_id === user.id) return true;

  const role = user.role;
  const myLabel = ROLE_TO_APPROVER_LABEL?.[role];
  const mapped = APPROVER_ROLE_MAP?.[claim.current_approver_role];

  if (claim.current_approver_role === role) return true;
  if (myLabel && claim.current_approver_role === myLabel) return true;
  if (mapped === role) return true;

  return false;
}

function isCompletedClaim(claim) {
  if (!claim) return false;
  if (COMPLETED_STATUSES.has(claim.status)) return true;
  const stage = (claim.workflow_stage || "").trim();
  if (stage === "Claim Closed" || stage === "GIO Case Closure") return true;
  return false;
}

function isInProgressClaim(claim) {
  if (!claim) return false;
  if (isCompletedClaim(claim)) return false;
  if (EXCLUDED_FROM_IN_PROGRESS.has(claim.status)) return false;
  return Boolean(claim.status || claim.workflow_stage);
}

function resolveScope(role) {
  const fromConfig = getWorkflowScopeForRole?.(role);
  if (
    fromConfig === "GIO_Approval" ||
    fromConfig === "Claim_Division" ||
    fromConfig === "all"
  ) {
    return fromConfig;
  }
  return "all";
}

/** Shared footer: Claim Division + GIO counts when director/admin/ceo */
function CdGioBreakdown({ list, show }) {
  if (!show) return null;
  const { cd, gio } = splitCdGio(list);
  return (
    <div className="mt-3 pt-3 border-t flex flex-col gap-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Claim Division</span>
        <span className="font-semibold tabular-nums">{cd}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">GIO</span>
        <span className="font-semibold tabular-nums text-purple-700">
          {gio}
        </span>
      </div>
    </div>
  );
}

export default function ApproverDashboard() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(null);

  const scope = useMemo(() => resolveScope(user?.role), [user?.role]);
  const showSplit = scope === "all";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;
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
    if (scope === "GIO_Approval") return GIO_STATUS_LIST || [];
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

  const myPending = useMemo(() => {
    if (!user) return [];
    return claims.filter(
      (c) =>
        isAssignedToMe(c, user) &&
        !DONE_FOR_PENDING.has(c.status) &&
        !isCompletedClaim(c),
    );
  }, [claims, user]);

  const aging = useMemo(() => {
    return myPending.filter((c) => {
      const dateVal = c.submission_date || c.createdAt || c.created_date;
      if (!dateVal || !now) return false;
      const days = (now - new Date(dateVal).getTime()) / 86400000;
      return days > 3;
    });
  }, [myPending, now]);

  const completedClaims = useMemo(
    () => claims.filter((c) => isCompletedClaim(c)),
    [claims],
  );

  const inProgressClaims = useMemo(
    () => claims.filter((c) => isInProgressClaim(c)),
    [claims],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const allClaims = claims;
  const claimDivisionClaims = allClaims.filter(isClaimDivision);
  const gioClaims = allClaims.filter(isGio);
  const totalAmount = allClaims.reduce(
    (sum, c) => sum + (c.claim_amount || 0),
    0,
  );
  const claimDivisionAmount = claimDivisionClaims.reduce(
    (sum, c) => sum + (c.claim_amount || 0),
    0,
  );
  const gioAmount = gioClaims.reduce(
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ROLE_LABELS[user?.role] || "Approver"} Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.full_name || user?.email || "User"} ·{" "}
            {ROLE_LABELS[user?.role] || "Approver"} · {scopeLabel}
          </p>
        </div>
        <Link
          to="/claims"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <ClipboardCheck className="w-4 h-4" />
          My claims ({myPending.length})
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* My Pending Actions */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 bg-purple-50">
                <ClipboardCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">My Pending Actions</p>
            <p className="text-2xl font-bold mt-0.5">{myPending.length}</p>
            <CdGioBreakdown list={myPending} show={showSplit} />
          </CardContent>
        </Card>

        {/* Aging */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-red-600 bg-red-50">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Aging (&gt;3 days)</p>
            <p className="text-2xl font-bold mt-0.5">{aging.length}</p>
            <CdGioBreakdown list={aging} show={showSplit} />
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold mt-0.5">
              {completedClaims.length}
            </p>
            <CdGioBreakdown list={completedClaims} show={showSplit} />
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 bg-blue-50">
                <Loader2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold mt-0.5">
              {inProgressClaims.length}
            </p>
            <CdGioBreakdown list={inProgressClaims} show={showSplit} />
          </CardContent>
        </Card>

        {/* Total claims */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 bg-slate-50">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Total claims</p>
            <p className="text-2xl font-bold mt-0.5">{allClaims.length}</p>
            <CdGioBreakdown list={allClaims} show={showSplit} />
          </CardContent>
        </Card>
      </div>

      {showSplit ? (
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
      ) : (
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
      )}

      <Card className="border-0 shadow-sm border-l-4 border-l-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Claims Awaiting Your Action
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myPending.length > 0 ? (
            <div className="space-y-2">
              {myPending.slice(0, 5).map((claim) => {
                const gio = isGio(claim);
                return (
                  <Link
                    key={claim.id}
                    to={`/claims/${claim.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          gio ? "bg-purple-50" : "bg-blue-50"
                        }`}
                      >
                        <Clock
                          className={`w-4 h-4 ${
                            gio ? "text-purple-600" : "text-blue-600"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {claim.claim_reference}
                          </p>
                          {showSplit && (
                            <Badge
                              variant="secondary"
                              className={`text-[9px] ${
                                gio
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {gio ? "GIO" : "Claim Division"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {claim.claimant_name} · {claim.insurance_type} ·{" "}
                          {formatCurrency(claim.claim_amount)}
                          {claim.workflow_stage
                            ? ` · ${claim.workflow_stage}`
                            : ""}
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
              No claims pending your action
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
