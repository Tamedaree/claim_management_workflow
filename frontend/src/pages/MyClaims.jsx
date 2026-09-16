import { useState, useEffect, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { FileText, Search, ArrowRight } from "lucide-react";
import {
  STATUS_COLORS,
  formatCurrency,
  CLAIM_DIVISION_STATUS_LIST,
  GIO_STATUS_LIST,
  getWorkflowScopeForRole,
  ROLE_TO_APPROVER_LABEL,
  APPROVER_ROLE_MAP,
} from "@/lib/roleConfig";

function isAssignedToMe(claim, user) {
  if (!user?.id || !claim) return false;

  if (claim.current_approver_id === user.id) return true;
  if (claim.current_owner_id === user.id) return true;
  if (claim.assigned_performer_id === user.id) return true;
  if (claim.submitted_by_id === user.id) return true;

  const role = user.role;
  const myLabel = ROLE_TO_APPROVER_LABEL?.[role];
  const mapped = APPROVER_ROLE_MAP?.[claim.current_approver_role];

  if (claim.current_approver_role === role) return true;
  if (myLabel && claim.current_approver_role === myLabel) return true;
  if (mapped === role) return true;

  return false;
}

export default function MyClaims() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const roleScope = getWorkflowScopeForRole(user?.role);
  const isScopedAll = roleScope === "all";
  const isScopedGio = roleScope === "GIO_Approval";
  const effectiveWorkflowFilter = isScopedAll ? workflowFilter : roleScope;

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Same idea as ApproverDashboard: load scope, then filter "mine"
        const q =
          roleScope === "GIO_Approval"
            ? "?workflow_type=GIO_Approval"
            : roleScope === "Claim_Division"
              ? "?workflow_type=Claim_Division"
              : "";

        const res = await api.get(`/claims${q}`);
        let data = res.data.data || [];

        if (roleScope === "GIO_Approval") {
          data = data.filter((c) => c.workflow_type === "GIO_Approval");
        } else if (roleScope === "Claim_Division") {
          data = data.filter((c) => c.workflow_type !== "GIO_Approval");
        }

        // Keep only claims linked to this user (same rules as dashboard pending)
        data = data.filter((c) => isAssignedToMe(c, user));

        if (!cancelled) setClaims(data);
      } catch {
        if (!cancelled) setClaims([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, roleScope]);

  const handleWorkflowChange = (value) => {
    setWorkflowFilter(value);
    setStatusFilter("all");
  };

  const filtered = useMemo(() => {
    return claims.filter((c) => {
      const claimWorkflowType = c.workflow_type || "Claim_Division";

      const matchSearch =
        !search ||
        c.claim_reference?.toLowerCase().includes(search.toLowerCase()) ||
        c.claimant_name?.toLowerCase().includes(search.toLowerCase());

      const matchWorkflow =
        effectiveWorkflowFilter === "all" ||
        (effectiveWorkflowFilter === "GIO_Approval"
          ? claimWorkflowType === "GIO_Approval"
          : claimWorkflowType !== "GIO_Approval");

      const matchStatus = statusFilter === "all" || c.status === statusFilter;

      return matchSearch && matchWorkflow && matchStatus;
    });
  }, [claims, search, effectiveWorkflowFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isScopedGio ? "My GIO Cases" : "My Claims"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {claims.length} claim(s) assigned or linked to you
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by reference or claimant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isScopedAll && (
          <Select value={workflowFilter} onValueChange={handleWorkflowChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Claim type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Claim Types</SelectItem>
              <SelectItem value="Claim_Division">Claim Division</SelectItem>
              <SelectItem value="GIO_Approval">GIO Case</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>

            {(effectiveWorkflowFilter === "all" ||
              effectiveWorkflowFilter === "Claim_Division") && (
              <SelectGroup>
                <SelectLabel>
                  {effectiveWorkflowFilter === "all"
                    ? "Claim Division"
                    : undefined}
                </SelectLabel>
                <SelectItem value="Draft">Draft</SelectItem>
                {CLAIM_DIVISION_STATUS_LIST.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {(effectiveWorkflowFilter === "all" ||
              effectiveWorkflowFilter === "GIO_Approval") && (
              <SelectGroup>
                <SelectLabel>
                  {effectiveWorkflowFilter === "all" ? "GIO Case" : undefined}
                </SelectLabel>
                {GIO_STATUS_LIST.map((s) => (
                  <SelectItem key={`gio-${s}`} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {isScopedGio ? "No GIO cases found" : "No claims found"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((claim) => {
            const isGio = claim.workflow_type === "GIO_Approval";
            return (
              <Link key={claim.id} to={`/claims/${claim.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isGio ? "bg-purple-50" : "bg-blue-50"
                        }`}
                      >
                        <FileText
                          className={`w-5 h-5 ${
                            isGio ? "text-purple-600" : "text-blue-600"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">
                            {claim.claim_reference}
                          </p>
                          {isScopedAll && (
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
                          {claim.current_department
                            ? claim.current_department.replace(/_/g, " ")
                            : claim.originating_office || "—"}
                          {claim.workflow_stage
                            ? ` · ${claim.workflow_stage}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-sm font-semibold">
                          {formatCurrency(claim.claim_amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {claim.current_approver_role &&
                          claim.current_approver_role !== "None"
                            ? `At: ${claim.current_approver_role.replace(/_/g, " ")}`
                            : claim.current_owner_name
                              ? `Owner: ${claim.current_owner_name}`
                              : ""}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${STATUS_COLORS[claim.status] || ""}`}
                      >
                        {claim.status?.replace(/_/g, " ")}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
