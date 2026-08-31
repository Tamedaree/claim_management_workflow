import { useState, useEffect, useMemo } from "react";
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
  FileText,
  Search,
  Eye,
  Pencil,
  Clock,
  AlertTriangle,
  Activity,
  User,
} from "lucide-react";
import {
  STATUS_COLORS,
  ROLE_LABELS,
  CLAIM_DIVISION_STATUS_LIST,
  getClaimAging,
  isClaimOverdue,
} from "@/lib/roleConfig";
import EditClaimDialog from "@/components/claims/EditClaimDialog";

function ownerDisplayName(ownerId, ownerName, usersById) {
  const u = ownerId ? usersById[ownerId] : null;
  if (u) {
    const parts = [u.first_name, u.middle_name].filter(Boolean);
    if (parts.length) return parts.join(" ");
    if (u.full_name) return u.full_name;
  }
  // avoid showing raw email
  if (ownerName && !String(ownerName).includes("@")) return ownerName;
  return ownerName?.includes("@") ? "—" : ownerName || "—";
}

export default function PrincipalClaimOfficerDashboard() {
  const { user } = useOutletContext();
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [claimsRes, usersRes] = await Promise.all([
          api.get("/claims?workflow_type=Claim_Division"),
          api.get("/users").catch(() => ({ data: { data: [] } })),
        ]);
        if (cancelled) return;

        const data = (claimsRes.data.data || []).filter(
          (c) => c.workflow_type !== "GIO_Approval",
        );
        setClaims(data);
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

    const matchOverdue = !overdueOnly || isClaimOverdue(c);

    return matchSearch && matchStatus && matchOverdue;
  });

  const pendingClaims = claims.filter(
    (c) =>
      !["Approved", "Rejected", "Claim_Closed", "Closed"].includes(c.status),
  );

  const overdueClaims = claims.filter((c) => isClaimOverdue(c));

  const inProgress = claims.filter((c) =>
    [
      "Submitted",
      "Under_Review",
      "Escalated",
      "Notification_Received",
      "Claim_Registered",
      "Pending_Assignment",
      "Assigned_to_Principal_of_Claim",
      "Assigned_to_Claim_Adjuster",
      "Underwriting_Verification",
      "Survey_in_Progress",
      "Principal_Review_Pending",
    ].includes(c.status),
  );

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
          Principal Claim Officer Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.full_name ||
            [user?.first_name, user?.middle_name].filter(Boolean).join(" ") ||
            "User"}{" "}
          · {ROLE_LABELS[user?.role] || "Principal Claim Officer"} · Claim
          Division · Workflow Monitoring
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Claims",
            value: claims.length,
            icon: FileText,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "In Progress",
            value: inProgress.length,
            icon: Activity,
            color: "text-purple-600 bg-purple-50",
          },
          {
            label: "Pending",
            value: pendingClaims.length,
            icon: Clock,
            color: "text-amber-600 bg-amber-50",
          },
          {
            label: "Overdue",
            value: overdueClaims.length,
            icon: AlertTriangle,
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

      {overdueClaims.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Overdue Claims
              ({overdueClaims.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueClaims.slice(0, 5).map((claim) => (
                <Link
                  key={claim.id}
                  to={`/claims/${claim.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {claim.claim_reference}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {claim.claimant_name} · {claim.insurance_type} ·{" "}
                        {getClaimAging(claim)} days aging
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
            <SelectItem value="Draft">Draft</SelectItem>
            {(CLAIM_DIVISION_STATUS_LIST || []).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setOverdueOnly(!overdueOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            overdueOnly
              ? "bg-red-100 text-red-700"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Overdue Only
        </button>
      </div>

      <Card className="border-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Claim Ref</TableHead>
                <TableHead>Claimant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Workflow Stage</TableHead>
                <TableHead>Current Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Aging</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-10 text-muted-foreground text-sm"
                  >
                    No Claim Division claims found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 50).map((claim, idx) => {
                  const overdue = isClaimOverdue(claim);
                  const aging = getClaimAging(claim);
                  const ownerLabel = ownerDisplayName(
                    claim.current_owner_id,
                    claim.current_owner_name,
                    usersById,
                  );

                  return (
                    <TableRow
                      key={claim.id}
                      className={overdue ? "bg-red-50/50" : ""}
                    >
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
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ownerLabel && ownerLabel !== "—" ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs">{ownerLabel}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
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
                      <TableCell className="text-center">
                        <span
                          className={`text-xs font-medium ${
                            overdue ? "text-red-600" : "text-muted-foreground"
                          }`}
                        >
                          {aging}d
                        </span>
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
                            onClick={() => setEditing(claim)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 50 && (
          <p className="text-xs text-center text-muted-foreground py-3">
            Showing 50 of {filtered.length} claims
          </p>
        )}
      </Card>
      <EditClaimDialog
        claim={editing}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </div>
  );
}
