import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Search,
  FileText,
  AlertTriangle,
  Clock,
  Filter,
  X,
} from "lucide-react";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  formatCurrency,
  INSURANCE_TYPES,
  isClaimOverdue,
  getClaimAging,
  DEPARTMENT_OPTIONS,
  CLAIM_DIVISION_STATUS_LIST,
  GIO_STATUS_LIST,
  getWorkflowScopeForRole,
} from "@/lib/roleConfig";

const PAGE_SIZE = 25;

const PERIOD_OPTIONS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

function getClaimDate(c) {
  return c.createdAt || c.created_date || c.submission_date || c.date_received;
}

function inPeriod(c, period) {
  if (!period || period === "all") return true;
  const d = getClaimDate(c);
  if (!d) return false;
  const now = new Date();
  const start = new Date(now);
  if (period === "30d") start.setDate(start.getDate() - 30);
  else if (period === "90d") start.setDate(start.getDate() - 90);
  else if (period === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return new Date(d) >= start;
}

function isTerminalStatus(status) {
  return [
    "Claim_Closed",
    "Closed",
    "Completed",
    "Approved",
    "Rejected",
  ].includes(status);
}

export default function ClaimSearch() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [period, setPeriod] = useState("90d"); // default: last 90 days
  const [activeOnly, setActiveOnly] = useState(true); // default: hide closed
  const [page, setPage] = useState(1);

  const workflowScope = getWorkflowScopeForRole(user?.role);
  const isScopedAll = workflowScope === "all";
  const isScopedGio = workflowScope === "GIO_Approval";

  // Initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/claims");
        if (!cancelled) setClaims(res.data.data || []);
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

  const filtered = claims.filter((c) => {
    const claimWorkflowType = c.workflow_type || "Claim_Division";

    const matchesScope = isScopedAll || claimWorkflowType === workflowScope;

    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.claim_reference?.toLowerCase().includes(q) ||
      c.claim_number?.toLowerCase().includes(q) ||
      c.claimant_name?.toLowerCase().includes(q) ||
      c.policy_number?.toLowerCase().includes(q) ||
      c.plate_number?.toLowerCase().includes(q) ||
      c.submitted_by_name?.toLowerCase().includes(q) ||
      c.workflow_stage?.toLowerCase().includes(q) ||
      c.originating_office?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesType = typeFilter === "all" || c.insurance_type === typeFilter;
    const matchesDepartment =
      !isScopedAll ||
      departmentFilter === "all" ||
      c.current_department === departmentFilter ||
      claimWorkflowType === departmentFilter;
    const matchesOverdue = !showOverdueOnly || isClaimOverdue?.(c);
    const matchesPeriod = inPeriod(c, period);
    const matchesActive = !activeOnly || !isTerminalStatus(c.status);

    return (
      matchesScope &&
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesDepartment &&
      matchesOverdue &&
      matchesPeriod &&
      matchesActive
    );
  });

  // Newest first
  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(getClaimDate(a) || 0).getTime();
    const db = new Date(getClaimDate(b) || 0).getTime();
    return db - da;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = sorted.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, sorted.length);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDepartmentFilter("all");
    setShowOverdueOnly(false);
    setPeriod("90d");
    setActiveOnly(true);
    setPage(1);
  };

  const hasActiveFilters =
    !!search ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    departmentFilter !== "all" ||
    showOverdueOnly ||
    period !== "90d" ||
    !activeOnly;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          Search & Monitor Claims
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isScopedAll
            ? "Find and monitor claims across GIO, Claim Division, and workflow stages"
            : isScopedGio
              ? "Find and monitor your GIO cases"
              : "Find and monitor your Claim Division claims"}
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Claim ref, claim no., or plate (best) — or name, policy, office, stage…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-11"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-1.5"
        >
          <Filter className="w-4 h-4" /> Filters
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="w-4 h-4" /> Clear
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <Card className="border-0 shadow-sm">
          <CardContent
            className={`p-4 grid grid-cols-2 gap-3 ${
              isScopedAll ? "md:grid-cols-4" : "md:grid-cols-2"
            }`}
          >
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Status
              </label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>

                  {(isScopedAll || !isScopedGio) && (
                    <SelectGroup>
                      <SelectLabel>
                        {isScopedAll ? "Claim Division" : undefined}
                      </SelectLabel>
                      <SelectItem value="Draft">Draft</SelectItem>
                      {CLAIM_DIVISION_STATUS_LIST.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}

                  {(isScopedAll || isScopedGio) && (
                    <SelectGroup>
                      <SelectLabel>
                        {isScopedAll ? "GIO Case" : undefined}
                      </SelectLabel>
                      {GIO_STATUS_LIST.filter(
                        (s) =>
                          !isScopedAll ||
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

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Insurance Type
              </label>
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {INSURANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isScopedAll && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Department / Workflow
                </label>
                <Select
                  value={departmentFilter}
                  onValueChange={(v) => {
                    setDepartmentFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="GIO_Approval">GIO Case</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-2 md:col-span-4 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOverdueOnly}
                  onChange={(e) => {
                    setShowOverdueOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded"
                />
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Show overdue claims only
              </label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Period
              </label>
              <Select
                value={period}
                onValueChange={(v) => {
                  setPeriod(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => {
                    setActiveOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded"
                />
                Active only (hide closed / rejected)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {sorted.length === 0
            ? "No claims found"
            : `Showing ${showingFrom}–${showingTo} of ${sorted.length} claims`}
          {activeOnly ? " · active only" : ""}
          {period !== "all"
            ? ` · ${PERIOD_OPTIONS.find((p) => p.value === period)?.label || ""}`
            : ""}
        </p>
      </div>

      {/* Results */}
      {sorted.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No claims match your search criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {pageRows.map((c) => {
            const overdue = isClaimOverdue?.(c);
            const aging = getClaimAging?.(c) || 0;

            return (
              <Link key={c.id} to={`/claims/${c.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {c.claim_reference}
                        </span>
                        <Badge
                          className={`text-[10px] ${STATUS_COLORS[c.status]}`}
                        >
                          {c.status?.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          className={`text-[10px] ${PRIORITY_COLORS[c.priority]}`}
                        >
                          {c.priority}
                        </Badge>
                        {overdue && (
                          <Badge className="text-[10px] bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3 mr-0.5" />
                            Overdue
                          </Badge>
                        )}
                        {c.workflow_stage && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.workflow_stage}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{c.claimant_name}</span>
                        <span>·</span>
                        <span>{c.insurance_type}</span>
                        {c.plate_number && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{c.plate_number}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {c.current_department
                            ? c.current_department.replace(/_/g, " ")
                            : c.workflow_type
                              ? c.workflow_type.replace(/_/g, " ")
                              : c.originating_office || "—"}
                        </span>
                        {aging > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {aging}d
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(c.claim_amount)}
                      </p>
                      {c.current_owner_name && (
                        <p className="text-[10px] text-muted-foreground">
                          {c.current_owner_name}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      {sorted.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
