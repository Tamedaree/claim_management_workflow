import { useState, useEffect } from "react";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  Clock,
  Circle,
  SkipForward,
  User,
  Building2,
  ArrowRight,
  ArrowUpRight,
  Flag,
  Lock,
  RotateCcw,
} from "lucide-react";
import {
  ROLE_LABELS,
  ACTIVITY_STATUS_COLORS,
  GIO_APPROVAL_TIER,
  findTierEntry,
  isLastTierStage,
  nextTierEntry,
  getStageLabel,
  getStageDescription,
  canActOnGioStage,
} from "@/lib/roleConfig";
import moment from "moment";

const toDisplayStatus = (s) => {
  if (s === "In_Progress") return "In Progress";
  if (s === "On_Hold") return "On Hold";
  return s;
};

/** Stage where Chief of GIO assigns a GIO Claim Adjuster */
const ASSIGN_MANAGER_STAGE = "Director Assignment";
const ASSIGN_PRINCIPAL_STAGE = "Manager Assignment";

// GIO cases can land on either of these statuses when returned — see
// statusMapping.js / schema.prisma ClaimStatus enum. Neither is a bare
// "Returned" value.
const RETURNED_STATUSES = [
  "Returned_for_Correction",
  "Returned_to_Originating_Office",
];

export default function GioCaseTimeline({ claim, user, onActivityUpdated }) {
  const { toast } = useToast();
  const [actionOpen, setActionOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completionChoice, setCompletionChoice] = useState("forward");
  const [adjusters, setAdjusters] = useState([]);
  const [selectedAdjusterId, setSelectedAdjusterId] = useState("");
  const [actionMode, setActionMode] = useState("forward"); // "forward" | "return"
  const [returnTargetOrder, setReturnTargetOrder] = useState("");
  const [resubmitting, setResubmitting] = useState(false);

  const activities = [...(claim?.activities || [])].sort(
    (a, b) => a.stage_order - b.stage_order,
  );

  const currentStage = activities.find((a) => a.status === "In_Progress");
  const needsManagerAssign = currentStage?.stage_name === ASSIGN_MANAGER_STAGE;
  const needsPrincipalAssign =
    currentStage?.stage_name === ASSIGN_PRINCIPAL_STAGE;
  const needsAssign = needsManagerAssign || needsPrincipalAssign;

  const tierEntry = currentStage
    ? findTierEntry(GIO_APPROVAL_TIER, currentStage.stage_name)
    : null;
  const showTierChoice =
    actionMode === "forward" &&
    tierEntry &&
    currentStage &&
    !isLastTierStage(GIO_APPROVAL_TIER, currentStage.stage_name);
  const nextTier = currentStage
    ? nextTierEntry(GIO_APPROVAL_TIER, currentStage.stage_name)
    : null;

  // Stages earlier than the current in-progress one — return targets
  const earlierStages = currentStage
    ? activities
        .filter((a) => a.stage_order < currentStage.stage_order)
        .sort((a, b) => b.stage_order - a.stage_order) // most recent first
    : [];

  const isReturned = RETURNED_STATUSES.includes(claim.status);
  const canResubmit =
    isReturned &&
    (user?.id === claim.submitted_by_id ||
      user?.role === "secretary" ||
      user?.role === "admin");

  useEffect(() => {
    if (!actionOpen || !needsAssign) return;

    let cancelled = false;
    (async () => {
      try {
        const role = needsManagerAssign
          ? "gio_claim_manager"
          : "gio_principal_claim_officer";
        const res = await api.get(`/users?role=${role}`);
        const list = (res.data.data || []).filter((u) => u.is_active !== false);
        if (!cancelled) setAdjusters(list);
      } catch {
        if (!cancelled) setAdjusters([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actionOpen, needsAssign, needsManagerAssign]);

  const selectedAdjuster = adjusters.find((a) => a.id === selectedAdjusterId);

  const openActionDialog = (mode) => {
    setActionMode(mode);
    setReturnTargetOrder("");
    setComments("");
    setActionOpen(true);
  };

  const handleComplete = async () => {
    if (actionMode === "return") {
      if (!returnTargetOrder) {
        toast({
          title: "Select a stage",
          description: "Choose which earlier stage to return this case to.",
          variant: "destructive",
        });
        return;
      }
      if (!comments.trim()) {
        toast({
          title: "Comments required",
          description: "Explain what must be corrected.",
          variant: "destructive",
        });
        return;
      }

      setProcessing(true);
      try {
        const targetStage = activities.find(
          (a) => a.stage_order === Number(returnTargetOrder),
        );
        await api.post(`/claims/${claim.id}/return-stage`, {
          comments,
          target_stage_order: Number(returnTargetOrder),
          target_stage_name: targetStage?.stage_name,
        });
        toast({
          title: "Returned for correction",
          description: `Sent back to "${getStageLabel(targetStage?.stage_name)}".`,
        });
        setActionOpen(false);
        setComments("");
        setReturnTargetOrder("");
        setActionMode("forward");
        onActivityUpdated?.();
      } catch (e) {
        toast({
          title: "Error",
          description: e.response?.data?.message || "Return failed",
          variant: "destructive",
        });
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (needsManagerAssign && !selectedAdjusterId) {
      toast({
        title: "Select manager",
        description: "Choose a GIO Claim Manager to assign this case.",
        variant: "destructive",
      });
      return;
    }
    if (needsPrincipalAssign && !selectedAdjusterId) {
      toast({
        title: "Select principal",
        description: "Choose a GIO Claim Principal to assign this case.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        comments,
        action_taken: comments,
        finalize: showTierChoice && completionChoice === "finalize",
      };

      if (needsAssign && selectedAdjuster) {
        payload.assign_user_id = selectedAdjuster.id;
        payload.assign_user_name =
          selectedAdjuster.full_name ||
          [
            selectedAdjuster.first_name,
            selectedAdjuster.middle_name,
            selectedAdjuster.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          selectedAdjuster.position_title ||
          selectedAdjuster.email;
      }

      await api.post(`/claims/${claim.id}/complete-stage`, payload);

      toast({
        title: "Stage completed",
        description:
          showTierChoice && completionChoice === "finalize"
            ? `"${getStageLabel(currentStage.stage_name)}" finalized — no further sign-off needed.`
            : needsAssign
              ? `"${getStageLabel(currentStage.stage_name)}" completed. Assigned to ${payload.assign_user_name}.`
              : `"${getStageLabel(currentStage.stage_name)}" forwarded to the next stage.`,
        duration: 3000,
      });
      setActionOpen(false);
      setComments("");
      setCompletionChoice("forward");
      setSelectedAdjusterId("");
      if (onActivityUpdated) onActivityUpdated();
    } catch (e) {
      toast({
        title: "Error",
        description:
          e.response?.data?.message || "Failed to complete this stage.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleResubmit = async () => {
    setResubmitting(true);
    try {
      await api.post(`/claims/${claim.id}/resubmit-stage`, { comments: "" });
      toast({
        title: "Resubmitted",
        description: "Case has been resubmitted for review.",
      });
      onActivityUpdated?.();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to resubmit.",
        variant: "destructive",
      });
    } finally {
      setResubmitting(false);
    }
  };

  if (activities.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          No GIO workflow stages found for this case.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {canResubmit && (
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-500 mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  This case was returned for correction
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review the reviewer's comment on the relevant stage below,
                  make the necessary corrections, then resubmit to continue the
                  approval flow.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleResubmit}
              disabled={resubmitting}
              className="gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {resubmitting ? "Resubmitting..." : "Resubmit Case"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">GIO Case Workflow</CardTitle>
          <Badge
            variant="outline"
            className="text-xs"
            title={getStageDescription(currentStage?.stage_name)}
          >
            {getStageLabel(currentStage?.stage_name) || "Not Started"}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            This case follows the fixed GIO approval sequence.
          </p>

          <div className="space-y-0">
            {activities.map((activity, i) => {
              const status = toDisplayStatus(activity.status);
              const isLast = i === activities.length - 1;
              const mine = canActOnGioStage(
                user?.role,
                activity.responsible_role,
              );
              const isSkipped = status === "Skipped";

              const icon =
                status === "Completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : status === "In Progress" ? (
                  <Clock className="w-4 h-4 text-blue-600" />
                ) : isSkipped ? (
                  <SkipForward className="w-4 h-4 text-slate-400" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                );

              const bgColor =
                status === "Completed"
                  ? "bg-emerald-50"
                  : status === "In Progress"
                    ? "bg-blue-50"
                    : isSkipped
                      ? "bg-slate-50"
                      : "bg-gray-50";

              return (
                <div
                  key={activity.id}
                  className={`flex gap-3 pb-3 relative ${
                    mine && status === "In Progress"
                      ? "ring-1 ring-blue-200 rounded-lg p-2 -m-1"
                      : ""
                  } ${isSkipped ? "opacity-60" : ""}`}
                >
                  {!isLast && (
                    <div
                      className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${
                        status === "Completed" ? "bg-emerald-200" : "bg-border"
                      }`}
                    />
                  )}

                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}
                  >
                    {icon}
                  </div>

                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            isSkipped ? "line-through decoration-1" : ""
                          }`}
                          title={getStageDescription(activity.stage_name)}
                        >
                          {getStageLabel(activity.stage_name)}
                        </span>
                        <Badge
                          className={`text-[10px] ${
                            ACTIVITY_STATUS_COLORS[status] || ""
                          }`}
                        >
                          {status}
                        </Badge>
                        {mine && status === "In Progress" && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700">
                            Your Role
                          </Badge>
                        )}
                      </div>

                      {status === "In Progress" && (
                        <div>
                          {mine ? (
                            <div className="flex gap-1 flex-wrap justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800"
                                onClick={() => openActionDialog("forward")}
                              >
                                <ArrowRight className="w-3 h-3 mr-1" /> Complete
                                &amp; Forward
                              </Button>
                              {earlierStages.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-orange-700 hover:text-orange-800"
                                  onClick={() => openActionDialog("return")}
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" /> Return
                                  for correction
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Lock className="w-3 h-3" />{" "}
                              {ROLE_LABELS[activity.responsible_role] ||
                                activity.responsible_role}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {ROLE_LABELS[activity.responsible_role] ||
                          activity.responsible_role}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        GIO
                      </span>
                      {activity.responsible_user_name && (
                        <span>· {activity.responsible_user_name}</span>
                      )}
                      {activity.started_at && (
                        <span>
                          · Started:{" "}
                          {moment(activity.started_at).format("DD MMM, HH:mm")}
                        </span>
                      )}
                      {activity.completed_at && (
                        <span>
                          · Done:{" "}
                          {moment(activity.completed_at).format(
                            "DD MMM, HH:mm",
                          )}
                        </span>
                      )}
                    </div>

                    {activity.comments && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        &quot;{activity.comments}&quot;
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={actionOpen}
        onOpenChange={() => {
          setActionOpen(false);
          setComments("");
          setCompletionChoice("forward");
          setSelectedAdjusterId("");
          setReturnTargetOrder("");
          setActionMode("forward");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionMode === "return"
                ? `Return for Correction — ${getStageLabel(currentStage?.stage_name)}`
                : `Complete — ${getStageLabel(currentStage?.stage_name)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Case <strong>{claim.claim_reference}</strong> ·{" "}
              {claim.gio_case_reason?.replace(/_/g, " ")}
            </p>

            {actionMode === "return" && (
              <>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  Use this when earlier-stage information is wrong or
                  incomplete. The case will wait at the selected stage until it
                  is corrected and resubmitted.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Return to which stage?{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={returnTargetOrder}
                    onValueChange={setReturnTargetOrder}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an earlier stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {earlierStages.map((a) => (
                        <SelectItem key={a.id} value={String(a.stage_order)}>
                          {getStageLabel(a.stage_name)} ·{" "}
                          {ROLE_LABELS[a.responsible_role] ||
                            a.responsible_role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {actionMode === "forward" && needsAssign && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {needsManagerAssign
                    ? "Assign GIO Claim Manager *"
                    : "Assign GIO Claim Principal *"}
                </Label>
                <Select
                  value={selectedAdjusterId}
                  onValueChange={setSelectedAdjusterId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        needsManagerAssign
                          ? "Select GIO Claim Manager"
                          : "Select GIO Claim Principal"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {adjusters.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        {needsManagerAssign
                          ? "No active GIO Claim Managers found"
                          : "No active GIO Claim Principals found"}
                      </SelectItem>
                    ) : (
                      adjusters.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.full_name ||
                            [a.first_name, a.middle_name, a.last_name]
                              .filter(Boolean)
                              .join(" ") ||
                            a.position_title ||
                            a.email}
                          {a.email && a.full_name ? ` (${a.email})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showTierChoice && (
              <div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                <Label className="text-xs font-medium">
                  How should this case be handled?
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletionChoice("finalize")}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                      completionChoice === "finalize"
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Flag className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Approve & Finalize</p>
                      <p className="text-xs text-muted-foreground">
                        No further sign-off needed — remaining approval stages
                        will be skipped.
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletionChoice("forward")}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                      completionChoice === "forward"
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        Forward to{" "}
                        {nextTier
                          ? ROLE_LABELS[nextTier.role] || nextTier.role
                          : "next level"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This case needs further review before it can be
                        finalized.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">
                Comments{" "}
                {actionMode === "return" && (
                  <span className="text-red-500">*</span>
                )}
              </Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder={
                  actionMode === "return"
                    ? "What needs to be corrected..."
                    : "Notes on the decision or action taken..."
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionOpen(false);
                setComments("");
                setCompletionChoice("forward");
                setSelectedAdjusterId("");
                setReturnTargetOrder("");
                setActionMode("forward");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={processing}
              className={
                actionMode === "return"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : ""
              }
            >
              {processing
                ? "Processing..."
                : actionMode === "return"
                  ? "Confirm Return"
                  : "Confirm & Forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
