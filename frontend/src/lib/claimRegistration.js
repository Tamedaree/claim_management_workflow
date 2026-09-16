import api from "@/api/api";
import { ROLE_LABELS, toEnumKey, GIO_WORKFLOW_STAGES } from "@/lib/roleConfig";

// Forwarding office types per registration type
export const NEW_CLAIM_OFFICE_TYPES = [
  "District Office",
  "Kefla Ager Branch",
];
export const FORWARDED_CLAIM_OFFICE_TYPES = [
  "Service Center",
  "District Office",
];

export const REGISTRATION_TYPES = [
  {
    value: "New Claim Notification",
    label: "New Claim Notification",
    description: "Kefla Ager Branch",
  },
  {
    value: "GIO Case",
    label: "GIO Case",
    description: "GIO approval / advice / management decision",
  },
];

export async function uploadFiles(files, toast) {
  const uploaded = [];

  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const fileUrl =
        res.data?.file_url || res.data?.url || res.data?.data?.url;
      if (fileUrl) {
        uploaded.push({ name: file.name, url: fileUrl });
      }
    } catch {
      toast?.({
        title: "Upload failed",
        description: `Could not upload ${file.name}`,
        variant: "destructive",
      });
    }
  }

  return uploaded;
}

export async function fetchExistingClaimants(workflowType = "Claim_Division") {
  const res = await api.get("/claims");
  let claims = res.data?.data || [];

  if (workflowType === "Claim_Division") {
    claims = claims.filter((c) => c.workflow_type !== "GIO_Approval");
  } else if (workflowType === "GIO_Approval") {
    claims = claims.filter((c) => c.workflow_type === "GIO_Approval");
  }

  return [
    ...new Set(claims.map((c) => c.claimant_name?.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
}

export async function checkExistingClaim(
  reference,
  workflowType = null, // null = any; "GIO_Approval" | "Claim_Division"
) {
  const ref = (reference || "").trim();
  if (!ref) return null;

  const res = await api.get(
    `/claims?claim_reference=${encodeURIComponent(ref)}`,
  );
  let list = res.data?.data || [];

  if (workflowType === "GIO_Approval") {
    list = list.filter((c) => c.workflow_type === "GIO_Approval");
  } else if (workflowType === "Claim_Division") {
    list = list.filter(
      (c) => (c.workflow_type || "Claim_Division") !== "GIO_Approval",
    );
  }

  return (
    list.find((c) => c.claim_reference?.toLowerCase() === ref.toLowerCase()) ||
    null
  );
}
async function resolveSubmitterName(user) {
  let submitterName = user?.full_name || user?.email || "Unknown";
  try {
    if (user?.email) {
      const staffRes = await api.get(
        `/staff?email=${encodeURIComponent(user.email)}`,
      );
      const staff = staffRes.data.data || [];
      if (staff.length > 0) {
        const s = staff[0];
        submitterName =
          [s.first_name, s.middle_name].filter(Boolean).join(" ") ||
          s.first_name ||
          user?.full_name ||
          "Unknown";
      }
    }
  } catch {
    // keep fallback
  }
  return submitterName;
}

export async function registerClaim(
  claimData,
  user,
  { asDraft = false, stageName = "Claim Receipt & Registration" } = {},
) {
  const finalStatus = asDraft
    ? "Draft"
    : claimData.status || "Notification_Received";

  const normalizedClaimData = {
    ...claimData,
    registration_type: toEnumKey(
      claimData.registration_type || "New Claim Notification",
    ),
    originating_office_type: toEnumKey(claimData.originating_office_type),
  };

  const submitterName = await resolveSubmitterName(user);

  const createRes = await api.post("/claims", {
    claim_reference: normalizedClaimData.claim_reference,
    claimant_name: normalizedClaimData.claimant_name,
    insurance_type: normalizedClaimData.insurance_type,
    plate_number:
      normalizedClaimData.insurance_type === "Motor"
        ? normalizedClaimData.plate_number || null
        : null,
    policy_number: null,
    cover_type: null,
    claim_amount: 0,
    incident_date:
      normalizedClaimData.date_received ||
      new Date().toISOString().slice(0, 10),
    incident_description: null,
    originating_office: normalizedClaimData.originating_office,
    originating_office_type: normalizedClaimData.originating_office_type,
    received_reference_number:
      normalizedClaimData.received_reference_number || null,
    date_received: normalizedClaimData.date_received || null,
    remarks: normalizedClaimData.remarks || null,
    documents: [],
    priority: "Medium",
    registration_type: normalizedClaimData.registration_type,
    submitted_by_id: user?.id,
    submitted_by_name: submitterName,
    status: finalStatus,
    workflow_type: "Claim_Division",
    current_department: "Claim_Division",
    registration_complete: false,
    submission_date: asDraft ? undefined : new Date().toISOString(),
    workflow_stage: asDraft ? null : stageName,
    workflow_stage_order: asDraft ? 0 : 1,
    current_owner_id: asDraft ? null : user?.id,
    current_owner_name: asDraft ? null : submitterName,
    current_approver_role: "None",
    approval_level: 0,
    return_count: 0,
  });

  const created = createRes.data.data || createRes.data;

  if (!asDraft) {
    await api.post("/claim-activities", {
      claim_id: created.id,
      claim_reference: normalizedClaimData.claim_reference,
      stage_name: stageName,
      stage_order: 1,
      status: "Completed",
      responsible_user_id: user?.id,
      responsible_user_name: submitterName,
      responsible_role: ROLE_LABELS[user?.role] || user?.role,
      department: "Claim_Division",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      comments: normalizedClaimData.remarks || "Claim notification registered",
    });

    // Move to next stage (assignment) — adjust name to your WorkflowStage list
    const nextStageName = "Claim Assignment";
    let nextOwnerId = null;
    let nextOwnerName = null;

    try {
      const usersRes = await api.get("/users?role=principal_claim_officer");
      const list = usersRes.data.data || [];
      if (list[0]) {
        nextOwnerId = list[0].id;
        nextOwnerName = list[0].full_name || list[0].email;
      }
    } catch {
      /* ignore */
    }

    await api.put(`/claims/${created.id}`, {
      workflow_stage: nextStageName,
      workflow_stage_order: 2,
      status: "Pending_Assignment",
      current_owner_id: nextOwnerId,
      current_owner_name: nextOwnerName,
    });

    await api.post("/claim-activities", {
      claim_id: created.id,
      claim_reference: normalizedClaimData.claim_reference,
      stage_name: nextStageName,
      stage_order: 2,
      status: "Pending",
      responsible_user_id: nextOwnerId,
      responsible_user_name: nextOwnerName,
      responsible_role: "Principal Claim Officer",
      department: "Claim_Division",
      comments: "Awaiting assignment",
    });

    if (nextOwnerId) {
      try {
        await api.post("/notifications", {
          user_id: nextOwnerId,
          claim_id: created.id,
          claim_reference: normalizedClaimData.claim_reference,
          title: "New claim notification",
          message: `${normalizedClaimData.claim_reference} registered — full details pending Claim Adjuster.`,
          type: "approval_required",
        });
      } catch {
        /* ignore */
      }
    }
  }

  return created;
}

/** Generate GIO case reference e.g. GIO-2026-4821 */
export function generateGioReference() {
  const y = new Date().getFullYear();
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  return `GIO-${y}-${n}`;
}

export async function findClaimsByClaimNumber(claimNumber) {
  const n = (claimNumber || "").trim();
  if (!n) return [];
  const res = await api.get(
    `/claims?claim_number=${encodeURIComponent(n)}&limit=20`,
  );
  return res.data?.data || [];
}

export function isClaimOpen(c) {
  if (!c) return false;
  if (c.status === "Closed" || c.status === "Rejected") return false;
  if (c.workflow_stage === "GIO Case Closure" && c.status === "Closed")
    return false;
  // still active
  return true;
}

/**
 * Register a GIO case (workflow_type = GIO_Approval)
 * form.gio_case_reason must be Prisma enum key (e.g. Payment_Approval)
 */
export async function registerGioCase(form, user, { asDraft = false } = {}) {
  const submitterName = await resolveSubmitterName(user);
  const claim_reference = form.claim_reference || generateGioReference();
  const gio_case_reason = form.gio_case_reason;

  if (!gio_case_reason) {
    throw new Error("Case reason is required");
  }
  if (!form.claimant_name?.trim()) {
    throw new Error("Insured name is required");
  }
  if (!form.insurance_type) {
    throw new Error("Insurance type is required");
  }
  if (!form.incident_date) {
    throw new Error("Incident date is required");
  }

  const createRes = await api.post("/claims", {
    claim_reference,
    policy_number: form.policy_number || null,
    claimant_name: form.claimant_name.trim(),
    injured_name: form.injured_name?.trim() || form.claimant_name.trim(),
    insurance_type: form.insurance_type,
    cover_type: form.cover_type || null,
    plate_number: form.plate_number || null,
    claim_amount: parseFloat(form.claim_amount) || 0,
    incident_date: form.incident_date,
    incident_description: form.incident_description || null,
    originating_office: form.originating_office || null,
    originating_office_type: toEnumKey(form.originating_office_type),
    received_reference_number: form.received_reference_number || null,
    date_received: form.date_received || null,
    claim_number: form.claim_number || null,
    final_approval_amount:
      form.final_approval_amount != null && form.final_approval_amount !== ""
        ? Number(form.final_approval_amount)
        : null,
    motor_vehicle_type: form.motor_vehicle_type || null,

    is_recovery: !!form.is_recovery,
    is_subrogation: !!form.is_subrogation,
    is_reinsurance: !!form.is_reinsurance,
    is_rebid: !!form.is_rebid,
    has_independent_assessor: !!form.has_independent_assessor,

    rebid_participating_garages: Array.isArray(form.rebid_participating_garages)
      ? form.rebid_participating_garages
      : [],
    rebid_winner_garage: form.rebid_winner_garage || null,
    independent_assessor_name: form.independent_assessor_name || null,

    registration_data: form.registration_data || null,
    workflow_type: "GIO_Approval",
    gio_case_reason,
    priority: form.priority || "Medium",
    remarks: form.remarks || null,
    documents: form.documents || [],
    registration_type: "New_Claim_Notification",
    assigned_performer_id: form.assigned_performer_id || null,
    assigned_performer_name: form.assigned_performer_name || null,
    assignment_date: form.assigned_performer_id
      ? new Date().toISOString()
      : null,
    due_date: form.due_date || null,
    submitted_by_id: user?.id,
    submitted_by_name: submitterName,
    status: asDraft ? "Draft" : "Submitted",
    current_department: "GIO",
    submission_date: asDraft ? undefined : new Date().toISOString(),
    workflow_stage: asDraft ? null : "GIO Case Registration",
    workflow_stage_order: asDraft ? 0 : 1,
    current_owner_id: asDraft ? null : user?.id,
    current_owner_name: asDraft ? null : submitterName,
    current_approver_role: "None",
    approval_level: 0,
    return_count: 0,
    auto_submit: !asDraft,
  });

  const created = createRes.data.data || createRes.data;

  // If backend already created activities (auto_submit), skip frontend stage creation
  if (!asDraft && !(created.activities && created.activities.length > 0)) {
    const stages = GIO_WORKFLOW_STAGES || [];
    const now = new Date().toISOString();

    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await api.post("/claim-activities", {
        claim_id: created.id,
        claim_reference,
        stage_name: s.stage_name,
        stage_order: s.stage_order,
        status: i === 0 ? "Completed" : i === 1 ? "In_Progress" : "Pending",
        responsible_role: s.responsible_role,
        department: s.department || "GIO",
        responsible_user_id:
          i === 0
            ? user?.id
            : i === 1
              ? form.assigned_performer_id || null
              : null,
        responsible_user_name:
          i === 0
            ? submitterName
            : i === 1
              ? form.assigned_performer_name || null
              : null,
        started_at: i === 0 || i === 1 ? now : null,
        completed_at: i === 0 ? now : null,
        comments:
          i === 0
            ? form.remarks || `GIO case registered: ${gio_case_reason}`
            : null,
      });
    }

    const next = stages[1];
    if (next) {
      let nextOwnerId = form.assigned_performer_id || null;
      let nextOwnerName = form.assigned_performer_name || null;

      if (!nextOwnerId) {
        try {
          const usersRes = await api.get(
            `/users?role=${next.responsible_role}`,
          );
          const list = usersRes.data.data || [];
          if (list.length > 0) {
            nextOwnerId = list[0].id;
            nextOwnerName =
              list[0].full_name || list[0].position_title || list[0].email;
          }
        } catch {
          // ignore
        }
      }

      await api.put(`/claims/${created.id}`, {
        workflow_stage: next.stage_name,
        workflow_stage_order: next.stage_order,
        current_owner_id: nextOwnerId,
        current_owner_name: nextOwnerName,
        status: "Under_Review",
      });

      if (nextOwnerId) {
        try {
          await api.post("/notifications", {
            user_id: nextOwnerId,
            claim_id: created.id,
            claim_reference,
            title: `New GIO task: ${claim_reference}`,
            message: `${String(gio_case_reason).replace(/_/g, " ")} needs action at "${next.stage_name}"`,
            type: "approval_required",
          });
        } catch {
          // ignore
        }
      }
    }
  }

  return created;
}
