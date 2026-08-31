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

export default function ClaimDetail() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [claim, setClaim] = useState(null);
  const [actions, setActions] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [ownerUser, setOwnerUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [comments, setComments] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [claimRes, actionsRes, thresholdsRes] = await Promise.all([
        api.get(`/claims/${id}`),
        api.get(`/claim-actions/claim/${id}`),
        api.get("/approval-thresholds?is_active=true"),
      ]);

      setClaim(claimRes.data.data);
      setActions(actionsRes.data.data || []);
      setThresholds(thresholdsRes.data.data || []);
    } catch {
      toast({
        title: "Error",
        description: "Claim not found",
        variant: "destructive",
      });
      navigate("/claims");
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
          const actionsRes = await api.get(`/claim-actions/claim/${id}`);
          if (!cancelled) setActions(actionsRes.data?.data || []);
        } catch {
          if (!cancelled) setActions([]);
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

  const isCurrentApprover =
    user &&
    claim &&
    (claim.current_approver_id === user.id ||
      (claim.current_approver_role &&
        APPROVER_ROLE_MAP?.[claim.current_approver_role] === user.role));

  const isSubmitter = user && claim && claim.submitted_by_id === user.id;
  const userIsApprover = isApprovalRole(user?.role);

  const canTakeAction =
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
                  Secretary registered a notification only. Complete policy,
                  amount, date of loss, and other details.
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Claim Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Policy Number</span>
              <span className="font-medium">{claim.policy_number || "—"}</span>
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
              <span className="text-muted-foreground">Incident Date</span>
              <span className="font-medium">
                {claim.incident_date
                  ? moment(claim.incident_date).format("DD MMM YYYY")
                  : "—"}
              </span>
            </div>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Responsible</span>
              <span className="font-medium">
                {claim.current_approver_role &&
                claim.current_approver_role !== "None"
                  ? claim.current_approver_role.replace(/_/g, " ")
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
            <CardTitle className="text-sm">Description & Remarks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
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
                <span className="flex items-center gap-1 text-blue-800">
                  <Clock className="w-3.5 h-3.5" />
                  {ownerDisplay.stage}
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

      {/* Audit Trail */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-0">
              {actions.map((a, i) => (
                <div key={a.id} className="flex gap-3 pb-4 relative">
                  {i < actions.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      a.action_type === "Approved"
                        ? "bg-emerald-100"
                        : a.action_type === "Rejected"
                          ? "bg-red-100"
                          : a.action_type === "Returned"
                            ? "bg-orange-100"
                            : "bg-blue-100"
                    }`}
                  >
                    {a.action_type === "Approved" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : a.action_type === "Rejected" ? (
                      <XCircle className="w-4 h-4 text-red-600" />
                    ) : a.action_type === "Returned" ? (
                      <RotateCcw className="w-4 h-4 text-orange-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">
                        {a.action_type?.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        by {a.action_by_name}
                      </span>
                      {a.action_by_role && (
                        <span className="text-[10px] text-muted-foreground">
                          ({a.action_by_role})
                        </span>
                      )}
                    </div>
                    {a.comments && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.comments}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {moment(a.createdAt || a.created_date).format(
                        "DD MMM YYYY, HH:mm:ss",
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
