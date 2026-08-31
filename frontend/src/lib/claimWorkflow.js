import api from "@/api/api";
import {
  formatCurrency,
  ROLE_LABELS,
  APPROVER_ROLE_MAP,
} from "@/lib/roleConfig";
import { findApproversByRoleAndLocation } from "@/lib/userMatching";

function getApprovalChain(claim, thresholds) {
  const match = thresholds.find(
    (t) =>
      (t.insurance_type === claim.insurance_type ||
        t.insurance_type === "All") &&
      claim.claim_amount >= t.min_amount &&
      claim.claim_amount <= t.max_amount,
  );
  return match?.approval_chain || [];
}

/**
 * Processes an approve or reject action on a single claim.
 * Mirrors the workflow logic used in the claim detail view.
 */
export async function processClaimAction(
  claim,
  actionType,
  comments,
  user,
  thresholds,
) {
  const chain = getApprovalChain(claim, thresholds);
  const currentLevel = claim.approval_level || 1;
  let updates = {};
  let nextApproverRole = null;

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
  }

  // Update claim
  await api.put(`/claims/${claim.id}`, updates);

  // Log action
  await api.post("/claim-actions", {
    claim_id: claim.id,
    action_type: actionType,
    action_by_id: user.id,
    action_by_name: user.full_name || "Unknown",
    action_by_role: ROLE_LABELS[user.role] || user.role,
    comments: comments || `Claim ${actionType.toLowerCase()} (bulk action)`,
    from_level: currentLevel,
    to_level: updates.approval_level || currentLevel,
  });

  // Notify next approver in the chain
  if (nextApproverRole) {
    const systemRole = APPROVER_ROLE_MAP[nextApproverRole];
    const approvers = await findApproversByRoleAndLocation(systemRole, claim);

    if (approvers.length > 0) {
      await api.put(`/claims/${claim.id}`, {
        current_approver_id: approvers[0].id,
      });

      for (const a of approvers.slice(0, 3)) {
        await api.post("/notifications", {
          user_id: a.id,
          claim_id: claim.id,
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

  // Notify submitter
  if (claim.submitted_by_id) {
    await api.post("/notifications", {
      user_id: claim.submitted_by_id,
      claim_id: claim.id,
      claim_reference: claim.claim_reference,
      title: `Claim ${actionType}`,
      message: `Your claim ${claim.claim_reference} has been ${actionType.toLowerCase()}. ${
        comments || ""
      }`,
      type: actionType === "Approved" ? "claim_approved" : "claim_rejected",
    });
  }
}
