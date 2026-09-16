import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { canViewAudit, canExportAudit } from "@/lib/roleConfig";
import { useToast } from "@/components/ui/use-toast";
import {
  ShieldCheck,
  Search,
  X,
  Eye,
  Globe,
  Database,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import ExportButton from "@/components/ExportButton";
import moment from "moment";

const ACCESS_ACTIONS = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "VIEW_CLAIM",
  "EXPORT",
  "API_CALL",
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function statusTone(code) {
  if (!code) return "bg-gray-100 text-gray-600";
  if (code < 300) return "bg-emerald-100 text-emerald-700";
  if (code < 400) return "bg-blue-100 text-blue-700";
  if (code === 401 || code === 403) return "bg-amber-100 text-amber-700";
  if (code >= 400) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function methodTone(method) {
  switch (method) {
    case "GET":
      return "bg-blue-100 text-blue-700";
    case "POST":
      return "bg-emerald-100 text-emerald-700";
    case "PUT":
    case "PATCH":
      return "bg-amber-100 text-amber-700";
    case "DELETE":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function actionTone(action) {
  if (action?.includes("FAILED") || action?.includes("LOCKED"))
    return "bg-red-100 text-red-700";
  if (action?.includes("DELETE")) return "bg-red-100 text-red-700";
  if (action?.includes("LOGIN") || action?.includes("CREATE"))
    return "bg-emerald-100 text-emerald-700";
  if (action?.includes("RETURN") || action?.includes("REJECT"))
    return "bg-orange-100 text-orange-700";
  return "bg-blue-100 text-blue-700";
}

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {active ? (
        sortDir === "asc" ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
      )}
    </button>
  );
}

export default function AuditTrail() {
  const { toast } = useToast();
  const { user } = useOutletContext();
  const role = user?.role;
  const [tab, setTab] = useState("access"); 
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [method, setMethod] = useState("all");
  const [action, setAction] = useState("all");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Make the first setState async relative to the effect body
      await Promise.resolve();
      if (cancelled) return;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (search) params.set("search", search);
        if (status !== "all") params.set("status", status);
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("sortField", sortField);
        params.set("sortDir", sortDir);

        if (tab === "access") {
          if (method !== "all") params.set("method", method);
          if (action !== "all") params.set("action", action);
          const res = await api.get(`/audit/access-logs?${params.toString()}`);
          if (cancelled) return;
          setRows(res.data.data || []);
          setTotal(res.data.total ?? 0);
          setPages(res.data.pages || 1);
        } else {
          const res = await api.get(`/audit/data-changes?${params.toString()}`);
          if (cancelled) return;
          setRows(res.data.data || []);
          setTotal(res.data.total ?? 0);
          setPages(res.data.pages || 1);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          toast({
            title: "Error",
            description: "Failed to load audit records.",
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
  }, [
    tab,
    page,
    limit,
    sortField,
    sortDir,
    from,
    to,
    search,
    status,
    method,
    action,
    refreshKey,
    toast,
  ]);

  if (!canViewAudit(role)) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        You do not have access to the audit log.
      </div>
    );
  }

  const applyFilters = () => {
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setSearch("");
    setStatus("all");
    setMethod("all");
    setAction("all");
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const switchTab = (next) => {
    setTab(next);
    setPage(1);
    setDetail(null);
  };

  const exportRows = (format) => {
    const headers =
      tab === "access"
        ? [
            "Date/Time",
            "Actor",
            "Role",
            "Method",
            "Path",
            "Action",
            "Status",
            "IP",
          ]
        : [
            "Date/Time",
            "Actor",
            "Role",
            "Action",
            "Entity Type",
            "Entity ID",
            "Fields Changed",
          ];

    const dataRows = rows.map((r) =>
      tab === "access"
        ? [
            moment(r.createdAt).format("DD MMM YYYY, HH:mm:ss"),
            r.actorName || r.actorId || "—",
            r.actorRole || "—",
            r.method,
            r.path,
            r.action,
            r.statusCode,
            r.ip || "—",
          ]
        : [
            moment(r.createdAt).format("DD MMM YYYY, HH:mm:ss"),
            r.actorName || r.actorId || "—",
            r.actorRole || "—",
            r.action,
            r.entityType || "—",
            r.entityId || "—",
            r.changes ? Object.keys(r.changes).join(", ") : "—",
          ],
    );

    const fn = `audit_${tab}_${moment().format("YYYY-MM-DD")}`;
    if (format === "pdf") {
      exportToPDF(
        fn,
        `EIC — Audit Log (${tab === "access" ? "Access" : "Data Changes"})`,
        headers,
        dataRows,
        tab === "access"
          ? [1.3, 1.4, 0.8, 0.7, 1.6, 1, 0.6, 0.9]
          : [1.3, 1.2, 0.8, 1.1, 1, 1, 1.3],
      );
    } else {
      exportToCSV(fn, headers, dataRows);
    }
  };

  const hasActiveFilters =
    from ||
    to ||
    search ||
    status !== "all" ||
    method !== "all" ||
    action !== "all";

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only, append-only record of system activity
          </p>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => switchTab("access")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "access"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="w-4 h-4" /> Access Logs
        </button>
        <button
          onClick={() => switchTab("data")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "data"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Database className="w-4 h-4" /> Data Changes
        </button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              From
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              To
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {tab === "access" ? (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Method
                </label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {HTTP_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Action
                </label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {ACCESS_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Actor / Path Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="email, /api/claims..."
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="success">Success (2xx/3xx)</SelectItem>
                    <SelectItem value="denied">Denied (401/403)</SelectItem>
                    <SelectItem value="error">Error (4xx/5xx)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">
                Entity ID / Actor / Action Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. CLM-2026-001, STAFF_CREATED"
                />
              </div>
            </div>
          )}

          <div className="col-span-2 md:col-span-6 flex items-center gap-2 pt-1">
            <Button onClick={applyFilters} className="gap-1.5">
              <Search className="w-4 h-4" /> Search
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              className="gap-1.5"
            >
              <X className="w-4 h-4" /> Reset
            </Button>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-[10px]">
                Filters active
              </Badge>
            )}
            <div className="ml-auto">
              {canExportAudit(role) && (
                <ExportButton
                  onExport={exportRows}
                  disabled={rows.length === 0}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {tab === "data" ? (
                  <TableRow>
                    <TableHead className="text-xs">
                      <SortHeader
                        label="When"
                        field="createdAt"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Actor</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Entity Type</TableHead>
                    <TableHead className="text-xs">Entity ID</TableHead>
                    <TableHead className="text-xs">Fields Changed</TableHead>
                    <TableHead className="text-xs w-16">Details</TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead className="text-xs">
                      <SortHeader
                        label="When"
                        field="createdAt"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Actor</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Path</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">IP</TableHead>
                    <TableHead className="text-xs w-16">Details</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <ShieldCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No {tab === "access" ? "access" : "audit"} records
                        found.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : tab === "data" ? (
                  rows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="text-xs whitespace-nowrap">
                        {moment(r.createdAt).format("DD MMM YYYY, HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.actorName || r.actorId || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.actorRole || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] ${actionTone(r.action)}`}
                        >
                          {r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.entityType || "—"}
                      </TableCell>
                      <TableCell
                        className="text-xs font-mono max-w-[140px] truncate"
                        title={r.entityId}
                      >
                        {r.entityId || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.changes ? Object.keys(r.changes).join(", ") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setDetail(r)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="text-xs whitespace-nowrap">
                        {moment(r.createdAt).format("DD MMM YYYY, HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">
                          {r.actorName || r.actorId || "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.actorRole || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] font-mono ${methodTone(r.method)}`}
                        >
                          {r.method}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-xs font-mono max-w-[220px] truncate"
                        title={r.path}
                      >
                        {r.path}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] ${actionTone(r.action)}`}
                        >
                          {r.action?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] font-mono ${statusTone(r.statusCode)}`}
                        >
                          {r.statusCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.ip || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setDetail(r)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {total} record
              {total === 1 ? "" : "s"} · Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Sheet open={!!detail} onOpenChange={() => setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {tab === "access" ? "Access Event Detail" : "Audit Event Detail"}
            </SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-3 mt-4 text-sm">
              <DetailRow
                label="Timestamp"
                value={moment(detail.createdAt).format("DD MMM YYYY, HH:mm:ss")}
              />
              {tab === "access" ? (
                <>
                  <DetailRow label="Request ID" value={detail.requestId} mono />
                  <DetailRow
                    label="Actor"
                    value={
                      detail.actorEmail || detail.actorName || detail.actorId
                    }
                  />
                  <DetailRow label="Role" value={detail.actorRole} />
                  <DetailRow label="Method" value={detail.method} mono />
                  <DetailRow label="Path" value={detail.path} mono />
                  <DetailRow
                    label="Action"
                    value={detail.action?.replace(/_/g, " ")}
                  />
                  <DetailRow
                    label="Status Code"
                    value={detail.statusCode}
                    mono
                  />
                  <DetailRow
                    label="Duration"
                    value={
                      detail.durationMs != null
                        ? `${detail.durationMs} ms`
                        : null
                    }
                  />
                  <DetailRow
                    label="Claim Reference"
                    value={detail.claimId}
                    mono
                  />
                  <DetailRow label="IP Address" value={detail.ip} mono />
                  <DetailRow label="User Agent" value={detail.userAgent} />
                </>
              ) : (
                <>
                  <DetailRow
                    label="Actor"
                    value={detail.actorName || detail.actorId}
                  />
                  <DetailRow label="Role" value={detail.actorRole} />
                  <DetailRow label="Action" value={detail.action} mono />
                  <DetailRow label="Entity Type" value={detail.entityType} />
                  <DetailRow label="Entity ID" value={detail.entityId} mono />
                  {detail.changes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Changes
                      </p>
                      <pre className="text-[10px] bg-muted p-2 rounded-md overflow-x-auto">
                        {JSON.stringify(detail.changes, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-xs font-medium text-right break-all ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
