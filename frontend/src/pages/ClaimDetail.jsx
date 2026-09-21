import React, { useState, useEffect } from "react";
import {
  useParams,
  useOutletContext,
  useNavigate,
  Link,
} from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowUpRight,
  MessageSquare,
  Clock,
  User,
  Building2,
} from "lucide-react";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  formatCurrency,
  ROLE_LABELS,
  APPROVER_ROLE_MAP,
  isApprovalRole,
  getStageLabel,
  getStageDescription,
} from "@/lib/roleConfig";
import { findApproversByRoleAndLocation } from "@/lib/userMatching";
import moment from "moment";
import WorkflowTimeline from "@/components/claims/WorkflowTimeline";
import GioCaseTimeline from "@/components/claims/GioCaseTimeline";

function formatPersonName(u) {
  if (!u) return null;
  const parts = [u.first_name, u.middle_name, u.last_name]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (u.full_name?.trim()) return u.full_name.trim();
  return null;
}

function formatNameFromString(name) {
  if (!name) return null;
  if (String(name).includes("@")) return null;
  return name;
}

function buildStageHistory(activityList = []) {
  const byStage = new Map();

  const rank = (s) => {
    const x = String(s || "");
    if (x === "Completed") return 4;
    if (x === "In_Progress" || x === "In Progress") return 3;
    if (x === "On_Hold" || x === "On Hold") return 2;
    if (x === "Skipped") return 1;
    return 0; // Pending
  };

  for (const a of activityList) {
    // Skip pure pending placeholders (never worked)
    if (rank(a.status) === 0) continue;

    const key = a.stage_name || `order-${a.stage_order}`;
    const prev = byStage.get(key);

    const aTime = new Date(
      a.completed_at || a.started_at || a.updatedAt || a.createdAt || 0,
    ).getTime();
    const pTime = prev
      ? new Date(
          prev.completed_at ||
            prev.started_at ||
            prev.updatedAt ||
            prev.createdAt ||
            0,
        ).getTime()
      : 0;

    if (
      !prev ||
      rank(a.status) > rank(prev.status) ||
      (rank(a.status) === rank(prev.status) && aTime >= pTime)
    ) {
      byStage.set(key, a);
    }
  }

  return [...byStage.values()].sort((a, b) => {
    const t = (x) =>
      new Date(
        x.completed_at || x.started_at || x.updatedAt || x.createdAt || 0,
      ).getTime();
    return t(b) - t(a); // newest work first
  });
}

