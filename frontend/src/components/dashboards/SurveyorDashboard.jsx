import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ClipboardCheck,
  CheckCircle2,
  FileSearch,
  FileText,
  Search,
  Eye,
  Clock,
} from "lucide-react";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  formatCurrency,
  ROLE_LABELS,
  CLAIM_DIVISION_STATUS_LIST,
} from "@/lib/roleConfig";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import ExportButton from "@/components/ExportButton";
import { useToast } from "@/components/ui/use-toast";

const SURVEY_STAGES = [
  "Survey & Damage Assessment",
  "Final Inspection (Post-Repair)",
];

export default function SurveyorDashboard() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/claims?workflow_type=Claim_Division");
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

  // Claims at surveyor stages or assigned/owned by this surveyor
  const myClaims = claims.filter((c) => {
    if (c.workflow_type === "GIO_Approval") return false;
    if (
      c.assigned_performer_id === user?.id ||
      c.current_owner_id === user?.id
    ) {
      return true;
    }
    return SURVEY_STAGES.includes(c.workflow_stage);
  });

  const inProgress = claims.filter(
    (c) =>
      c.workflow_stage === "Survey & Damage Assessment" ||
      ["Survey_Requested", "Survey_in_Progress"].includes(c.status),
  );

  const baseList = myClaims.length > 0 ? myClaims : claims;

  const filtered = baseList.filter((c) => {
    const matchSearch =
      !search ||
      c.claim_reference?.toLowerCase().includes(search.toLowerCase()) ||
      c.claimant_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.plate_number?.toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      statusFilter === "all" ||
      c.status === statusFilter ||
      c.workflow_stage === statusFilter;

    return matchSearch && matchStatus;
  });

  const exportClaims = (format) => {
    const headers = [
      "#",
      "Claim Ref",
      "Claimant",
      "Type",
      "Amount (ETB)",
      "Stage",
      "Status",
      "Priority",
    ];
    const rows = filtered.map((c, i) => [
      i + 1,
      c.claim_reference,
      c.claimant_name,
      c.insurance_type,
      c.claim_amount,
      c.workflow_stage || "",
      c.status,
      c.priority,
    ]);
    const fn = `surveyor_claims_${new Date().toISOString().slice(0, 10)}`;
    if (format === "pdf") {
      exportToPDF(
        fn,
        "EIC — Surveyor Claims",
        headers,
        rows,
        [0.4, 1.5, 1.5, 0.8, 1.1, 1.4, 1, 0.7],
      );
    } else {
      exportToCSV(fn, headers, rows);
    }
    toast({
      title: `Exported ${filtered.length} claims`,
      description: `Downloaded as ${format.toUpperCase()}.`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Surveyor Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.full_name || "User"} · {ROLE_LABELS[user?.role] || "Surveyor"}{" "}
          · Claim Division
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "In Progress",
            value: inProgress.length,
            icon: FileSearch,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "My Claims",
            value: myClaims.length,
            icon: ClipboardCheck,
            color: "text-amber-600 bg-amber-50",
          },
          {
            label: "Inspections Done",
            value: claims.filter((c) => c.current_owner_id === user?.id).length,
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "Total Claim Division Claims",
            value: claims.length,
            icon: FileText,
            color: "text-slate-600 bg-slate-100",
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

      {inProgress.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> In Progress (
              {inProgress.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inProgress.slice(0, 5).map((claim) => (
                <Link
                  key={claim.id}
                  to={`/claims/${claim.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileSearch className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {claim.claim_reference}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {claim.claimant_name} · {claim.insurance_type}
                        {claim.plate_number
                          ? ` · ${claim.plate_number}`
                          : ""} · {claim.workflow_stage}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {formatCurrency(claim.claim_amount)}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${STATUS_COLORS[claim.status] || ""}`}
                    >
                      {claim.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search ref, claimant, plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(CLAIM_DIVISION_STATUS_LIST || []).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
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
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((claim, idx) => (
                  <TableRow key={claim.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {idx + 1}
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
                    <TableCell className="text-sm">
                      {claim.workflow_stage ? (
                        <Badge variant="outline" className="text-[10px]">
                          {claim.workflow_stage}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
