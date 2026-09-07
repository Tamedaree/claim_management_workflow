import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
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
  Pause,
  User,
  Building2,
  Play,
  Lock,
  FileText,
  ArrowUpRight,
  Flag,
  Wrench,
  RotateCcw,
} from "lucide-react";
import {
  ACTIVITY_STATUS_COLORS,
  ROLE_LABELS,
  getStageLabel,
  getStageDescription,
} from "@/lib/roleConfig";
import {
  CLAIM_DIVISION_APPROVAL_TIER,
  findTierEntry,
  isLastTierStage,
  nextTierEntry,
  normalizeStageName,
} from "@/lib/roleConfig";
import { findApproversByRoleAndLocation } from "@/lib/userMatching";
import { statusForCompletedStage } from "@/lib/statusMapping";
import moment from "moment";

function buildStaffName(s) {
  if (!s) return "";
  // First + middle only (as requested)
  return [s.first_name, s.middle_name].filter(Boolean).join(" ").trim();
}

async function attachStaffNames(users) {
  if (!users?.length) return users || [];

  // Prefer names already returned by GET /users (withStaffNames on backend)
  const needsLookup = users.some(
    (u) => !u.full_name && !u.first_name && !u.middle_name,
  );
  if (!needsLookup) {
    return users.map((u) => ({
      ...u,
      full_name:
        u.full_name ||
        [u.first_name, u.middle_name].filter(Boolean).join(" ") ||
        u.email,
    }));
  }

  try {
    const staffRes = await api.get("/staff");
    const staffList = staffRes.data?.data || [];
    const nameByEmail = new Map(
      staffList.map((s) => [
        String(s.email || "").toLowerCase(),
        buildStaffName(s),
      ]),
    );

    return users.map((u) => {
      const fromStaff = nameByEmail.get(String(u.email || "").toLowerCase());
      const fromUser = [u.first_name, u.middle_name].filter(Boolean).join(" ");
      return {
        ...u,
        full_name: fromStaff || fromUser || u.full_name || u.email,
      };
    });
  } catch {
    return users.map((u) => ({
      ...u,
      full_name:
        u.full_name ||
        [u.first_name, u.middle_name].filter(Boolean).join(" ") ||
        u.email,
    }));
  }
}

const isGarageSelectionStage = (name = "") => {
  const n = (name || "").toLowerCase();
  if (n.includes("proforma")) return false;
  if (n.includes("bidding") && !n.includes("selection")) return false;
  return (
    n.includes("garage selection") ||
    n.includes("tender analysis") ||
    n.includes("select garage") ||
    (n.includes("tender") && n.includes("selection"))
  );
};

const toPrismaStatus = (s) => {
  if (s === "In Progress") return "In_Progress";
  if (s === "On Hold") return "On_Hold";
  return s;
};

const toDisplayStatus = (s) => {
  if (s === "In_Progress") return "In Progress";
  if (s === "On_Hold") return "On Hold";
  return s;
};

const filterStagesForClaim = (stagesData, claim) => {
  const type = claim?.insurance_type;
  let list = Array.isArray(stagesData) ? stagesData : [];

  // Claim Division timeline only
  list = list.filter((s) => {
    const wt = s.workflow_type || "Claim_Division";
    return wt === "Claim_Division" || wt === "Both";
  });

  if (!type) return list;

  return list.filter((s) => {
    const applicable = s.applicable_insurance_types;
    if (!applicable || (Array.isArray(applicable) && applicable.length === 0)) {
      return true; // empty = all types
    }
    const arr = Array.isArray(applicable)
      ? applicable
      : typeof applicable === "string"
        ? (() => {
            try {
              return JSON.parse(applicable);
            } catch {
              return [];
            }
          })()
        : [];
    if (arr.length === 0) return true;
    return arr.includes(type) || arr.includes("All");
  });
};

const isAdjusterAssignStage = (name = "") => {
  const n = name.toLowerCase();
  return (
    n.includes("assignment to adjuster") ||
    n.includes("principal assignment to adjuster") ||
    (n.includes("assign") && n.includes("adjuster"))
  );
};

const isPrincipalAssignStageName = (name = "") => {
  const n = name.toLowerCase();
  return (
    n.includes("claim review & assignment") ||
    n.includes("claim review and assignment") ||
    n.includes("claim manager") ||
    n.includes("manager review") ||
    n.includes("manager decision") ||
    n.includes("manager assignment") ||
    name === "Claim Review & Assignment"
  );
};

