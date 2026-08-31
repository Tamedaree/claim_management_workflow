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
} from "lucide-react";
import {
  ROLE_LABELS,
  ACTIVITY_STATUS_COLORS,
  GIO_APPROVAL_TIER,
  findTierEntry,
  isLastTierStage,
  nextTierEntry,
} from "@/lib/roleConfig";
import moment from "moment";

const toDisplayStatus = (s) => {
  if (s === "In_Progress") return "In Progress";
  if (s === "On_Hold") return "On Hold";
  return s;
};

/** Stage where Chief of GIO assigns a GIO Claim Adjuster */
const ASSIGN_ADJUSTER_STAGE = "Chief of GIO Decision";

export default function GioCaseTimeline({ claim, user, onActivityUpdated }) {
  const { toast } = useToast();
  const [actionOpen, setActionOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completionChoice, setCompletionChoice] = useState("forward");
  const [adjusters, setAdjusters] = useState([]);
  const [selectedAdjusterId, setSelectedAdjusterId] = useState("");

  const activities = [...(claim?.activities || [])].sort(
    (a, b) => a.stage_order - b.stage_order,
  );

  const currentStage = activities.find((a) => a.status === "In_Progress");
  const needsAdjusterAssign =
    currentStage?.stage_name === ASSIGN_ADJUSTER_STAGE;

  const tierEntry = currentStage
    ? findTierEntry(GIO_APPROVAL_TIER, currentStage.stage_name)
    : null;
  const showTierChoice =
    tierEntry &&
    currentStage &&
    !isLastTierStage(GIO_APPROVAL_TIER, currentStage.stage_name);
  const nextTier = currentStage
    ? nextTierEntry(GIO_APPROVAL_TIER, currentStage.stage_name)
    : null;

  useEffect(() => {
    if (!actionOpen || !needsAdjusterAssign) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/users?role=gio_claim_adjuster");
        const list = (res.data.data || []).filter((u) => u.is_active !== false);
        if (!cancelled) setAdjusters(list);
      } catch {
        if (!cancelled) setAdjusters([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actionOpen, needsAdjusterAssign]);

  const selectedAdjuster = adjusters.find((a) => a.id === selectedAdjusterId);

  const handleComplete = async () => {
    if (needsAdjusterAssign && !selectedAdjusterId) {
      toast({
        title: "Select adjuster",
        description: "Choose a GIO Claim Adjuster to assign this case.",
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

      if (needsAdjusterAssign && selectedAdjuster) {
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
            ? `"${currentStage.stage_name}" finalized — no further sign-off needed.`
            : needsAdjusterAssign
              ? `"${currentStage.stage_name}" completed. Assigned to ${payload.assign_user_name}.`
              : `"${currentStage.stage_name}" forwarded to the next stage.`,
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
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">GIO Case Workflow</CardTitle>
          <Badge variant="outline" className="text-xs">
            {currentStage?.stage_name || "Not Started"}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            This case follows the fixed GIO approval sequence, independent of
            Claim Division&apos;s stages. Each approver can finalize or forward
            the case as needed.
          </p>

          <div className="space-y-0">
            {activities.map((activity, i) => {
              const status = toDisplayStatus(activity.status);
              const isLast = i === activities.length - 1;
              const mine =
                user?.role === "admin" ||
                user?.role === "chief_of_gio" ||
                activity.responsible_role === user?.role;
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
                        >
                          {activity.stage_name}
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800"
                              onClick={() => setActionOpen(true)}
                            >
                              <ArrowRight className="w-3 h-3 mr-1" /> Complete
                              &amp; Forward
                            </Button>
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
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete — {currentStage?.stage_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Case <strong>{claim.claim_reference}</strong> ·{" "}
              {claim.gio_case_reason?.replace(/_/g, " ")}
            </p>

            {/* Existing: assign GIO Claim Adjuster */}
            {needsAdjusterAssign && (
              <div className="space-y-1.5">
                <Label className="text-xs">Assign GIO Claim Adjuster *</Label>
                <Select
                  value={selectedAdjusterId}
                  onValueChange={setSelectedAdjusterId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select GIO Claim Adjuster" />
                  </SelectTrigger>
                  <SelectContent>
                    {adjusters.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No active GIO claim adjusters found
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

            {/* New: finalize vs forward */}
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
              <Label className="text-xs">Comments</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Notes on the decision or action taken..."
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
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={processing}>
              {processing ? "Processing..." : "Confirm & Forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
