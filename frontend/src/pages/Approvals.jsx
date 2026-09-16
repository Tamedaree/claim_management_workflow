import { useState, useEffect, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  ClipboardCheck,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  formatCurrency,
  APPROVER_ROLE_MAP,
  ROLE_TO_APPROVER_LABEL,
  isApprovalRole,
} from "@/lib/roleConfig";
import { processClaimAction } from "@/lib/claimWorkflow";
import moment from "moment";

/** Terminal / non-inbox statuses */
const DONE_STATUSES = new Set([
  "Approved",
  "Rejected",
  "Closed",
  "Claim_Closed",
  "Completed",
  "Draft",
]);

/**
 * Claim is assigned to this user (id, owner, or approver role/label match).
 */
function isAssignedToMe(claim, user) {
  if (!user?.id || !claim) return false;

  if (claim.current_approver_id === user.id) return true;
  if (claim.current_owner_id === user.id) return true;

  const role = user.role;
  const myLabel = ROLE_TO_APPROVER_LABEL?.[role];
  const mappedFromClaim = APPROVER_ROLE_MAP?.[claim.current_approver_role];

  if (claim.current_approver_role === role) return true;
  if (myLabel && claim.current_approver_role === myLabel) return true;
  if (mappedFromClaim === role) return true;

  return false;
}

function isActionable(claim) {
  if (!claim?.status) return false;
  if (DONE_STATUSES.has(claim.status)) return false;
  return true;
}

export default function Approvals() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const [claims, setClaims] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [bulkModal, setBulkModal] = useState(null);
  const [comments, setComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canBulkDecide = isApprovalRole?.(user?.role) ?? false;

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [claimsRes, thresholdsRes] = await Promise.all([
        api.get("/claims"),
        api.get("/approval-thresholds?is_active=true"),
      ]);

      const all = claimsRes.data.data || [];
      const t = thresholdsRes.data.data || [];

      const mine = all.filter(
        (c) => isAssignedToMe(c, user) && isActionable(c),
      );

      setClaims(mine);
      setThresholds(t);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load approvals.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadData();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loadData, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const pending = claims.filter(
    (c) => c.status !== "Additional_Info_Requested",
  );
  const infoReq = claims.filter(
    (c) => c.status === "Additional_Info_Requested",
  );
  const all = claims;

  const isAging = (claim) => {
    const d = claim.submission_date || claim.createdAt || claim.created_date;
    if (!d) return false;
    return moment().diff(moment(d), "days") > 5;
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = (ids) => {
    const allSelected =
      ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected(
      allSelected
        ? selected.filter((id) => !ids.includes(id))
        : [...new Set([...selected, ...ids])],
    );
  };

  const handleBulkAction = async (actionType) => {
    if (!canBulkDecide) {
      toast({
        title: "Not allowed",
        description: "Bulk approve/reject is only for approval roles.",
        variant: "destructive",
      });
      return;
    }

    if (actionType === "Rejected" && !comments.trim()) {
      toast({
        title: "Comments required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    const selectedClaims = claims.filter((c) => selected.includes(c.id));
    setProcessing(true);
    let success = 0;
    let failed = 0;

    for (const claim of selectedClaims) {
      try {
        await processClaimAction(claim, actionType, comments, user, thresholds);
        success++;
      } catch {
        failed++;
      }
    }

    setProcessing(false);
    setBulkModal(null);
    setComments("");
    setSelected([]);
    toast({
      title: `Bulk ${actionType.toLowerCase()} complete`,
      description: `${success} claim(s) ${actionType.toLowerCase()}${
        failed > 0 ? `, ${failed} failed` : ""
      }.`,
    });
    setRefreshKey((k) => k + 1);
  };

  const ClaimRow = ({ claim }) => {
    const isSelected = selected.includes(claim.id);
    return (
      <Card
        className={`border-0 shadow-sm hover:shadow-md transition-shadow mb-2 ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
      >
        <CardContent className="p-4 flex items-center gap-3">
          {canBulkDecide && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelect(claim.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Select claim"
            />
          )}
          <Link
            to={`/claims/${claim.id}`}
            className="flex items-center justify-between flex-1 min-w-0"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">
                    {claim.claim_reference}
                  </p>
                  {claim.workflow_type === "GIO_Approval" && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] bg-purple-100 text-purple-800"
                    >
                      GIO
                    </Badge>
                  )}
                  {isAging(claim) && (
                    <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-medium shrink-0">
                      <AlertTriangle className="w-3 h-3" /> Aging
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {claim.claimant_name} · {claim.insurance_type} ·{" "}
                  {claim.current_department
                    ? claim.current_department.replace(/_/g, " ")
                    : claim.workflow_type
                      ? claim.workflow_type.replace(/_/g, " ")
                      : "—"}
                  {claim.workflow_stage ? ` · ${claim.workflow_stage}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 ml-3">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold">
                  {formatCurrency(claim.claim_amount)}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />
                  {claim.submission_date || claim.createdAt
                    ? moment(claim.submission_date || claim.createdAt).fromNow()
                    : "—"}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={`text-[10px] ${STATUS_COLORS[claim.status] || ""}`}
              >
                {claim.status?.replace(/_/g, " ")}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-[10px] ${PRIORITY_COLORS[claim.priority] || ""}`}
              >
                {claim.priority}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        </CardContent>
      </Card>
    );
  };

  const SelectAllBar = ({ list }) => {
    if (!canBulkDecide) return null;
    const ids = list.map((c) => c.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selected.includes(id));
    if (list.length === 0) return null;
    return (
      <div className="flex items-center gap-2 mb-3 px-1">
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => toggleSelectAll(ids)}
          aria-label="Select all"
        />
        <span className="text-xs text-muted-foreground">
          Select all ({list.length})
        </span>
      </div>
    );
  };

  const renderList = (list, emptyText) =>
    list.length === 0 ? (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </CardContent>
      </Card>
    ) : (
      <>
        <SelectAllBar list={list} />
        {list.map((c) => (
          <ClaimRow key={c.id} claim={c} />
        ))}
      </>
    );

  return (
    <div className="max-w-5xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pending.length} claim(s) awaiting your action
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending{" "}
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {pending.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1.5">
            Info Requested{" "}
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {infoReq.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all">All Assigned ({all.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {renderList(pending, "No pending approvals")}
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          {renderList(infoReq, "No claims with info requests")}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {renderList(all, "No claims assigned to you")}
        </TabsContent>
      </Tabs>

      {canBulkDecide && selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge className="text-xs">{selected.length} selected</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setBulkModal("Approved")}
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve All
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkModal("Rejected")}
                className="gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Reject All
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={!!bulkModal}
        onOpenChange={() => {
          setBulkModal(null);
          setComments("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkModal === "Approved" ? "Approve" : "Reject"}{" "}
              {selected.length} Claim(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are about to <strong>{bulkModal?.toLowerCase()}</strong>{" "}
              <strong>{selected.length}</strong> selected claim(s). This action
              will be applied to each claim.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Comments {bulkModal === "Rejected" && "*"}
              </Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Enter comments applied to all selected claims..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkModal(null);
                setComments("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleBulkAction(bulkModal)}
              disabled={processing}
            >
              {processing
                ? "Processing..."
                : `Confirm ${bulkModal === "Approved" ? "Approve" : "Reject"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