export default function WorkflowTimeline({ claim, user, onActivityUpdated }) {
  const { toast } = useToast();
  const [stages, setStages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [comments, setComments] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [adjusters, setAdjusters] = useState([]);
  const [principals, setPrincipals] = useState([]);
  const [selectedAdjusterId, setSelectedAdjusterId] = useState("");
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completionChoice, setCompletionChoice] = useState("forward");
  const [actingUserName, setActingUserName] = useState(null);
  const [nameByEmail, setNameByEmail] = useState({});
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningStage, setReturningStage] = useState(null);
  const [returnTargetOrder, setReturnTargetOrder] = useState("");
  const [returnComments, setReturnComments] = useState("");
  const [returnProcessing, setReturnProcessing] = useState(false);

  const fetchWorkflowData = async (claimId, claimData) => {
    const [stagesRes, activitiesRes] = await Promise.all([
      api.get("/workflow-stages?is_active=true"),
      api.get(`/claim-activities/claim/${claimId}`),
    ]);

    const rawStages = (stagesRes.data?.data || stagesRes.data || []).sort(
      (a, b) => a.stage_order - b.stage_order,
    );
    const stagesData = filterStagesForClaim(rawStages, claimData);

    const activitiesData = (
      activitiesRes.data?.data ||
      activitiesRes.data ||
      []
    ).sort((a, b) => a.stage_order - b.stage_order);

    return { stagesData, activitiesData };
  };

  useEffect(() => {
    if (!claim?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { stagesData, activitiesData } = await fetchWorkflowData(
          claim.id,
          claim,
        );
        if (!cancelled) {
          setStages(stagesData);
          setActivities(activitiesData);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [claim, claim.id]);

  const loadData = async () => {
    if (!claim?.id) return;
    setLoading(true);
    try {
      const { stagesData, activitiesData } = await fetchWorkflowData(
        claim.id,
        claim,
      );
      setStages(stagesData);
      setActivities(activitiesData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;

    (async () => {
      // 1) From auth user if already enriched
      const fromUser = [user.first_name, user.middle_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (fromUser) {
        setActingUserName(fromUser);
        return;
      }
      if (user.full_name && !user.full_name.includes("@")) {
        // full_name may include last name — take first two words if you only want first+middle
        const parts = user.full_name.trim().split(/\s+/);
        setActingUserName(parts.slice(0, 2).join(" "));
        return;
      }

      // 2) Staff by email (list all + match if ?email filter unsupported)
      try {
        const res = await api.get("/staff");
        const list = res.data?.data || [];
        const s = list.find(
          (x) =>
            String(x.email || "").toLowerCase() ===
            String(user.email).toLowerCase(),
        );
        const name = buildStaffName(s);
        if (!cancelled && name) setActingUserName(name);
      } catch (error) {
        console.error("Failed to load staff name:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.first_name, user?.middle_name, user?.full_name]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/staff")
      .then((res) => {
        if (cancelled) return;
        const map = {};
        for (const s of res.data?.data || []) {
          const email = String(s.email || "").toLowerCase();
          const name = [s.first_name, s.middle_name].filter(Boolean).join(" ");
          if (email && name) map[email] = name;
        }
        setNameByEmail(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const showPersonName = (value) => {
    if (!value) return "";
    const s = String(value);
    if (!s.includes("@")) return s;
    return nameByEmail[s.toLowerCase()] || s;
  };

  const getActivityForStage = (stageName) =>
    activities.find((a) => a.stage_name === stageName);

  const isMyStage = (stage) =>
    user?.role === "admin" || stage.responsible_role === user?.role;

  const visibleStages = stages;

  const canActOnStage = (stage) => {
    if (!isMyStage(stage)) return false;
    const prev = stages
      .filter((s) => s.stage_order < stage.stage_order)
      .sort((a, b) => b.stage_order - a.stage_order)[0];
    if (!prev) return true;
    const prevAct = getActivityForStage(prev.stage_name);
    const prevStatus = toDisplayStatus(prevAct?.status || "Pending");
    return prevStatus === "Completed" || prevStatus === "Skipped";
  };

  const loadPrincipals = async () => {
    try {
      let list = [];
      try {
        const res = await api.get("/users?role=principal_claim_officer");
        list = res.data?.data ?? res.data ?? [];
      } catch {
        list = [];
      }

      if (!Array.isArray(list) || list.length === 0) {
        const resAll = await api.get("/users");
        const all = resAll.data?.data ?? resAll.data ?? [];
        list = (Array.isArray(all) ? all : []).filter(
          (u) =>
            u.role === "principal_claim_officer" ||
            u.role === "principal_claim" ||
            String(u.role || "")
              .toLowerCase()
              .includes("principal"),
        );
      }

      const active = (Array.isArray(list) ? list : []).filter(
        (u) => u.is_active !== false,
      );
      setPrincipals(await attachStaffNames(active));
    } catch (err) {
      console.error("Load principals failed", err);
      setPrincipals([]);
    }
  };

  const loadAdjusters = async () => {
    try {
      let list = [];
      try {
        const res = await api.get("/users?role=claim_adjuster");
        list = res.data?.data ?? res.data ?? [];
      } catch {
        list = [];
      }
      if (!Array.isArray(list) || list.length === 0) {
        const resAll = await api.get("/users");
        const all = resAll.data?.data ?? resAll.data ?? [];
        list = (Array.isArray(all) ? all : []).filter(
          (u) => u.role === "claim_adjuster",
        );
      }
      const active = (Array.isArray(list) ? list : []).filter(
        (u) => u.is_active !== false,
      );
      setAdjusters(await attachStaffNames(active));
    } catch (err) {
      console.error("Load adjusters failed", err);
      setAdjusters([]);
    }
  };

  const openActionModal = async (stage, activity, newStatus) => {
    if (!isMyStage(stage)) {
      toast({
        title: "Not your stage",
        description: `This stage is assigned to ${
          ROLE_LABELS[stage.responsible_role] || stage.responsible_role
        }.`,
        variant: "destructive",
      });
      return;
    }

    if (!canActOnStage(stage) && newStatus !== "On Hold") {
      toast({
        title: "Complete previous stage first",
        description:
          "This workflow is sequential. Complete the previous stage before acting here.",
        variant: "destructive",
      });
      return;
    }

    setActionModal({ stage, activity, newStatus });
    setComments(activity?.comments || "");
    setReviewDate(activity?.registration_data?.review_date || "");
    setSelectedAdjusterId(
      activity?.registration_data?.assigned_adjuster_id || "",
    );
    setSelectedPrincipalId(
      activity?.registration_data?.principal_of_claim_id || "",
    );
    setCompletionChoice("forward");

    if (isAdjusterAssignStage(stage.stage_name)) {
      await loadAdjusters();
    }
    if (isPrincipalAssignStageName(stage.stage_name)) {
      await loadPrincipals();
    }
  };

  const openReturnModal = (stage) => {
    setReturningStage(stage);
    setReturnTargetOrder("");
    setReturnComments("");
    setReturnModalOpen(true);
  };

  const earlierStagesFor = (stage) =>
    stages
      .filter((s) => s.stage_order < stage.stage_order)
      .sort((a, b) => b.stage_order - a.stage_order); // most recent first

  const handleReturnConfirm = async () => {
    if (!returningStage) return;

    if (!returnTargetOrder) {
      toast({
        title: "Select a stage",
        description: "Choose which earlier stage to return this claim to.",
        variant: "destructive",
      });
      return;
    }

    if (!returnComments.trim()) {
      toast({
        title: "Comments required",
        description: "Explain why this claim is being returned.",
        variant: "destructive",
      });
      return;
    }

    setReturnProcessing(true);
    try {
      const targetOrder = Number(returnTargetOrder);
      const targetStage = stages.find((s) => s.stage_order === targetOrder);
      if (!targetStage) throw new Error("Target stage not found");

      const now = new Date().toISOString();
      const actorName = actingUserName || user.full_name || user.email;

      const inRangeStages = stages.filter(
        (s) =>
          s.stage_order >= targetStage.stage_order &&
          s.stage_order <= returningStage.stage_order,
      );

      for (const s of inRangeStages) {
        const existingActivity = activities.find(
          (a) => a.stage_name === s.stage_name,
        );
        const isTarget = s.stage_order === targetStage.stage_order;

        const resetData = isTarget
          ? {
              status: "In_Progress",
              started_at: now,
              completed_at: null,
              comments: `Returned for correction: ${returnComments}`,
            }
          : {
              status: "Pending",
              started_at: null,
              completed_at: null,
              comments: null,
            };

        if (existingActivity) {
          await api.put(`/claim-activities/${existingActivity.id}`, resetData);
        } else if (isTarget) {
          await api.post("/claim-activities", {
            claim_id: claim.id,
            claim_reference: claim.claim_reference,
            stage_name: s.stage_name,
            stage_order: s.stage_order,
            department: s.department,
            ...resetData,
          });
        }
      }

      await api.put(`/claims/${claim.id}`, {
        workflow_stage: targetStage.stage_name,
        workflow_stage_order: targetStage.stage_order,
        current_department: targetStage.department,
        status: "Returned_for_Correction",
      });

      await api.post("/claim-actions", {
        claim_id: claim.id,
        action_type: "Returned",
        action_by_id: user.id,
        action_by_name: actorName,
        action_by_role: ROLE_LABELS[user.role] || user.role,
        comments: `Returned from "${returningStage.stage_name}" to "${targetStage.stage_name}": ${returnComments}`,
      });

      const targetRoleLabel =
        ROLE_LABELS[targetStage.responsible_role] ||
        targetStage.responsible_role;

      try {
        const recipients = await findApproversByRoleAndLocation(
          targetStage.responsible_role,
          claim,
        );
        await Promise.all(
          recipients.slice(0, 5).map((u) =>
            api.post("/notifications", {
              user_id: u.id,
              claim_id: claim.id,
              claim_reference: claim.claim_reference,
              title: `Claim returned: ${claim.claim_reference}`,
              message: `${actorName} returned this claim to "${targetStage.stage_name}" for correction. Reason: ${returnComments}`,
              type: "claim_returned",
            }),
          ),
        );
      } catch {
        // notification failure shouldn't block the return itself
      }

      toast({
        title: "Claim returned",
        description: `Sent back to "${targetStage.stage_name}" (${targetRoleLabel}).`,
      });

      setReturnModalOpen(false);
      setReturningStage(null);
      setReturnTargetOrder("");
      setReturnComments("");
      await loadData();
      if (onActivityUpdated) onActivityUpdated();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to return claim.",
        variant: "destructive",
      });
    } finally {
      setReturnProcessing(false);
    }
  };

  const isAssignmentStage =
    actionModal?.stage && isAdjusterAssignStage(actionModal.stage.stage_name);

  const isPrincipalAssignStage =
    actionModal?.stage &&
    isPrincipalAssignStageName(actionModal.stage.stage_name);

  // Is this the tier decision UI relevant for the current modal?
  const modalTierEntry =
    actionModal?.stage &&
    findTierEntry(CLAIM_DIVISION_APPROVAL_TIER, actionModal.stage.stage_name);
  const showTierChoice =
    actionModal?.newStatus === "Completed" &&
    modalTierEntry &&
    !isLastTierStage(
      CLAIM_DIVISION_APPROVAL_TIER,
      actionModal.stage.stage_name,
    );
  const nextTier = actionModal?.stage
    ? nextTierEntry(CLAIM_DIVISION_APPROVAL_TIER, actionModal.stage.stage_name)
    : null;

  const handleAction = async () => {
    if (!actionModal) return;

    if (isAssignmentStage && !selectedAdjusterId) {
      toast({
        title: "Required field",
        description: "Please select a claim adjuster to assign.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const stage = actionModal.stage;
      const existing = actionModal.activity;
      const uiStatus = actionModal.newStatus;
      const prismaStatus = toPrismaStatus(uiStatus);
      const now = new Date().toISOString();

      const actorName = actingUserName || user.full_name || null;

      if (!actorName || String(actorName).includes("@")) {
        toast({
          title: "Name not loaded",
          description:
            "Your staff first/middle name is missing. Fix Staff profile or wait for name to load.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }
      let registrationData = { ...(existing?.registration_data || {}) };

      if (isAssignmentStage) {
        registrationData = {
          ...registrationData,
          review_date: reviewDate || "",
          assigned_adjuster_id: selectedAdjusterId,
          assigned_adjuster_name:
            adjusters.find((a) => a.id === selectedAdjusterId)?.full_name ||
            adjusters.find((a) => a.id === selectedAdjusterId)?.email ||
            "",
        };
      }

      if (isPrincipalAssignStage) {
        const principal = principals.find((p) => p.id === selectedPrincipalId);
        registrationData = {
          ...registrationData,
          principal_of_claim_id: selectedPrincipalId || "",
          principal_of_claim_name:
            principal?.full_name || principal?.email || "",
          manager_comments: comments || "",
        };
      }

      const activityData = {
        status: prismaStatus,
        comments: comments || existing?.comments || "",
        responsible_user_id: user.id,
        responsible_user_name: actorName,
        responsible_role: user.role,
        department: stage.department,
        registration_data: registrationData,
        started_at:
          prismaStatus === "In_Progress" && !existing?.started_at
            ? now
            : existing?.started_at || null,
        completed_at:
          prismaStatus === "Completed" ? now : existing?.completed_at || null,
      };

      if (existing) {
        await api.put(`/claim-activities/${existing.id}`, activityData);
      } else {
        await api.post("/claim-activities", {
          claim_id: claim.id,
          claim_reference: claim.claim_reference,
          stage_name: stage.stage_name,
          stage_order: stage.stage_order,
          ...activityData,
        });
      }

      const principalName =
        principals.find((p) => p.id === selectedPrincipalId)?.full_name ||
        principals.find((p) => p.id === selectedPrincipalId)?.email ||
        "";
      const adjusterName =
        adjusters.find((a) => a.id === selectedAdjusterId)?.full_name ||
        adjusters.find((a) => a.id === selectedAdjusterId)?.email ||
        "";

      await api.post("/claim-actions", {
        claim_id: claim.id,
        action_type:
          prismaStatus === "Completed"
            ? "Forwarded"
            : prismaStatus === "In_Progress"
              ? "Comment"
              : "Comment",
        action_by_id: user.id,
        action_by_name: actorName,
        action_by_role: ROLE_LABELS[user.role] || user.role,
        comments:
          (comments ? `${comments} · ` : "") +
          `${uiStatus}: ${stage.stage_name}` +
          (showTierChoice
            ? ` · ${completionChoice === "finalize" ? "Finalized (no further sign-off)" : `Forwarded to ${nextTier ? ROLE_LABELS[nextTier.role] || nextTier.role : "next level"}`}`
            : "") +
          (isPrincipalAssignStage && principalName
            ? ` · Principal: ${principalName}`
            : "") +
          (isAssignmentStage && adjusterName
            ? ` · Adjuster: ${adjusterName}`
            : ""),
      });

      if (prismaStatus === "Completed") {
        let nextStage = stages.find((s) => s.stage_order > stage.stage_order);

        const tierEntry = findTierEntry(
          CLAIM_DIVISION_APPROVAL_TIER,
          stage.stage_name,
        );
        const isTierDecision =
          tierEntry &&
          !isLastTierStage(CLAIM_DIVISION_APPROVAL_TIER, stage.stage_name);
        const shouldSkip = isTierDecision && completionChoice === "finalize";

        if (shouldSkip) {
          const tierNames = new Set(
            CLAIM_DIVISION_APPROVAL_TIER.map((t) =>
              normalizeStageName(t.stage_name),
            ),
          );
          const remainingTierStages = stages.filter(
            (s) =>
              s.stage_order > stage.stage_order &&
              tierNames.has(normalizeStageName(s.stage_name)),
          );

          for (const skipStage of remainingTierStages) {
            const existingActivity = activities.find(
              (a) => a.stage_name === skipStage.stage_name,
            );
            const skipData = {
              status: "Skipped",
              comments: `Skipped — ${
                ROLE_LABELS[user.role] || user.role
              } approved and finalized without further sign-off.`,
            };
            if (existingActivity) {
              await api.put(
                `/claim-activities/${existingActivity.id}`,
                skipData,
              );
            } else {
              await api.post("/claim-activities", {
                claim_id: claim.id,
                claim_reference: claim.claim_reference,
                stage_name: skipStage.stage_name,
                stage_order: skipStage.stage_order,
                department: skipStage.department,
                ...skipData,
              });
            }
          }

          const maxTierOrder = Math.max(
            stage.stage_order,
            ...remainingTierStages.map((s) => s.stage_order),
          );
          nextStage = stages.find((s) => s.stage_order > maxTierOrder);
        }

        const isFinalStage = !nextStage;
        const claimHasFinalStatus = ["Approved", "Rejected"].includes(
          claim.status,
        );

        const mappedStatus = statusForCompletedStage(
          stage.stage_name,
          "Claim_Division",
          claim.status,
        );

        const claimUpdates = {
          workflow_stage: stage.stage_name,
          workflow_stage_order: stage.stage_order,
          current_owner_id: user.id,
          current_owner_name: actorName,
          current_department: stage.department,
          ...(!claimHasFinalStatus && {
            status: mappedStatus,
            ...(isFinalStage && { closure_date: now }),
          }),
        };

        if (isAssignmentStage && selectedAdjusterId) {
          const adjuster = adjusters.find((a) => a.id === selectedAdjusterId);
          claimUpdates.assigned_performer_id = selectedAdjusterId;
          claimUpdates.assigned_performer_name =
            adjuster?.full_name || adjuster?.email || "";
          claimUpdates.assignment_date = new Date().toISOString().slice(0, 10);
          claimUpdates.current_owner_id = selectedAdjusterId;
          claimUpdates.current_owner_name =
            adjuster?.full_name || adjuster?.email || "";
        }

        if (isPrincipalAssignStage && selectedPrincipalId) {
          const principal = principals.find(
            (p) => p.id === selectedPrincipalId,
          );
          claimUpdates.current_owner_id = selectedPrincipalId;
          claimUpdates.current_owner_name =
            principal?.full_name || principal?.email || "";
        }

        await api.put(`/claims/${claim.id}`, claimUpdates);

        const completedByRole = ROLE_LABELS[user.role] || user.role;

        if (nextStage) {
          const nextRoleLabel =
            ROLE_LABELS[nextStage.responsible_role] ||
            nextStage.responsible_role;

          let recipients = await findApproversByRoleAndLocation(
            nextStage.responsible_role,
            claim,
          );

          if (!recipients.length) {
            console.warn("No recipients for", nextStage.responsible_role);
            toast({
              title: "Stage completed",
              description: `No users found with role ${nextRoleLabel} to notify.`,
            });
          } else {
            await Promise.all(
              recipients.slice(0, 5).map((u) =>
                api.post("/notifications", {
                  user_id: u.id,
                  claim_id: claim.id,
                  claim_reference: claim.claim_reference,
                  title: `New Task: ${nextStage.stage_name}`,
                  message: `${completedByRole} completed "${stage.stage_name}" on claim ${claim.claim_reference}. Action needed as ${nextRoleLabel} on "${nextStage.stage_name}".`,
                  type: "approval_required",
                }),
              ),
            );
          }

          await api.put(`/claims/${claim.id}`, {
            current_department: nextStage.department,
            workflow_stage: nextStage.stage_name,
            workflow_stage_order: nextStage.stage_order,
          });
        } else if (claim.submitted_by_id) {
          await api.post("/notifications", {
            user_id: claim.submitted_by_id,
            claim_id: claim.id,
            claim_reference: claim.claim_reference,
            title: "Workflow Complete",
            message: `All workflow stages for claim ${claim.claim_reference} have been completed by ${completedByRole}.`,
            type: "claim_approved",
          });
        }
      }

      toast({
        title: "Activity updated",
        description: `${stage.stage_name} marked as ${uiStatus}.`,
      });
      setActionModal(null);
      setComments("");
      setReviewDate("");
      setSelectedAdjusterId("");
      setSelectedPrincipalId("");
      setCompletionChoice("forward");
      await loadData();
      if (onActivityUpdated) onActivityUpdated();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to update activity.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Workflow Activity Timeline</CardTitle>
          <Badge
            variant="outline"
            className="text-xs"
            title={getStageDescription(claim.workflow_stage)}
          >
            {getStageLabel(claim.workflow_stage) || "Not Started"}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Full claim flow — all stages visible. Only the responsible role can
            act; others see a lock. Stages advance step by step.
          </p>

          {visibleStages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No workflow stages configured.
            </p>
          ) : (
            <div className="space-y-0">
              {visibleStages.map((stage, i) => {
                const activity = getActivityForStage(stage.stage_name);
                const status = toDisplayStatus(activity?.status || "Pending");
                const isLast = i === visibleStages.length - 1;
                const myStage = isMyStage(stage);
                const unlocked = canActOnStage(stage);
                const isSkipped = status === "Skipped";

                const icon =
                  status === "Completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : status === "In Progress" ? (
                    <Clock className="w-4 h-4 text-blue-600" />
                  ) : status === "On Hold" ? (
                    <Pause className="w-4 h-4 text-amber-600" />
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
                      : status === "On Hold"
                        ? "bg-amber-50"
                        : isSkipped
                          ? "bg-slate-50"
                          : "bg-gray-50";

                return (
                  <div
                    key={stage.id || stage.stage_name}
                    className={`flex gap-3 pb-3 relative ${
                      myStage && unlocked
                        ? "ring-1 ring-blue-200 rounded-lg p-2 -m-1"
                        : ""
                    } ${isSkipped ? "opacity-60" : ""}`}
                  >
                    {!isLast && (
                      <div
                        className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${
                          status === "Completed"
                            ? "bg-emerald-200"
                            : "bg-border"
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium ${
                              isSkipped ? "line-through decoration-1" : ""
                            }`}
                            title={
                              getStageDescription(stage.stage_name) ||
                              stage.description
                            }
                          >
                            {getStageLabel(stage.stage_name)}
                          </span>
                          <Badge
                            className={`text-[10px] ${
                              ACTIVITY_STATUS_COLORS[status] || ""
                            }`}
                          >
                            {status}
                          </Badge>
                          {myStage && (
                            <Badge className="text-[10px] bg-blue-100 text-blue-700">
                              Your Role
                            </Badge>
                          )}
                          {!unlocked &&
                            myStage &&
                            status !== "Completed" &&
                            status !== "Skipped" && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800">
                                Waiting previous stage
                              </Badge>
                            )}
                        </div>

                        {status !== "Completed" && status !== "Skipped" && (
                          <div className="flex gap-1">
                            {myStage && unlocked ? (
                              <>
                                {status === "Pending" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() =>
                                      openActionModal(
                                        stage,
                                        activity,
                                        "In Progress",
                                      )
                                    }
                                  >
                                    <Play className="w-3 h-3 mr-1" /> Start
                                  </Button>
                                )}
                                {(status === "In Progress" ||
                                  status === "On Hold") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800"
                                    onClick={() =>
                                      openActionModal(
                                        stage,
                                        activity,
                                        "Completed",
                                      )
                                    }
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />{" "}
                                    Complete
                                  </Button>
                                )}
                                {status !== "On Hold" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() =>
                                      openActionModal(
                                        stage,
                                        activity,
                                        "On Hold",
                                      )
                                    }
                                  >
                                    <Pause className="w-3 h-3 mr-1" /> Hold
                                  </Button>
                                )}
                                {earlierStagesFor(stage).length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-orange-700 hover:text-orange-800"
                                    onClick={() => openReturnModal(stage)}
                                  >
                                    <RotateCcw className="w-3 h-3 mr-1" />{" "}
                                    Return
                                  </Button>
                                )}
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Lock className="w-3 h-3" />{" "}
                                {ROLE_LABELS[stage.responsible_role] ||
                                  stage.responsible_role}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {ROLE_LABELS[stage.responsible_role] ||
                            stage.responsible_role}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {stage.department
                            ? stage.department.replace(/_/g, " ")
                            : "—"}
                        </span>
                        {activity?.responsible_user_name && (
                          <span>
                            · {showPersonName(activity.responsible_user_name)}
                          </span>
                        )}
                        {activity?.started_at && (
                          <span>
                            · Started:{" "}
                            {moment(activity.started_at).format(
                              "DD MMM, HH:mm",
                            )}
                          </span>
                        )}
                        {activity?.completed_at && (
                          <span>
                            · Done:{" "}
                            {moment(activity.completed_at).format(
                              "DD MMM, HH:mm",
                            )}
                          </span>
                        )}
                      </div>

                      {isAdjusterAssignStage(stage.stage_name) &&
                        activity?.registration_data?.assigned_adjuster_name && (
                          <div className="mt-2 p-2 bg-muted/30 rounded-md text-[10px]">
                            <span className="text-muted-foreground">
                              Adjuster:{" "}
                            </span>
                            <span className="font-medium">
                              {
                                activity.registration_data
                                  .assigned_adjuster_name
                              }
                            </span>
                            {activity.registration_data.review_date && (
                              <span className="ml-2">
                                · Review:{" "}
                                {activity.registration_data.review_date}
                              </span>
                            )}
                          </div>
                        )}

                      {isPrincipalAssignStageName(stage.stage_name) &&
                        activity?.registration_data
                          ?.principal_of_claim_name && (
                          <div className="mt-2 p-2 bg-muted/30 rounded-md text-[10px]">
                            <span className="text-muted-foreground">
                              Principal of Claim:{" "}
                            </span>
                            <span className="font-medium">
                              {
                                activity.registration_data
                                  .principal_of_claim_name
                              }
                            </span>
                          </div>
                        )}

                      {activity?.comments && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          &quot;{activity.comments}&quot;
                        </p>
                      )}
                      {claim.insurance_type === "Motor" &&
                        isGarageSelectionStage(stage.stage_name) &&
                        (status === "In Progress" || status === "Pending") &&
                        myStage && (
                          <Link
                            to="/garages"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-primary font-medium hover:underline"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Open Garage Tracking
                          </Link>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!actionModal}
        onOpenChange={() => {
          setActionModal(null);
          setComments("");
          setReviewDate("");
          setSelectedAdjusterId("");
          setSelectedPrincipalId("");
          setCompletionChoice("forward");
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionModal?.newStatus === "Completed"
                ? "Complete"
                : actionModal?.newStatus === "On Hold"
                  ? "Hold"
                  : "Start"}{" "}
              — {getStageLabel(actionModal?.stage?.stage_name)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Claim <strong>{claim.claim_reference}</strong> ·{" "}
              {claim.insurance_type} · Stage {actionModal?.stage?.stage_order}
            </p>

            {isAssignmentStage && (
              <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Assignment Details
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Review Date</Label>
                    <Input
                      type="date"
                      value={reviewDate}
                      onChange={(e) => setReviewDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Claim Adjuster <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={selectedAdjusterId}
                      onValueChange={setSelectedAdjusterId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select claim adjuster..." />
                      </SelectTrigger>
                      <SelectContent>
                        {adjusters.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No claim adjusters found
                          </SelectItem>
                        ) : (
                          adjusters.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.full_name || a.email}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {isPrincipalAssignStage && (
              <div className="space-y-3 p-3 bg-violet-50/50 rounded-lg border border-violet-100">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4 text-violet-600" />
                  Principal of Claim
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Select Principal of Claim</Label>
                  <Select
                    value={selectedPrincipalId}
                    onValueChange={setSelectedPrincipalId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select principal of claim..." />
                    </SelectTrigger>
                    <SelectContent>
                      {principals.length === 0 ? (
                        <SelectItem value="_none" disabled>
                          No principal officers found — check role name in Users
                        </SelectItem>
                      ) : (
                        principals.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {showTierChoice && (
              <div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                <Label className="text-xs font-medium">
                  How should this claim be handled?
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
                        This claim needs further review before it can be
                        finalized.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
            {actionModal?.stage &&
              claim.insurance_type === "Motor" &&
              isGarageSelectionStage(actionModal.stage.stage_name) && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm space-y-2">
                  <p>
                    Use Garage Tracking to review tenders and select the garage
                    for this claim.
                  </p>
                  <Link
                    to="/garages"
                    className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                  >
                    <Wrench className="w-4 h-4" />
                    Go to Garages
                  </Link>
                </div>
              )}
            <div className="space-y-1.5">
              <Label className="text-xs">Comments</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Add notes about this activity..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionModal(null);
                setComments("");
                setReviewDate("");
                setSelectedAdjusterId("");
                setSelectedPrincipalId("");
                setCompletionChoice("forward");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={processing}>
              {processing
                ? "Processing..."
                : `Confirm ${actionModal?.newStatus}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={returnModalOpen}
        onOpenChange={() => {
          setReturnModalOpen(false);
          setReturningStage(null);
          setReturnTargetOrder("");
          setReturnComments("");
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Return Claim — {getStageLabel(returningStage?.stage_name)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Claim <strong>{claim.claim_reference}</strong> will be sent back
              for correction. Every stage between your choice and this one will
              need to be redone.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Return to which stage? <span className="text-red-500">*</span>
              </Label>
              <Select
                value={returnTargetOrder}
                onValueChange={setReturnTargetOrder}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an earlier stage..." />
                </SelectTrigger>
                <SelectContent>
                  {returningStage &&
                    earlierStagesFor(returningStage).map((s) => (
                      <SelectItem key={s.id} value={String(s.stage_order)}>
                        {getStageLabel(s.stage_name)} ·{" "}
                        {ROLE_LABELS[s.responsible_role] || s.responsible_role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Reason for return <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={returnComments}
                onChange={(e) => setReturnComments(e.target.value)}
                rows={3}
                placeholder="What needs to be corrected..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnModalOpen(false);
                setReturningStage(null);
                setReturnTargetOrder("");
                setReturnComments("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReturnConfirm}
              disabled={returnProcessing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {returnProcessing ? "Returning..." : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
