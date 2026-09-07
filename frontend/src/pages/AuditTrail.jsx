import { useState, useEffect, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Search } from "lucide-react";
import { format } from "date-fns";
import {
  ROLE_LABELS,
  getWorkflowScopeForRole,
  getRolesForWorkflowStream,
} from "@/lib/roleConfig";

const AUDIT_ACTIONS = [
  "Registered",
  "Assigned",
  "Forwarded",
  "Approved",
  "Rejected",
  "Returned for Correction",
  "Escalated",
  "Status Changed",
  "Comment Added",
  "Closed",
];

const ACTION_BADGE = {
  Registered: "bg-slate-100 text-slate-700",
  Assigned: "bg-blue-100 text-blue-700",
  Forwarded: "bg-indigo-100 text-indigo-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
  "Returned for Correction": "bg-orange-100 text-orange-700",
  Escalated: "bg-purple-100 text-purple-700",
  "Status Changed": "bg-amber-100 text-amber-700",
  "Comment Added": "bg-gray-100 text-gray-700",
  Closed: "bg-emerald-100 text-emerald-800",
};

function workflowLabel(a) {
  if (a.from_stage && a.to_stage && a.from_stage !== a.to_stage) {
    return `${a.from_stage} → ${a.to_stage}`;
  }
  return a.to_stage || a.from_stage || a.comments || "—";
}

function isNoise(a) {
  // hide old Start/Complete noise if still in DB
  const t = a.action_type;
  if (t === "Comment") return true;
  if (t === "Approved" && String(a.comments || "").includes("In Progress:"))
    return true;
  if (String(a.comments || "").match(/^(In Progress|Completed):/)) return true;
  return false;
}

