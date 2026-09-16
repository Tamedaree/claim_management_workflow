import { useState, useEffect, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Search,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  formatCurrency,
  INSURANCE_TYPES,
  CLAIM_DIVISION_STATUS_LIST,
  GIO_STATUS_LIST,
  getStageDescription,
} from "@/lib/roleConfig";
import EditClaimDialog from "@/components/claims/EditClaimDialog";
import ExportButton from "@/components/ExportButton";

const PAGE_SIZE = 50;

const GIO_ROLES = new Set([
  "gio_claim_adjuster",
  "gio_principal_claim_officer",
  "gio_claim_manager",
  "senior_director",
  "chief_of_gio",
]);

const CLAIM_DIVISION_ROLES = new Set([
  "secretary",
  "claim_adjuster",
  "surveyor",
  "principal_claim_officer",
  "claim_manager",
]);

function resolveScope(role) {
  if (
    role === "director" ||
    role === "admin" ||
    role === "ceo" ||
    role === "senior_director"
  ) {
    // senior_director is GIO-focused in hierarchy; if they should be GIO-only, remove from here
    if (role === "senior_director") return "GIO_Approval";
    return "all";
  }
  if (GIO_ROLES.has(role)) return "GIO_Approval";
  if (CLAIM_DIVISION_ROLES.has(role)) return "Claim_Division";
  return "all";
}

function getSortValue(c, key) {
  switch (key) {
    case "claim_reference":
      return (c.claim_reference || "").toLowerCase();
    case "claim_number":
      return (c.claim_number || "").toLowerCase();
    case "claimant_name":
      return (c.claimant_name || "").toLowerCase();
    case "insurance_type":
      return (c.insurance_type || "").toLowerCase();
    case "workflow_type":
      return c.workflow_type === "GIO_Approval" ? "gio" : "cd";
    case "gio_case_reason":
      return (c.gio_case_reason || "").toLowerCase();
    case "plate_number":
      return (c.plate_number || "").toLowerCase();
    case "workflow_stage":
      return (c.workflow_stage || "").toLowerCase();
    case "claim_amount":
      return Number(c.claim_amount) || 0;
    case "status":
      return (c.status || "").toLowerCase();
    case "priority": {
      const order = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
      return order[c.priority] || 0;
    }
    case "createdAt":
      return new Date(c.createdAt || c.created_date || 0).getTime();
    default:
      return "";
  }
}

function formatReason(reason) {
  if (!reason) return "—";
  return String(reason).replace(/_/g, " ");
}

function SortHeader({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className = "",
}) {
  const active = sortKey === columnKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className="inline-flex items-center gap-1 hover:text-foreground font-medium text-left"
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 shrink-0" />
        )}
      </button>
    </TableHead>
  );
}