export default function ClaimDetail() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [claim, setClaim] = useState(null);
  const [thresholds, setThresholds] = useState([]);
  const [ownerUser, setOwnerUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [comments, setComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [nameByEmail, setNameByEmail] = useState({});

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const claimRes = await api.get(`/claims/${id}`);
      const claimData = claimRes.data?.data ?? claimRes.data;
      if (!claimData?.id) {
        throw Object.assign(new Error("Claim not found"), { status: 404 });
      }
      setClaim(claimData);

      try {
        const actRes = await api.get(`/claim-activities/claim/${id}`);
        setActivities(actRes.data?.data || []);
      } catch {
        setActivities([]);
      }

      try {
        const thresholdsRes = await api.get(
          "/approval-thresholds?is_active=true",
        );
        setThresholds(thresholdsRes.data?.data || []);
      } catch {
        setThresholds([]);
      }
    } catch (err) {
      const status = err.response?.status || err.status;
      const is404 = status === 404;

      toast({
        title: "Error",
        description: is404
          ? "Claim not found"
          : err.response?.data?.message || "Could not refresh claim",
        variant: "destructive",
      });

      if (is404) {
        navigate("/claims");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const claimRes = await api.get(`/claims/${id}`);
        if (cancelled) return;

        const claimData = claimRes.data?.data ?? claimRes.data;
        if (!claimData?.id) {
          throw new Error("Claim payload empty");
        }
        setClaim(claimData);
        setOwnerUser(null);

        try {
          const actRes = await api.get(`/claim-activities/claim/${id}`);
          if (!cancelled) setActivities(actRes.data?.data || []);
        } catch {
          if (!cancelled) setActivities([]);
        }

        try {
          const thresholdsRes = await api.get(
            "/approval-thresholds?is_active=true",
          );
          if (!cancelled) setThresholds(thresholdsRes.data?.data || []);
        } catch {
          if (!cancelled) setThresholds([]);
        }
      } catch (err) {
        console.error(
          "Load claim failed:",
          err.response?.status,
          err.response?.data,
        );
        if (!cancelled) {
          toast({
            title: "Error",
            description:
              err.response?.data?.message ||
              `Could not load claim (${err.response?.status || "network"})`,
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
  }, [id, navigate, toast]);

  useEffect(() => {
    const ownerId = claim?.current_owner_id;
    if (!ownerId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/users/${ownerId}`);
        if (!cancelled) {
          setOwnerUser(res.data?.data || res.data || null);
        }
      } catch {
        if (!cancelled) setOwnerUser(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [claim?.current_owner_id]);

  useEffect(() => {
    api
      .get("/staff")
      .then((res) => {
        const map = {};
        for (const s of res.data?.data || []) {
          const email = String(s.email || "").toLowerCase();
          const name = formatPersonName(s);
          if (email && name) map[email] = name;
        }
        setNameByEmail(map);
      })
      .catch(() => {});
  }, []);

  const isCurrentApprover =
    user &&
    claim &&
    (claim.current_approver_id === user.id ||
      (claim.current_approver_role &&
        APPROVER_ROLE_MAP?.[claim.current_approver_role] === user.role));

  const isSubmitter = user && claim && claim.submitted_by_id === user.id;
  const userIsApprover = isApprovalRole(user?.role);

  const canTakeAction =
    claim?.status !== "Rejected" &&
    userIsApprover &&
    isCurrentApprover &&
    [
      "Submitted",
      "Under_Review",
      "Escalated",
      "Additional_Info_Requested",
    ].includes(claim?.status);

  const canResubmit =
    isSubmitter &&
    ["Returned", "Additional_Info_Requested"].includes(claim?.status);

  // eslint-disable-next-line no-unused-vars
  const canCompleteRegistration =
    claim?.workflow_type === "Claim_Division" &&
    claim?.registration_complete === false &&
    (user?.role === "claim_adjuster" || user?.role === "admin") &&
    (user?.role === "admin" ||
      claim?.assigned_performer_id === user?.id ||
      claim?.current_owner_id === user?.id ||
      user?.role === "claim_adjuster");

  const getApprovalChain = () => {
    if (!claim) return [];
    const match = thresholds.find(
      (t) =>
        (t.insurance_type === claim.insurance_type ||
          t.insurance_type === "All") &&
        claim.claim_amount >= t.min_amount &&
        claim.claim_amount <= t.max_amount,
    );
    return match?.approval_chain || [];
  };

  const handleAction = async (actionType) => {
    if (!comments.trim() && actionType !== "Approved") {
      toast({
        title: "Comments required",
        description: "Please provide comments for this action.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const chain = getApprovalChain();
      const currentLevel = claim.approval_level || 1;
      let updates = {};
      let nextApproverRole = null;

      const actionTypeMap = {
        Approved: "Approved",
        Rejected: "Rejected",
        Returned: "Returned",
        Escalated: "Escalated",
        "Additional Info Requested": "Additional_Info_Requested",
      };
      const prismaActionType = actionTypeMap[actionType] || actionType;

      if (actionType === "Approved") {
        if (currentLevel >= chain.length) {
          updates = {
            status: "Approved",
            approval_date: new Date().toISOString(),
            current_approver_role: "None",
            current_approver_id: null,
          };
        } else {
          nextApproverRole = chain[currentLevel];
          updates = {
            status: "Under_Review",
            approval_level: currentLevel + 1,
            current_approver_role: nextApproverRole,
          };
        }
      } else if (actionType === "Rejected") {
        updates = {
          status: "Rejected",
          rejection_date: new Date().toISOString(),
          rejection_reason: comments.trim(), // required
          current_approver_role: "None",
          current_approver_id: null,
        };
      } else if (actionType === "Returned") {
        updates = {
          status: "Returned",
          return_count: (claim.return_count || 0) + 1,
          current_approver_role: "None",
          current_approver_id: null,
        };
      } else if (actionType === "Escalated") {
        if (currentLevel < chain.length) {
          nextApproverRole = chain[currentLevel];
          updates = {
            status: "Escalated",
            approval_level: currentLevel + 1,
            current_approver_role: nextApproverRole,
          };
        }
      } else if (actionType === "Additional Info Requested") {
        updates = { status: "Additional_Info_Requested" };
      }

      await api.put(`/claims/${id}`, updates);

      await api.post("/claim-actions", {
        claim_id: id,
        action_type: prismaActionType,
        action_by_id: user.id,
        action_by_name: user.full_name || "Unknown",
        action_by_role: ROLE_LABELS[user.role] || user.role,
        comments: comments || `Claim ${actionType.toLowerCase()}`,
        from_level: currentLevel,
        to_level: updates.approval_level || currentLevel,
      });

      if (nextApproverRole) {
        const systemRole = APPROVER_ROLE_MAP?.[nextApproverRole];
        if (systemRole) {
          const approvers = await findApproversByRoleAndLocation(
            systemRole,
            claim,
          );
          if (approvers.length > 0) {
            await api.put(`/claims/${id}`, {
              current_approver_id: approvers[0].id,
            });

            for (const a of approvers.slice(0, 3)) {
              await api.post("/notifications", {
                user_id: a.id,
                claim_id: id,
                claim_reference: claim.claim_reference,
                title: `Claim ${actionType}`,
                message: `Claim ${claim.claim_reference} requires your review. Amount: ${formatCurrency(
                  claim.claim_amount,
                )}`,
                type: "approval_required",
              });
            }
          }
        }
      }

      if (
        [
          "Approved",
          "Rejected",
          "Returned",
          "Additional Info Requested",
        ].includes(actionType) &&
        claim.submitted_by_id
      ) {
        await api.post("/notifications", {
          user_id: claim.submitted_by_id,
          claim_id: id,
          claim_reference: claim.claim_reference,
          title: `Claim ${actionType}`,
          message: `Your claim ${claim.claim_reference} has been ${actionType.toLowerCase()}. ${
            comments || ""
          }`,
          type:
            actionType === "Approved"
              ? "claim_approved"
              : actionType === "Rejected"
                ? "claim_rejected"
                : "claim_returned",
        });
      }

      toast({
        title: "Action completed",
        description: `Claim has been ${actionType.toLowerCase()}.`,
      });
      setActionModal(null);
      setComments("");
      loadData();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to process action.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleResubmit = async () => {
    setProcessing(true);
    try {
      const chain = getApprovalChain();
      const level = claim.approval_level || 1;
      const approverRole = chain[level - 1] || "Principal Claim Officer";

      await api.put(`/claims/${id}`, {
        status: "Submitted",
        current_approver_role: approverRole,
      });

      await api.post("/claim-actions", {
        claim_id: id,
        action_type: "Resubmitted",
        action_by_name: user.full_name || "Unknown",
        action_by_role: ROLE_LABELS[user.role] || user.role,
        comments: comments || "Claim resubmitted after correction",
      });

      const systemRole = APPROVER_ROLE_MAP?.[approverRole];
      if (systemRole) {
        const approvers = await findApproversByRoleAndLocation(
          systemRole,
          claim,
        );
        if (approvers.length > 0) {
          await api.put(`/claims/${id}`, {
            current_approver_id: approvers[0].id,
          });
          for (const a of approvers.slice(0, 3)) {
            await api.post("/notifications", {
              user_id: a.id,
              claim_id: id,
              claim_reference: claim.claim_reference,
              title: "Claim Resubmitted",
              message: `Claim ${claim.claim_reference} has been resubmitted and requires your review.`,
              type: "approval_required",
            });
          }
        }
      }

      toast({
        title: "Resubmitted",
        description: "Claim has been resubmitted for approval.",
      });
      setComments("");
      loadData();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!claim) return null;

  const chain = getApprovalChain();

  const isGioCase = claim.workflow_type === "GIO_Approval";
  const gioCurrentActivity = isGioCase
    ? [...(claim.activities || [])]
        .sort((a, b) => a.stage_order - b.stage_order)
        .find((a) => a.status === "In_Progress")
    : null;

  const ownerName =
    formatPersonName(ownerUser) ||
    formatNameFromString(
      gioCurrentActivity
        ? gioCurrentActivity.responsible_user_name
        : claim.current_owner_name,
    ) ||
    claim.current_owner_name ||
    null;

  const ownerDisplay = {
    name: ownerName,
    department: gioCurrentActivity ? "GIO" : claim.current_department,
    stage: gioCurrentActivity
      ? gioCurrentActivity.stage_name
      : claim.workflow_stage,
    role: gioCurrentActivity
      ? ROLE_LABELS[gioCurrentActivity.responsible_role] ||
        gioCurrentActivity.responsible_role
      : null,
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {claim.claim_reference}
            </h1>
            <Badge className={`${STATUS_COLORS[claim.status] || ""}`}>
              {claim.status?.replace(/_/g, " ")}
            </Badge>
            <Badge className={`${PRIORITY_COLORS[claim.priority] || ""}`}>
              {claim.priority}
            </Badge>
            {claim.workflow_type === "Claim_Division" &&
              claim.registration_complete === false && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 text-[10px]"
                >
                  Partial registration
                </Badge>
              )}
            {claim.workflow_type === "GIO_Approval" && (
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-800 text-[10px]"
              >
                GIO Case
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {claim.claimant_name} · {claim.insurance_type} ·{" "}
            {claim.originating_office || "—"}
          </p>
        </div>
        <p className="text-xl font-bold text-primary">
          {formatCurrency(claim.claim_amount)}
        </p>
      </div>

      {claim.status === "Rejected" && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500 bg-red-50/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-semibold text-red-900">Claim rejected</p>
            <p className="text-xs text-red-800">
              Date:{" "}
              {claim.rejection_date
                ? moment(claim.rejection_date).format("DD MMM YYYY")
                : "—"}
            </p>
            <p className="text-sm text-red-900">
              {claim.rejection_reason || "No reason recorded."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Workflow history is kept. Stage actions are disabled.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Claim Division — complete registration (claim adjuster) */}
      {claim.workflow_type === "Claim_Division" &&
        claim.registration_complete === false &&
        (user?.role === "claim_adjuster" || user?.role === "admin") && (
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  Full registration incomplete
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Secretary registered a notification only (
                  {claim.insurance_type}
                  ). Complete policy number, claim amount, date of loss
                  {claim.insurance_type === "Motor"
                    ? ", plate number, and vehicle details"
                    : ", and class-specific details"}
                  .
                </p>
              </div>
              <Button asChild size="sm">
                <Link to={`/claims/${claim.id}/complete-registration`}>
                  Complete registration
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <Card className="border-0 shadow-sm h-full">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Claim Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notification Date</span>
              <span className="font-medium">
                {claim.date_received
                  ? moment(claim.date_received).format("DD MMM YYYY, HH:mm")
                  : "—"}
              </span>
            </div>

            {(claim.insurance_type === "Motor" || claim.plate_number) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plate Number</span>
                <span className="font-medium font-mono">
                  {claim.plate_number || "—"}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">Forwarding Office</span>
              <span className="font-medium">
                {claim.originating_office || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted By</span>
              <span className="font-medium">
                {claim.submitted_by_name || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submission Date</span>
              <span className="font-medium">
                {claim.submission_date
                  ? moment(claim.submission_date).format("DD MMM YYYY, HH:mm")
                  : "—"}
              </span>
            </div>
            {claim.workflow_type === "Claim_Division" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registration</span>
                <span className="font-medium">
                  {claim.registration_complete
                    ? "Complete"
                    : "Partial (awaiting adjuster)"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Basic Information of Claim
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Policy Number</span>
              <span className="font-medium">{claim.policy_number || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Claim Reference</span>
              <span className="font-medium">
                {claim.claim_reference || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Claim Number</span>
              <span className="font-medium">{claim.claim_number || "—"}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Description & Remarks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Incident Date</span>
              <span className="font-medium">
                {claim.incident_date
                  ? moment(claim.incident_date).format("DD MMM YYYY")
                  : "—"}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Incident Description
              </p>
              <p className="text-sm">
                {claim.incident_description || "No description provided."}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remarks</p>
              <p className="text-sm">{claim.remarks || "No remarks."}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {claim.workflow_type === "GIO_Approval" && (
        <Card className="border-0 shadow-sm overflow-hidden border-purple-100/80 bg-gradient-to-br from-purple-50/40 via-background to-background">
          <CardHeader className="pb-3 border-b border-purple-100/60">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 text-xs font-bold">
                  GIO
                </span>
                Case details
              </CardTitle>
              {claim.gio_case_reason && (
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[10px] font-medium">
                  {claim.gio_case_reason.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Compact metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Claim number
                </p>
                <p
                  className="text-sm font-semibold font-mono truncate"
                  title={claim.claim_number || undefined}
                >
                  {claim.claim_number || "—"}
                </p>
              </div>

              <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Final approval
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {claim.final_approval_amount != null
                    ? formatCurrency(claim.final_approval_amount)
                    : "—"}
                </p>
              </div>

              {(claim.insurance_type === "Motor" ||
                claim.motor_vehicle_type) && (
                <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Vehicle type
                  </p>
                  <p className="text-sm font-semibold">
                    {claim.motor_vehicle_type || "—"}
                  </p>
                </div>
              )}

              <div className="rounded-xl border bg-card/80 p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Case reason
                </p>
                <p className="text-sm font-medium leading-snug">
                  {claim.gio_case_reason?.replace(/_/g, " ") || "—"}
                </p>
              </div>
            </div>

            {/* Flags */}
            {(claim.is_recovery ||
              claim.is_subrogation ||
              claim.is_reinsurance ||
              claim.is_rebid ||
              claim.has_independent_assessor) && (
              <div className="flex flex-wrap gap-1.5">
                {claim.is_recovery && (
                  <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                    Third party recovery
                  </Badge>
                )}
                {claim.is_subrogation && (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                    Subrogation
                  </Badge>
                )}
                {claim.is_reinsurance && (
                  <Badge className="bg-purple-100 text-purple-800 text-[10px]">
                    Reinsurance
                  </Badge>
                )}
                {claim.is_rebid && (
                  <Badge className="bg-cyan-100 text-cyan-800 text-[10px]">
                    Rebid
                  </Badge>
                )}
                {claim.has_independent_assessor && (
                  <Badge className="bg-slate-100 text-slate-800 text-[10px]">
                    Independent assessor
                  </Badge>
                )}
              </div>
            )}

            {/* Detail panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {claim.is_recovery &&
                claim.registration_data?.third_party_recovery && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-1.5 text-xs">
                    <p className="font-semibold text-sm text-blue-900">
                      Third party recovery
                    </p>
                    <p>
                      <span className="text-muted-foreground">Party · </span>
                      {claim.registration_data.third_party_recovery
                        .third_party_name || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Plate · </span>
                      <span className="font-mono">
                        {claim.registration_data.third_party_recovery
                          .third_party_plate_number || "—"}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Amount · </span>
                      {formatCurrency(
                        claim.registration_data.third_party_recovery
                          .recovery_amount,
                      )}
                    </p>
                    {claim.registration_data.third_party_recovery
                      .responsible_party_details && (
                      <p className="text-muted-foreground pt-1">
                        {
                          claim.registration_data.third_party_recovery
                            .responsible_party_details
                        }
                      </p>
                    )}
                  </div>
                )}

              {claim.is_subrogation && claim.registration_data?.subrogation && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-sm text-amber-900">
                    Subrogation
                  </p>
                  <p>
                    <span className="text-muted-foreground">Against · </span>
                    {claim.registration_data.subrogation.subrogation_against ||
                      "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Recover · </span>
                    {formatCurrency(
                      claim.registration_data.subrogation.amount_to_recover,
                    )}
                  </p>
                </div>
              )}

              {claim.is_reinsurance && claim.registration_data?.reinsurance && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-sm text-purple-900">
                    Reinsurance
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reinsurer · </span>
                    {claim.registration_data.reinsurance.reinsurer_name || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      Recoverable ·{" "}
                    </span>
                    {formatCurrency(
                      claim.registration_data.reinsurance.recoverable_amount,
                    )}
                  </p>
                </div>
              )}

              {claim.is_rebid && (
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-sm text-cyan-900">Rebid</p>
                  <p>
                    <span className="text-muted-foreground">Garages · </span>
                    {(claim.rebid_participating_garages || []).join(", ") ||
                      "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Winner · </span>
                    {claim.rebid_winner_garage || "—"}
                  </p>
                </div>
              )}
            </div>

            {claim.has_independent_assessor && (
              <p className="text-xs text-muted-foreground">
                Independent assessor:{" "}
                <span className="font-medium text-foreground">
                  {claim.independent_assessor_name || "—"}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval Chain */}
      {chain.length > 0 && userIsApprover && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Workflow Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {chain.map((role, i) => {
                const level = i + 1;
                const isCompleted =
                  claim.approval_level > level || claim.status === "Approved";
                const isCurrent =
                  claim.approval_level === level &&
                  !["Approved", "Rejected"].includes(claim.status);
                return (
                  <React.Fragment key={role}>
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-700"
                          : isCurrent
                            ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
                            : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5" />}
                      {role.replace(/_/g, " ")}
                    </div>
                    {i < chain.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {claim.documents?.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Supporting Documents ({claim.documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {claim.documents.map((doc, i) => (
                <a
                  key={i}
                  href={doc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium truncate">
                    Document {i + 1}
                  </span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Owner Info */}
      {(ownerDisplay.name || ownerDisplay.department || ownerDisplay.stage) && (
        <Card className="border-0 shadow-sm bg-blue-50 border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-semibold text-blue-900">
                Current Owner:
              </span>
              {ownerDisplay.name ? (
                <span className="flex items-center gap-1 text-blue-800">
                  <User className="w-3.5 h-3.5" />
                  {ownerDisplay.name}
                </span>
              ) : ownerDisplay.role ? (
                <span className="flex items-center gap-1 text-blue-800">
                  <User className="w-3.5 h-3.5" />
                  Awaiting {ownerDisplay.role}
                </span>
              ) : null}
              {ownerDisplay.department && (
                <span className="flex items-center gap-1 text-blue-800">
                  <Building2 className="w-3.5 h-3.5" />
                  {ownerDisplay.department.replace(/_/g, " ")}
                </span>
              )}
              {ownerDisplay.stage && (
                <span
                  className="flex items-center gap-1 text-blue-800"
                  title={getStageDescription(ownerDisplay.stage)}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {getStageLabel(ownerDisplay.stage)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Activity Timeline */}
      {claim.workflow_type === "GIO_Approval" ? (
        <GioCaseTimeline
          claim={claim}
          user={user}
          onActivityUpdated={loadData}
        />
      ) : (
        <WorkflowTimeline
          claim={claim}
          user={user}
          onActivityUpdated={loadData}
        />
      )}

      {/* Action Buttons */}
      {canTakeAction && (
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">Take Action</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setActionModal("Approved")}
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setActionModal("Rejected")}
                className="gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActionModal("Returned")}
                className="gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Return for Correction
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActionModal("Additional Info Requested")}
                className="gap-1.5"
              >
                <MessageSquare className="w-4 h-4" /> Request Info
              </Button>
              {(claim.approval_level || 1) < chain.length && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActionModal("Escalated")}
                  className="gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" /> Escalate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {canResubmit && (
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-500">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Resubmit Claim</p>
            <Textarea
              placeholder="Add notes about corrections made..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
            />
            <Button size="sm" onClick={handleResubmit} disabled={processing}>
              {processing ? "Resubmitting..." : "Resubmit"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Activity History — only stages that were worked */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Activity History
          </CardTitle>
          <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
            Stages that were started or completed — not the full workflow list
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {(() => {
            const history = buildStageHistory(activities);
            if (history.length === 0) {
              return (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No work recorded yet.
                </p>
              );
            }

            return (
              <ul className="space-y-3">
                {history.map((a) => {
                  const statusRaw = String(a.status || "");
                  const status = statusRaw.replace(/_/g, " ");
                  const raw = a.responsible_user_name;
                  const person =
                    formatNameFromString(raw) ||
                    (raw && String(raw).includes("@")
                      ? nameByEmail[String(raw).toLowerCase()]
                      : null) ||
                    null;
                  const roleLabel =
                    ROLE_LABELS[a.responsible_role] ||
                    a.responsible_role?.replace(/_/g, " ") ||
                    "—";
                  const when =
                    a.completed_at ||
                    a.started_at ||
                    a.updatedAt ||
                    a.createdAt;

                  const tone =
                    statusRaw === "Completed"
                      ? {
                          dot: "bg-emerald-500",
                          badge: "bg-emerald-100 text-emerald-800",
                          ring: "ring-emerald-100",
                        }
                      : statusRaw === "In_Progress" || status === "In Progress"
                        ? {
                            dot: "bg-blue-500",
                            badge: "bg-blue-100 text-blue-800",
                            ring: "ring-blue-100",
                          }
                        : statusRaw === "On_Hold" || status === "On Hold"
                          ? {
                              dot: "bg-amber-500",
                              badge: "bg-amber-100 text-amber-800",
                              ring: "ring-amber-100",
                            }
                          : {
                              dot: "bg-slate-400",
                              badge: "bg-slate-100 text-slate-700",
                              ring: "ring-slate-100",
                            };

                  return (
                    <li
                      key={a.id || a.stage_name}
                      className={`relative flex gap-3 rounded-xl border bg-card p-3.5 shadow-sm ring-1 ${tone.ring}`}
                    >
                      <div
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <span
                            className="text-sm font-semibold"
                            title={getStageDescription(a.stage_name)}
                          >
                            {getStageLabel(a.stage_name)}
                          </span>
                          <Badge className={`text-[10px] ${tone.badge}`}>
                            {status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>
                            <span className="text-foreground/70">Role · </span>
                            {roleLabel}
                          </span>
                          {person && (
                            <span>
                              <span className="text-foreground/70">By · </span>
                              {person}
                            </span>
                          )}
                          {when && (
                            <span>
                              <span className="text-foreground/70">
                                When ·{" "}
                              </span>
                              {moment(when).format("DD MMM YYYY, HH:mm")}
                            </span>
                          )}
                        </div>

                        {a.comments && (
                          <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mt-1">
                            {a.comments}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog
        open={!!actionModal}
        onOpenChange={() => {
          setActionModal(null);
          setComments("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionModal} Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are about to <strong>{actionModal?.toLowerCase()}</strong>{" "}
              claim <strong>{claim.claim_reference}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Comments {actionModal !== "Approved" && "*"}
              </Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Enter your comments..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionModal(null);
                setComments("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleAction(actionModal)}
              disabled={processing}
            >
              {processing ? "Processing..." : `Confirm ${actionModal}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