export default function AuditTrail() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const { user } = useOutletContext();
  const role = user?.role || "claim_adjuster";
  const scope = getWorkflowScopeForRole(role);
  const canSwitch = scope === "all";

  const [streamChoice, setStreamChoice] = useState("Claim_Division");
  const workflowFilter = canSwitch ? streamChoice : scope;
  const [stageFilter, setStageFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [nameByEmail, setNameByEmail] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/claim-actions");
        setActions(res.data?.data || []);
      } catch (e) {
        console.error(e);
        setActions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    api
      .get("/staff")
      .then((res) => {
        const map = {};
        for (const s of res.data?.data || []) {
          const email = String(s.email || "").toLowerCase();
          const name = [s.first_name, s.middle_name, s.last_name]
            .filter(Boolean)
            .join(" ");
          if (email && name) map[email] = name;
        }
        setNameByEmail(map);
      })
      .catch(() => {});
  }, []);

  const roleOptions = useMemo(
    () => getRolesForWorkflowStream(workflowFilter), // from roleConfig
    [workflowFilter],
  );

  const showPersonName = (value) => {
    if (!value) return "—";
    const s = String(value);
    if (!s.includes("@")) return s;
    return nameByEmail[s.toLowerCase()] || s;
  };

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (isNoise(a) && !AUDIT_ACTIONS.includes(a.action_type)) return false;

      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        a.claim_reference?.toLowerCase().includes(q) ||
        a.action_by_name?.toLowerCase().includes(q) ||
        a.performed_by_name?.toLowerCase().includes(q);

      const matchType = typeFilter === "all" || a.action_type === typeFilter;
      const roleVal = a.action_by_role || a.performed_by_role || "";
      const matchRole =
        roleFilter === "all" ||
        roleVal === roleFilter ||
        ROLE_LABELS[roleFilter] === roleVal;

      const stageQ = stageFilter.trim().toLowerCase();
      const matchStage =
        !stageQ ||
        a.from_stage?.toLowerCase().includes(stageQ) ||
        a.to_stage?.toLowerCase().includes(stageQ);

      const created = a.createdAt || a.created_at;
      let matchDate = true;
      if (fromDate && created)
        matchDate = new Date(created) >= new Date(fromDate);
      if (toDate && created && matchDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        matchDate = new Date(created) <= end;
      }

      const stream = a.workflow_type || a.claim?.workflow_type || null;
      const matchWorkflow =
        workflowFilter === "all" ||
        stream === workflowFilter ||
        (workflowFilter === "Claim_Division" && !stream);

      return (
        matchSearch &&
        matchType &&
        matchRole &&
        matchStage &&
        matchDate &&
        matchWorkflow
      );
    });
  }, [
    actions,
    search,
    typeFilter,
    roleFilter,
    stageFilter,
    fromDate,
    toDate,
    workflowFilter,
  ]);

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
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workflow transitions, assignments, and decisions — one record per
          change
        </p>
      </div>

      {canSwitch ? (
        <div className="flex gap-2">
          {[
            { value: "Claim_Division", label: "Claim Division" },
            { value: "GIO_Approval", label: "GIO" },
            { value: "all", label: "All" },
          ].map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={streamChoice === t.value ? "default" : "outline"}
              onClick={() => {
                setStreamChoice(t.value);
                setRoleFilter("all"); // ← here
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Showing:{" "}
          {workflowFilter === "GIO_Approval" ? "GIO" : "Claim Division"}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search claim # or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {AUDIT_ACTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((k) => (
              <SelectItem key={k} value={k}>
                {ROLE_LABELS[k] || k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-44"
          placeholder="Workflow stage..."
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        />
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Shield className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No audit records found
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date & Time</TableHead>
                <TableHead className="text-xs">Claim</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Workflow Change</TableHead>
                <TableHead className="text-xs">Performed By</TableHead>
                <TableHead className="text-xs">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const created = a.createdAt || a.created_at;
                const role =
                  ROLE_LABELS[a.action_by_role] || a.action_by_role || "—";
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelected(a)}
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {created
                        ? format(new Date(created), "dd MMM yyyy, HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {a.claim_id ? (
                        <Link
                          to={`/claims/${a.claim_id}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.claim_reference || a.claim_id.slice(0, 8)}
                        </Link>
                      ) : (
                        a.claim_reference || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${ACTION_BADGE[a.action_type] || "bg-gray-100"}`}
                      >
                        {a.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px]">
                      <span className="line-clamp-2">{workflowLabel(a)}</span>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {showPersonName(a.action_by_name || a.performed_by_name)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {role}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Audit detail</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              {[
                ["Claim Number", selected.claim_reference || "—"],
                ["Action", selected.action_type],
                ["Previous Stage", selected.from_stage || "—"],
                ["New Stage", selected.to_stage || "—"],
                ["Previous Status", selected.from_status || "—"],
                ["New Status", selected.to_status || "—"],
                ["Performed By", showPersonName(selected.action_by_name)],
                [
                  "Role",
                  ROLE_LABELS[selected.action_by_role] ||
                    selected.action_by_role ||
                    "—",
                ],
                [
                  "Previous Responsible",
                  selected.previous_responsible_person || "—",
                ],
                ["New Responsible", selected.new_responsible_person || "—"],
                [
                  "Date & Time",
                  selected.createdAt
                    ? format(
                        new Date(selected.createdAt),
                        "dd MMM yyyy, HH:mm:ss",
                      )
                    : "—",
                ],
                ["Remarks", selected.comments || "—"],
                [
                  "Stream",
                  selected.workflow_type === "GIO_Approval"
                    ? "GIO"
                    : selected.workflow_type === "Claim_Division"
                      ? "Claim Division"
                      : selected.workflow_type || "—",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-border/50 py-1.5"
                >
                  <span className="text-xs text-muted-foreground shrink-0">
                    {label}
                  </span>
                  <span className="text-xs text-right font-medium">
                    {value}
                  </span>
                </div>
              ))}
              {selected.claim_id && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  <Link to={`/claims/${selected.claim_id}`}>Open claim</Link>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
