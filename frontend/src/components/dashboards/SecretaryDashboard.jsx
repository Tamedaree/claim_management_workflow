import { useState, useEffect, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  CheckCircle2,
  Inbox,
  Archive,
  Plus,
  Eye,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  STATUS_COLORS,
  formatCurrency,
  ROLE_LABELS,
  GIO_CASE_REASONS,
} from "@/lib/roleConfig";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import ExportButton from "@/components/ExportButton";
import { format } from "date-fns";

const PAGE_SIZE = 50;

function personLabel(userOrNull, fallbackName) {
  if (userOrNull) {
    const parts = [
      userOrNull.first_name,
      userOrNull.middle_name,
      userOrNull.last_name,
    ].filter(Boolean);
    if (parts.length) return parts.join(" ");
    if (userOrNull.full_name?.trim()) return userOrNull.full_name.trim();
  }
  if (fallbackName && !String(fallbackName).includes("@")) return fallbackName;
  return "—";
}

function gioReasonLabel(value) {
  if (!value) return "—";
  const found = GIO_CASE_REASONS?.find((r) => r.value === value);
  return found?.label || String(value).replace(/_/g, " ");
}

export default function SecretaryDashboard() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [claimsRes, usersRes] = await Promise.all([
          api.get("/claims"),
          api.get("/users").catch(() => ({ data: { data: [] } })),
        ]);
        if (cancelled) return;
        setClaims(claimsRes.data.data || []);
        setUsers(usersRes.data?.data || []);
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

  const usersById = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const processedByMe = claims.filter((c) => c.submitted_by_id === user?.id);
  const gioCases = claims.filter((c) => c.workflow_type === "GIO_Approval");
  const myGioCases = gioCases.filter((c) => c.submitted_by_id === user?.id);

  const pendingRegistration = claims.filter(
    (c) =>
      c.workflow_stage === "Claim Receipt & Registration" &&
      c.status !== "Draft",
  );

  const pendingClosure = claims.filter(
    (c) =>
      (c.workflow_stage === "Claim Closed" ||
        c.workflow_stage === "GIO Case Closure") &&
      ["Approved", "Submitted"].includes(c.status),
  );

  const registeredTable = [...processedByMe].sort(
    (a, b) =>
      new Date(b.createdAt || b.submission_date || 0) -
      new Date(a.createdAt || a.submission_date || 0),
  );

  const totalPages = Math.max(1, Math.ceil(registeredTable.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = registeredTable.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = registeredTable.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, registeredTable.length);

  const exportRegistered = (fmt) => {
    const headers = [
      "#",
      "Reference",
      "Type",
      "Insured",
      "Class",
      "Plate No.",
      "Case Reason",
      "Amount (ETB)",
      "Stage",
      "Status",
      "Assigned To",
      "Registered",
    ];

    const rows = registeredTable.map((c, i) => {
      const isGio = c.workflow_type === "GIO_Approval";
      const registeredDate = c.submission_date || c.createdAt;
      return [
        i + 1,
        c.claim_reference,
        isGio ? "GIO Case" : "Claim Division",
        c.claimant_name,
        c.insurance_type,
        c.plate_number || "",
        isGio ? gioReasonLabel(c.gio_case_reason) : "",
        c.claim_amount || 0,
        c.workflow_stage || "",
        String(c.status || "").replace(/_/g, " "),
        c.assigned_performer_name || c.current_owner_name || "",
        registeredDate ? format(new Date(registeredDate), "dd MMM yyyy") : "",
      ];
    });

    const fn = `secretary_registered_${format(new Date(), "yyyy-MM-dd")}`;

    if (fmt === "pdf") {
      exportToPDF(
        fn,
        "EIC — Claims & Cases Registered by Secretary",
        headers,
        rows,
        [0.3, 1.3, 1, 1.3, 0.9, 0.9, 1.3, 1, 1.3, 1, 1.1, 0.9],
      );
    } else {
      exportToCSV(fn, headers, rows);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Secretary Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.full_name || user?.email || "User"} ·{" "}
            {ROLE_LABELS[user?.role] || "Secretary"}
          </p>
        </div>
        <Link
          to="/claims/register"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Register Incoming Claim
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Pending Registration",
            value: pendingRegistration.length,
            icon: Inbox,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Pending Closure",
            value: pendingClosure.length,
            icon: Archive,
            color: "text-amber-600 bg-amber-50",
          },
          {
            label: "Registered by Me",
            value: processedByMe.length,
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "GIO Cases (mine)",
            value: myGioCases.length,
            icon: Briefcase,
            color: "text-purple-600 bg-purple-50",
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
        <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Registered by me
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {registeredTable.length} record(s)
            </span>
            <ExportButton
              onExport={exportRegistered}
              disabled={registeredTable.length === 0}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[50px]">#</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Insured</TableHead>
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs">Case reason</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Assigned to</TableHead>
                  <TableHead className="text-xs">Registered</TableHead>
                  <TableHead className="text-xs w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {registeredTable.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-center py-10 text-muted-foreground text-sm"
                    >
                      No claims registered yet. Use{" "}
                      <Link
                        to="/claims/register"
                        className="text-primary underline"
                      >
                        Register Incoming Claim
                      </Link>
                      .
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((c, index) => {
                    const displayIndex = startIdx + index + 1;
                    const isGio = c.workflow_type === "GIO_Approval";
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/40">
                        <TableCell className="text-xs text-muted-foreground">
                          {displayIndex}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {c.claim_reference}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              isGio
                                ? "bg-purple-100 text-purple-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isGio ? "GIO Case" : "Claim Division"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {c.claimant_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.insurance_type}
                          {c.plate_number ? (
                            <span className="block text-[10px] text-muted-foreground">
                              {c.plate_number}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">
                          {isGio ? gioReasonLabel(c.gio_case_reason) : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {formatCurrency(c.claim_amount || 0)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[130px] truncate">
                          {c.workflow_stage || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              STATUS_COLORS[c.status] || ""
                            }`}
                          >
                            {String(c.status || "").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {personLabel(
                            usersById[c.assigned_performer_id] ||
                              usersById[c.current_owner_id],
                            c.assigned_performer_name || c.current_owner_name,
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {c.submission_date || c.createdAt
                            ? format(
                                new Date(c.submission_date || c.createdAt),
                                "dd MMM yyyy",
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                          >
                            <Link to={`/claims/${c.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {registeredTable.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {showingFrom}–{showingTo} of {registeredTable.length}{" "}
                records
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
        </CardContent>
      </Card>
    </div>
  );
}
