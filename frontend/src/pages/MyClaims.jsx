import { useState, useEffect } from "react";
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
} from "@/lib/roleConfig";

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

  // Effective workflow filter: scoped roles are locked to their scope
  // regardless of local state; only "all" roles get to pick freely.
  const effectiveWorkflowFilter = isScopedAll ? workflowFilter : roleScope;

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        let data = [];

        // Submitters: secretary, etc.
        if (["secretary", "admin"].includes(user.role)) {
          const res = await api.get(`/claims?submitted_by_id=${user.id}`);
          data = res.data.data || [];
        }
        // Claim / GIO adjusters: assigned or owned
        else if (
          ["claim_adjuster", "gio_claim_adjuster", "surveyor"].includes(
            user.role,
          )
        ) {
          const [a, b] = await Promise.all([
            api
              .get(`/claims?assigned_performer_id=${user.id}`)
              .catch(() => null),
            api.get(`/claims?current_owner_id=${user.id}`).catch(() => null),
          ]);
          const map = new Map();
          [...(a?.data?.data || []), ...(b?.data?.data || [])].forEach((c) =>
            map.set(c.id, c),
          );
          data = Array.from(map.values());
        }
        // Principal / managers: owned or in their scope
        else if (
          [
            "principal_claim_officer",
            "claim_manager",
            "gio_claim_manager",
          ].includes(user.role)
        ) {
          const res = await api
            .get(`/claims?current_owner_id=${user.id}`)
            .catch(() => null);
          data = res?.data?.data || [];
          // optional: also claims they submitted
          const sub = await api
            .get(`/claims?submitted_by_id=${user.id}`)
            .catch(() => null);
          const map = new Map(data.map((c) => [c.id, c]));
          (sub?.data?.data || []).forEach((c) => map.set(c.id, c));
          data = Array.from(map.values());
        }
        // Fallback: anything linked to this user
        else {
          const res = await api.get(`/claims?submitted_by_id=${user.id}`);
          data = res.data.data || [];
        }

        // Client-side safety: role still sees only linked claims
        if (
          ["claim_adjuster", "gio_claim_adjuster", "surveyor"].includes(
            user.role,
          )
        ) {
          data = data.filter(
            (c) =>
              c.assigned_performer_id === user.id ||
              c.current_owner_id === user.id,
          );
        }

        if (!cancelled) setClaims(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleWorkflowChange = (value) => {
    setWorkflowFilter(value);
    setStatusFilter("all");
  };

  const filtered = claims.filter((c) => {
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

  const scopedTotal = claims.filter((c) => {
    const claimWorkflowType = c.workflow_type || "Claim_Division";
    if (isScopedAll) return true;
    return isScopedGio
      ? claimWorkflowType === "GIO_Approval"
      : claimWorkflowType !== "GIO_Approval";
  }).length;

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
            {isScopedAll
              ? "My Claims"
              : isScopedGio
                ? "My GIO Cases"
                : "My Claims"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {scopedTotal}{" "}
            {["claim_adjuster", "gio_claim_adjuster", "surveyor"].includes(
              user?.role,
            )
              ? "claim(s) assigned to you"
              : isScopedGio
                ? "case(s) submitted by you"
                : "claim(s) linked to you"}
          </p>
        </div>
      </div>

      {/* Filters */}
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
                {GIO_STATUS_LIST.filter(
                  (s) =>
                    effectiveWorkflowFilter === "GIO_Approval" ||
                    !CLAIM_DIVISION_STATUS_LIST.includes(s),
                ).map((s) => (
                  <SelectItem key={`gio-${s}`} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
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
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${STATUS_COLORS[claim.status]}`}
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
