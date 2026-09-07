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
} from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
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

/** Roles that work only on GIO cases */
const GIO_ROLES = new Set([
  "gio_claim_adjuster",
  "gio_claim_manager",
  "chief_of_gio",
  // director is NOT here — sees both
]);

/** Roles that work only on Claim Division */
const CLAIM_DIVISION_ROLES = new Set([
  "secretary",
  "claim_adjuster",
  "surveyor",
  "principal_claim_officer",
  "claim_manager",
  // director is NOT here — sees both
]);

function resolveScope(role) {
  if (role === "director" || role === "admin" || role === "ceo") {
    return "all"; // GIO + Claim Division
  }
  if (GIO_ROLES.has(role)) return "GIO_Approval";
  if (CLAIM_DIVISION_ROLES.has(role)) return "Claim_Division";
  return "all";
}

export default function AllClaims() {
  const { user } = useOutletContext() || {};
  const { toast } = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editClaim, setEditClaim] = useState(null);
  const [deleteClaim, setDeleteClaim] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const scope = useMemo(() => resolveScope(user?.role), [user?.role]);

  const statusOptions = useMemo(() => {
    if (scope === "GIO_Approval") return GIO_STATUS_LIST || [];
    if (scope === "Claim_Division") return CLAIM_DIVISION_STATUS_LIST || [];
    // both
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
    const matchSearch =
      !search ||
      c.claim_reference?.toLowerCase().includes(search.toLowerCase()) ||
      c.claimant_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.plate_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" ||
      c.status === statusFilter ||
      c.workflow_stage === statusFilter;
    const matchType = typeFilter === "all" || c.insurance_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, filtered.length);

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

  const exportClaims = (format) => {
    const headers = [
      "#",
      "Claim Ref",
      "Claimant",
      "Type",
      "Workflow",
      "Plate No.",
      "Stage",
      "Amount (ETB)",
      "Status",
      "Priority",
      "Submitted By",
    ];
    const rows = filtered.map((c, i) => [
      i + 1,
      c.claim_reference,
      c.claimant_name,
      c.insurance_type,
      c.workflow_type === "GIO_Approval" ? "GIO" : "Claim Division",
      c.plate_number || "",
      c.workflow_stage || "",
      c.claim_amount,
      c.status,
      c.priority,
      c.submitted_by_name || "",
    ]);
    const label =
      scope === "GIO_Approval"
        ? "GIO Cases"
        : scope === "Claim_Division"
          ? "Claim Division"
          : "All Claims";
    const fn = `claims_${scope}_${new Date().toISOString().slice(0, 10)}`;
    if (format === "pdf") {
      exportToPDF(
        fn,
        `EIC — ${label}`,
        headers,
        rows,
        [0.4, 1.3, 1.3, 0.7, 0.9, 0.9, 1.2, 1.1, 1, 0.7, 1.2],
      );
    } else {
      exportToCSV(fn, headers, rows);
    }
    toast({
      title: `Exported ${filtered.length} claims`,
      description: `Downloaded as ${format.toUpperCase()}.`,
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {claims.length} claim(s)
          {scope === "GIO_Approval" && " · GIO only"}
          {scope === "Claim_Division" && " · Claim Division only"}
          {scope === "all" && " · All workflows"}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search ref, claimant, plate..."
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

        <ExportButton
          onExport={exportClaims}
          disabled={filtered.length === 0}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No claims found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Claim Ref</TableHead>
                  <TableHead>Claimant</TableHead>
                  <TableHead>Type</TableHead>
                  {scope === "all" && <TableHead>Workflow</TableHead>}
                  <TableHead>Plate No.</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((claim, idx) => {
                  const displayIndex = startIdx + idx + 1;
                  const isGio = claim.workflow_type === "GIO_Approval";
                  return (
                    <TableRow key={claim.id}>
                      <TableCell className="text-xs text-muted-foreground">
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
                      <TableCell className="text-sm">
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
                      <TableCell className="text-sm font-mono">
                        {claim.plate_number || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {claim.workflow_stage ? (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            title={getStageDescription(claim.workflow_stage)}
                          ></Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right">
                        {formatCurrency(claim.claim_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            STATUS_COLORS[claim.status] || ""
                          }`}
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
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {showingFrom}–{showingTo} of {filtered.length} claims
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
          )}
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
              <strong>{deleteClaim?.claim_reference}</strong>? This action
              cannot be undone.
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