export default function AllClaims() {
  const { user } = useOutletContext() || {};
  const { toast } = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [editClaim, setEditClaim] = useState(null);
  const [deleteClaim, setDeleteClaim] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const scope = useMemo(() => resolveScope(user?.role), [user?.role]);
  const showCaseReason = scope === "all" || scope === "GIO_Approval";

  const statusOptions = useMemo(() => {
    if (scope === "GIO_Approval") return GIO_STATUS_LIST || [];
    if (scope === "Claim_Division") return CLAIM_DIVISION_STATUS_LIST || [];
    return [
      ...new Set([
        ...(CLAIM_DIVISION_STATUS_LIST || []),
        ...(GIO_STATUS_LIST || []),
      ]),
    ];
  }, [scope]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const q =
        scope === "GIO_Approval"
          ? "?workflow_type=GIO_Approval"
          : scope === "Claim_Division"
            ? "?workflow_type=Claim_Division"
            : "";
      const res = await api.get(`/claims${q}`);
      let data = res.data.data || [];
      if (scope === "GIO_Approval") {
        data = data.filter((c) => c.workflow_type === "GIO_Approval");
      } else if (scope === "Claim_Division") {
        data = data.filter((c) => c.workflow_type !== "GIO_Approval");
      }
      setClaims(data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load claims.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.role && user === undefined) return;
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
        setStatusFilter("all");
        setReasonFilter("all");
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load claims.",
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
  }, [scope, user?.role, toast, user]);

  const filtered = claims.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      c.claim_reference?.toLowerCase().includes(q) ||
      c.claim_number?.toLowerCase().includes(q) ||
      c.claimant_name?.toLowerCase().includes(q) ||
      c.plate_number?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "all" ||
      c.status === statusFilter ||
      c.workflow_stage === statusFilter;

    const matchType = typeFilter === "all" || c.insurance_type === typeFilter;

    const matchReason =
      reasonFilter === "all" || c.gio_case_reason === reasonFilter;

    return matchSearch && matchStatus && matchType && matchReason;
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = sorted.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, sorted.length);

  const cdCount = sorted.filter(
    (c) => c.workflow_type !== "GIO_Approval",
  ).length;
  const gioCount = sorted.filter(
    (c) => c.workflow_type === "GIO_Approval",
  ).length;

  const confirmDelete = async () => {
    if (!deleteClaim) return;
    setDeleting(true);
    try {
      await api.delete(`/claims/${deleteClaim.id}`);
      toast({
        title: "Claim deleted",
        description: `${deleteClaim.claim_reference} has been removed.`,
      });
      setDeleteClaim(null);
      loadClaims();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete claim.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const buildExportRows = (list) =>
    list.map((c, i) => [
      i + 1,
      c.claim_reference || "",
      c.claim_number || "", // CD + GIO
      c.claimant_name || "",
      c.insurance_type || "",
      c.workflow_type === "GIO_Approval" ? "GIO" : "Claim Division",
      c.workflow_type === "GIO_Approval" ? formatReason(c.gio_case_reason) : "", // GIO only
      (c.originating_office_type || "").replace(/_/g, " "), // CD + GIO
      c.originating_office || "", // CD + GIO
      c.plate_number || "",
      (c.workflow_stage || "").replace(/_/g, " "),
      c.claim_amount ?? "",
      (c.status || "").replace(/_/g, " "),
      c.priority || "",
      c.current_owner_name || c.current_approver_name || "—",
    ]);

  const exportClaims = (format, which = "all") => {
    let list = sorted;
    if (which === "GIO_Approval") {
      list = list.filter((c) => c.workflow_type === "GIO_Approval");
    } else if (which === "Claim_Division") {
      list = list.filter((c) => c.workflow_type !== "GIO_Approval");
    }

    if (list.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No claims match this export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "#",
      "Claim Ref",
      "Claim Number",
      "Claimant",
      "Type",
      "Workflow",
      "Case Reason",
      "Originating Office Type",
      "Originating Office",
      "Plate No.",
      "Stage",
      "Amount (ETB)",
      "Status",
      "Priority",
      "Current Owner",
    ];

    const rows = buildExportRows(list);

    const label =
      which === "GIO_Approval"
        ? "GIO Cases"
        : which === "Claim_Division"
          ? "Claim Division"
          : "All Claims";

    const stamp = new Date().toISOString().slice(0, 10);
    const fn = `EIC_${which === "all" ? "AllClaims" : which}_${stamp}`;

    // PDF widths: one value per column
    const colWidths = [
      0.3, 1.0, 0.9, 1.1, 0.65, 0.75, 1.0, 0.95, 1.0, 0.75, 1.0, 0.85, 0.9, 0.6,
      1.0,
    ];

    if (format === "pdf") {
      exportToPDF(fn, `EIC Claims — ${label}`, headers, rows, colWidths);
    } else {
      exportToExcel(fn, headers, rows, label); // Excel instead of CSV
    }

    toast({
      title: `Exported ${list.length} claim${list.length === 1 ? "" : "s"}`,
      description: `${label} · ${format === "pdf" ? "PDF" : "Excel"} · ${stamp}`,
    });
  };

  const pageTitle =
    scope === "GIO_Approval"
      ? "All Claims — GIO Cases"
      : scope === "Claim_Division"
        ? "All Claims — Claim Division"
        : "All Claims";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length} shown
            {sorted.length !== claims.length && ` · ${claims.length} loaded`}
            {scope === "all" && (
              <span className="text-muted-foreground">
                {" "}
                · {cdCount} Claim Division · {gioCount} GIO
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search ref, claim no., claimant, plate..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {scope !== "GIO_Approval" && (
              <SelectItem value="Draft">Draft</SelectItem>
            )}
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(INSURANCE_TYPES || []).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showCaseReason && (
          <Select
            value={reasonFilter}
            onValueChange={(v) => {
              setReasonFilter(v);
              setPage(1);
            }}
          ></Select>
        )}

        {scope === "all" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <ExportButton
              label="Export all"
              onExport={(fmt) => exportClaims(fmt, "all")}
              disabled={sorted.length === 0}
            />
            <ExportButton
              label="Export Claim Division"
              onExport={(fmt) => exportClaims(fmt, "Claim_Division")}
              disabled={cdCount === 0}
            />
            <ExportButton
              label="Export GIO"
              onExport={(fmt) => exportClaims(fmt, "GIO_Approval")}
              disabled={gioCount === 0}
            />
          </div>
        ) : (
          <ExportButton
            onExport={(fmt) => exportClaims(fmt, scope)}
            disabled={sorted.length === 0}
          />
        )}
      </div>

      {sorted.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No claims found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table className="table-fixed min-w-[1400px]">
              <colgroup>
                <col style={{ width: "44px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "80px" }} />
                {scope === "all" && <col style={{ width: "90px" }} />}
                {showCaseReason && <col style={{ width: "160px" }} />}
                <col style={{ width: "100px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "170px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "130px" }} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <SortHeader
                    label="Claim Ref"
                    columnKey="claim_reference"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Claim No."
                    columnKey="claim_number"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Claimant"
                    columnKey="claimant_name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Type"
                    columnKey="insurance_type"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  {scope === "all" && (
                    <SortHeader
                      label="Workflow"
                      columnKey="workflow_type"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  )}
                  {showCaseReason && (
                    <SortHeader
                      label="Case reason"
                      columnKey="gio_case_reason"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  )}
                  <SortHeader
                    label="Plate No."
                    columnKey="plate_number"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Stage"
                    columnKey="workflow_stage"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Amount"
                    columnKey="claim_amount"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Status"
                    columnKey="status"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Priority"
                    columnKey="priority"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((claim, idx) => {
                  const displayIndex = startIdx + idx + 1;
                  const isGio = claim.workflow_type === "GIO_Approval";
                  return (
                    <TableRow key={claim.id} className="h-11">
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {displayIndex}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/claims/${claim.id}`}
                          className="text-sm font-semibold hover:text-primary hover:underline"
                        >
                          {claim.claim_reference}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {claim.claim_number || "—"}
                      </TableCell>
                      <TableCell
                        className="text-sm truncate"
                        title={claim.claimant_name}
                      >
                        {claim.claimant_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {claim.insurance_type}
                      </TableCell>
                      {scope === "all" && (
                        <TableCell>
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
                        </TableCell>
                      )}
                      {showCaseReason && (
                        <TableCell className="text-sm">
                          {isGio ? (
                            <span
                              className="text-xs truncate block"
                              title={formatReason(claim.gio_case_reason)}
                            >
                              {formatReason(claim.gio_case_reason)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-sm font-mono">
                        {claim.plate_number || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {claim.workflow_stage ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal max-w-full truncate block"
                            title={
                              getStageDescription(claim.workflow_stage) ||
                              claim.workflow_stage.replace(/_/g, " ")
                            }
                          >
                            {claim.workflow_stage.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right tabular-nums">
                        {formatCurrency(claim.claim_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] max-w-full truncate block ${
                            STATUS_COLORS[claim.status] || ""
                          }`}
                          title={claim.status?.replace(/_/g, " ")}
                        >
                          {claim.status?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            PRIORITY_COLORS[claim.priority] || ""
                          }`}
                        >
                          {claim.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="View"
                          >
                            <Link to={`/claims/${claim.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Edit"
                            onClick={() => setEditClaim(claim)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            title="Delete"
                            onClick={() => setDeleteClaim(claim)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {showingFrom}–{showingTo} of {sorted.length} claims
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-1">
                Page {safePage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <EditClaimDialog
        claim={editClaim}
        open={!!editClaim}
        onOpenChange={(v) => !v && setEditClaim(null)}
        onSaved={loadClaims}
      />

      <AlertDialog
        open={!!deleteClaim}
        onOpenChange={(v) => !v && setDeleteClaim(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Claim?</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong>{deleteClaim?.claim_reference}</strong>? This cannot be
              undone.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
