import prisma from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import { canActOnGioStage } from "../utils/gioAccess.js";
import { upsertGarageByName } from "./garageController.js";
import {
  GIO_WORKFLOW_STAGES,
  GIO_CASE_REASONS,
  GIO_APPROVAL_TIER_STAGES,
} from "../config/gioWorkflow.js";

const GIO_STAGE_STATUS = {
  "GIO Case Registration": "Case_Received",
  "Director Assignment": "Director_Assignment_Pending",
  "Manager Assignment": "Manager_Assignment_Pending",
  "GIO Case Work": "Assigned_to_GIO_Principal",
  "GIO Claim Manager Review": "Claim_Manager_Review_Pending",
  "Director Decision": "Director_Decision_Pending",
  "Senior Director Decision": "Senior_Director_Decision_Pending",
  "Chief of GIO Approval": "Chief_of_GIO_Approval_Pending",
  "CEO Decision": "CEO_Approval_Pending",
  "GIO Case Closure": "Closed",
};

// @desc    Get all claims (with filters)
// @route   GET /api/claims
export const getClaims = async (req, res, next) => {
  try {
    const {
      status,
      insurance_type,
      workflow_type,
      priority,
      submitted_by_id,
      current_approver_id,
      current_owner_id,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};
    where.is_deleted = false;

    if (status) where.status = status;
    if (insurance_type) where.insurance_type = insurance_type;
    if (workflow_type) where.workflow_type = workflow_type;
    if (priority) where.priority = priority;
    if (submitted_by_id) where.submitted_by_id = submitted_by_id;
    if (current_approver_id) where.current_approver_id = current_approver_id;
    if (current_owner_id) where.current_owner_id = current_owner_id;
    if (req.query.gio_case_reason) {
      where.gio_case_reason = req.query.gio_case_reason;
    }
    if (req.query.include_deleted === "true" && req.user?.role === "admin") {
      delete where.is_deleted;
    }
    if (req.query.claim_reference) {
      where.claim_reference = {
        equals: req.query.claim_reference,
        mode: "insensitive",
      };
    }
    if (req.query.claim_number) {
      where.claim_number = {
        equals: String(req.query.claim_number).trim(),
        mode: "insensitive",
      };
    }
    if (req.query.registration_complete !== undefined) {
      where.registration_complete = req.query.registration_complete === "true";
    }

    if (search) {
      where.OR = [
        { claim_reference: { contains: search, mode: "insensitive" } },
        { claimant_name: { contains: search, mode: "insensitive" } },
        { policy_number: { contains: search, mode: "insensitive" } },
        { plate_number: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.claim.count({ where }),
    ]);

    res.json({
      success: true,
      count: claims.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: claims,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single claim
// @route   GET /api/claims/:id
export const getClaim = async (req, res, next) => {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
      include: {
        activities: { orderBy: { stage_order: "asc" } },
        actions: { orderBy: { createdAt: "desc" } },
        garages: true,
      },
    });

    if (claim.is_deleted && req.user?.role !== "admin") {
      throw new ApiError(404, "Claim not found");
    }

    res.json({
      success: true,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new claim
// @route   POST /api/claims
export const createClaim = async (req, res, next) => {
  try {
    const {
      claim_reference,
      policy_number,
      claimant_name,
      injured_name,
      insurance_type,
      cover_type,
      plate_number,
      claim_amount,
      incident_date,
      incident_description,
      originating_office,
      originating_office_type,
      received_reference_number,
      date_received,
      workflow_type,
      gio_case_reason,
      priority,
      remarks,
      documents,
      registration_type,
      registration_data,
      is_subrogation,
      is_recovery,
      is_reinsurance,
      claim_number,
      final_approval_amount,
      motor_vehicle_type,
      is_rebid,
      rebid_participating_garages,
      rebid_winner_garage,
      garage_name,
      has_independent_assessor,
      independent_assessor_name,
      assigned_performer_id,
      assigned_performer_name,
      due_date,
      auto_submit,
      status: bodyStatus,
      workflow_stage,
      workflow_stage_order,
      registration_complete,
      current_owner_id,
      current_owner_name,
      current_approver_role,
      current_approver_id,
      approval_level,
      return_count,
      submitted_by_name,
    } = req.body;

    const isGio = workflow_type === "GIO_Approval";
    const isClaimDivision = !isGio;

    // Always required
    if (!claim_reference || !claimant_name || !insurance_type) {
      throw new ApiError(
        400,
        "claim_reference, claimant_name and insurance_type are required",
      );
    }

    // Full registration / GIO still need amount + incident_date
    // Claim Division secretary notification may omit them
    const wantsFull = registration_complete === true || isGio;

    if (wantsFull) {
      if (claim_amount == null || claim_amount === "" || !incident_date) {
        throw new ApiError(400, "claim_amount and incident_date are required");
      }
    }

    if (isGio) {
      if (!gio_case_reason) {
        throw new ApiError(400, "gio_case_reason is required for GIO cases");
      }
      if (!GIO_CASE_REASONS.includes(gio_case_reason)) {
        throw new ApiError(400, "Invalid gio_case_reason");
      }
    }

    const existing = await prisma.claim.findUnique({
      where: { claim_reference },
    });
    if (existing) {
      throw new ApiError(400, "Claim reference already exists");
    }

    const amount =
      claim_amount != null && claim_amount !== "" ? Number(claim_amount) : 0;

    const lossDate = incident_date
      ? new Date(incident_date)
      : date_received
        ? new Date(date_received)
        : new Date();

    const registrationComplete = registration_complete === true;
    const now = new Date();

    let status;
    if (isGio) {
      status = auto_submit ? "Pending_GIO_Assignment" : "Case_Received";
    } else if (bodyStatus) {
      status = bodyStatus;
    } else {
      status = auto_submit ? "Notification_Received" : "Draft";
    }

    const garageName =
      garage_name != null && String(garage_name).trim()
        ? String(garage_name).trim()
        : null;

    if (garageName) {
      await upsertGarageByName(garageName);
    }

    const claim = await prisma.$transaction(async (tx) => {
      const created = await tx.claim.create({
        data: {
          claim_reference,
          policy_number: policy_number || null,
          claimant_name,
          injured_name: injured_name || null,
          insurance_type,
          cover_type: cover_type || null,
          plate_number: plate_number || null,
          claim_amount: amount,
          incident_date: lossDate,
          incident_description: incident_description || null,
          originating_office: originating_office || null,
          originating_office_type: originating_office_type || null,
          received_reference_number: received_reference_number || null,
          date_received: date_received ? new Date(date_received) : null,
          workflow_type: workflow_type || "Claim_Division",
          gio_case_reason: isGio ? gio_case_reason : null,
          priority: priority || "Medium",
          remarks: remarks || null,
          documents: documents || [],
          registration_type: registration_type || null,
          registration_data: registration_data || null,
          is_subrogation: !!is_subrogation,
          is_recovery: !!is_recovery,
          is_reinsurance: !!is_reinsurance,
          claim_number: claim_number || null,
          final_approval_amount:
            final_approval_amount != null && final_approval_amount !== ""
              ? Number(final_approval_amount)
              : null,
          motor_vehicle_type: motor_vehicle_type || null,
          is_rebid: !!is_rebid,
          rebid_participating_garages: Array.isArray(
            rebid_participating_garages,
          )
            ? rebid_participating_garages
            : [],
          rebid_winner_garage: rebid_winner_garage || null,
          garage_name: garageName,
          has_independent_assessor: !!has_independent_assessor,
          independent_assessor_name: independent_assessor_name || null,
          assigned_performer_id: assigned_performer_id || null,
          assigned_performer_name: assigned_performer_name || null,
          assignment_date: assigned_performer_id ? now : null,
          due_date: due_date ? new Date(due_date) : null,
          submitted_by_id: req.user.id,
          submitted_by_name:
            submitted_by_name || req.user.email || req.user.full_name,
          submission_date: status !== "Draft" ? now : null,
          status,
          current_department: isGio ? "GIO" : "Claim_Division",
          workflow_stage: isGio
            ? GIO_WORKFLOW_STAGES[0].stage_name
            : workflow_stage || null,
          workflow_stage_order: isGio
            ? 1
            : workflow_stage_order != null
              ? Number(workflow_stage_order)
              : 0,
          current_owner_id: current_owner_id || null,
          current_owner_name: current_owner_name || null,
          current_approver_role: current_approver_role || "None",
          current_approver_id: current_approver_id || null,
          approval_level: approval_level != null ? Number(approval_level) : 0,
          return_count: return_count != null ? Number(return_count) : 0,
          // Claim Division: false until adjuster completes; GIO: full on create
          registration_complete: isGio ? true : registrationComplete,
        },
      });

      // GIO: create full stage timeline
      if (isGio) {
        await tx.claimActivity.createMany({
          data: GIO_WORKFLOW_STAGES.map((s, idx) => ({
            claim_id: created.id,
            claim_reference: created.claim_reference,
            stage_name: s.stage_name,
            stage_order: s.stage_order,
            responsible_role: s.responsible_role,
            department: s.department,
            status:
              idx === 0
                ? auto_submit
                  ? "Completed"
                  : "In_Progress"
                : idx === 1 && auto_submit
                  ? "In_Progress"
                  : "Pending",
            started_at: idx === 0 || (idx === 1 && auto_submit) ? now : null,
            completed_at: idx === 0 && auto_submit ? now : null,
            responsible_user_id:
              idx === 0
                ? req.user.id
                : idx === 1 && assigned_performer_id
                  ? assigned_performer_id
                  : null,
            responsible_user_name:
              idx === 0
                ? req.user.email
                : idx === 1 && assigned_performer_name
                  ? assigned_performer_name
                  : null,
          })),
        });

        if (auto_submit) {
          await tx.claimAction.create({
            data: {
              claim_id: created.id,
              action_type: "Submitted",
              action_by_id: req.user.id,
              action_by_name: req.user.email,
              action_by_role: req.user.role,
              comments: `GIO case registered: ${gio_case_reason}`,
            },
          });

          const next = GIO_WORKFLOW_STAGES[1];
          await tx.claim.update({
            where: { id: created.id },
            data: {
              status:
                GIO_STAGE_STATUS[next.stage_name] || "Pending_GIO_Assignment",
              workflow_stage: next.stage_name,
              workflow_stage_order: next.stage_order,
              current_owner_id: assigned_performer_id || null,
              current_owner_name: assigned_performer_name || null,
            },
          });

          if (assigned_performer_id) {
            await tx.notification.create({
              data: {
                user_id: assigned_performer_id,
                claim_id: created.id,
                claim_reference: created.claim_reference,
                title: `New GIO task: ${created.claim_reference}`,
                message: `${gio_case_reason.replace(/_/g, " ")} is ready at "${next.stage_name}"`,
                type: "approval_required",
              },
            });
          } else {
            const users = await tx.user.findMany({
              where: { role: next.responsible_role, is_active: true },
              select: { id: true },
              take: 10,
            });
            if (users.length) {
              await tx.notification.createMany({
                data: users.map((u) => ({
                  user_id: u.id,
                  claim_id: created.id,
                  claim_reference: created.claim_reference,
                  title: `New GIO task: ${created.claim_reference}`,
                  message: `${gio_case_reason.replace(/_/g, " ")} needs action at "${next.stage_name}"`,
                  type: "approval_required",
                })),
              });
            }
          }
        }
      }

      return tx.claim.findUnique({
        where: { id: created.id },
        include: {
          activities: { orderBy: { stage_order: "asc" } },
          actions: true,
        },
      });
    });

    res.status(201).json({ success: true, data: claim });
  } catch (error) {
    next(error);
  }
};

// @desc    Update claim
// @route   PUT /api/claims/:id
export const updateClaim = async (req, res, next) => {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
    });

    if (!claim) {
      throw new ApiError(404, "Claim not found");
    }
    if (claim.is_deleted) {
      throw new ApiError(400, "Cannot update a deleted claim");
    }

    const body = { ...req.body };
    delete body.id;

    if (body.claim_amount !== undefined && body.claim_amount !== null) {
      body.claim_amount = Number(body.claim_amount);
    }
    if (body.incident_date) {
      body.incident_date = new Date(body.incident_date);
    }
    if (body.date_received) {
      body.date_received = new Date(body.date_received);
    }
    if (body.submission_date) {
      body.submission_date = new Date(body.submission_date);
    }
    if (body.approval_date) {
      body.approval_date = new Date(body.approval_date);
    }
    if (body.rejection_date) {
      body.rejection_date = new Date(body.rejection_date);
    }
    if (body.due_date) {
      body.due_date = new Date(body.due_date);
    }
    if (body.closure_date) {
      body.closure_date = new Date(body.closure_date);
    }
    if (body.assignment_date) {
      body.assignment_date = new Date(body.assignment_date);
    }
    if (body.registration_completed_at) {
      body.registration_completed_at = new Date(body.registration_completed_at);
    }
    if (body.workflow_stage_order !== undefined) {
      body.workflow_stage_order = Number(body.workflow_stage_order);
    }
    if (body.approval_level !== undefined) {
      body.approval_level = Number(body.approval_level);
    }
    if (body.return_count !== undefined) {
      body.return_count = Number(body.return_count);
    }

    if (
      body.final_approval_amount !== undefined &&
      body.final_approval_amount !== null &&
      body.final_approval_amount !== ""
    ) {
      body.final_approval_amount = Number(body.final_approval_amount);
    } else if (body.final_approval_amount === "") {
      body.final_approval_amount = null;
    }

    if (body.gio_case_reason !== undefined) {
      if (
        claim.workflow_type === "GIO_Approval" &&
        body.gio_case_reason &&
        !GIO_CASE_REASONS.includes(body.gio_case_reason)
      ) {
        throw new ApiError(400, "Invalid gio_case_reason");
      }
      if (body.gio_case_reason === "") {
        body.gio_case_reason = null;
      }
    }

    // Optional: do not allow flipping workflow_type on edit
    delete body.workflow_type;
    delete body.is_deleted;
    delete body.deleted_at;
    delete body.deleted_by_id;

    // Claim Adjuster completes full registration (Claim Division)
    if (body.registration_complete === true && !claim.registration_complete) {
      const amount =
        body.claim_amount !== undefined
          ? body.claim_amount
          : claim.claim_amount;
      const lossDate = body.incident_date || claim.incident_date;

      if (amount == null || amount === "") {
        throw new ApiError(
          400,
          "claim_amount is required to complete registration",
        );
      }
      if (!lossDate) {
        throw new ApiError(
          400,
          "incident_date is required to complete registration",
        );
      }

      body.registration_completed_by_id =
        body.registration_completed_by_id || req.user.id;
      body.registration_completed_by_name =
        body.registration_completed_by_name ||
        req.user.email ||
        req.user.full_name;
      body.registration_completed_at =
        body.registration_completed_at || new Date();

      if (!body.status) {
        body.status = "Claim_Registered";
      }
    }

    if (body.garage_name !== undefined) {
      const n =
        body.garage_name != null && String(body.garage_name).trim()
          ? String(body.garage_name).trim()
          : null;
      body.garage_name = n;
      if (n) {
        await upsertGarageByName(n);
      }
    }

    const updatedClaim = await prisma.claim.update({
      where: { id: req.params.id },
      data: body,
    });

    res.json({
      success: true,
      data: updatedClaim,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete claim
// @route   DELETE /api/claims/:id
export const deleteClaim = async (req, res, next) => {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
    });

    if (!claim) throw new ApiError(404, "Claim not found");
    if (claim.is_deleted) {
      throw new ApiError(400, "Claim already deleted");
    }

    const updated = await prisma.claim.update({
      where: { id: req.params.id },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by_id: req.user?.id || null,
      },
    });

    res.json({
      success: true,
      message: "Claim removed from lists (soft delete)",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit claim (Draft → submitted / notification)
// @route   PATCH /api/claims/:id/submit
export const submitClaim = async (req, res, next) => {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
    });

    if (!claim) {
      throw new ApiError(404, "Claim not found");
    }

    if (claim.status !== "Draft") {
      throw new ApiError(400, "Only draft claims can be submitted");
    }

    const nextStatus =
      claim.workflow_type === "GIO_Approval"
        ? "Pending_GIO_Assignment"
        : "Notification_Received";

    const updatedClaim = await prisma.claim.update({
      where: { id: req.params.id },
      data: {
        status: nextStatus,
        submission_date: new Date(),
        submitted_by_id: req.user.id,
        submitted_by_name: req.user.email,
      },
    });

    await prisma.claimAction.create({
      data: {
        claim_id: claim.id,
        action_type: "Submitted",
        action_by_id: req.user.id,
        action_by_name: req.user.email,
        action_by_role: req.user.role,
        comments: "Claim submitted",
      },
    });

    res.json({
      success: true,
      data: updatedClaim,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete current GIO workflow stage and open next
// @route   POST /api/claims/:id/complete-stage
export const completeStage = async (req, res, next) => {
  try {
    const {
      comments,
      action_taken,
      assign_user_id,
      assign_user_name,
      finalize,
    } = req.body;

    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
      include: { activities: { orderBy: { stage_order: "asc" } } },
    });

    if (!claim) throw new ApiError(404, "Claim not found");
    if (claim.workflow_type !== "GIO_Approval") {
      throw new ApiError(400, "This endpoint is for GIO cases only");
    }

    const current = claim.activities.find((a) => a.status === "In_Progress");
    if (!current) throw new ApiError(400, "No in-progress stage found");

    if (!canActOnGioStage(req.user.role, current.responsible_role)) {
      throw new ApiError(403, "Not allowed to act on this GIO stage");
    }

    // Chief of GIO Decision → must assign a GIO Claim Adjuster
    const ASSIGN_MANAGER_STAGE = "Director Assignment";
    const ASSIGN_PRINCIPAL_STAGE = "Manager Assignment";

    if (current.stage_name === ASSIGN_MANAGER_STAGE && !assign_user_id) {
      throw new ApiError(
        400,
        "assign_user_id is required: select a GIO Claim Manager",
      );
    }

    if (current.stage_name === ASSIGN_PRINCIPAL_STAGE && !assign_user_id) {
      throw new ApiError(
        400,
        "assign_user_id is required: select a GIO Claim Principal",
      );
    }

    const now = new Date();
    const started = current.started_at ? new Date(current.started_at) : now;
    const daysTaken =
      Math.round(((now - started) / (1000 * 60 * 60 * 24)) * 100) / 100;

    const actorName =
      req.user.full_name ||
      [req.user.first_name, req.user.middle_name, req.user.last_name]
        .filter(Boolean)
        .join(" ") ||
      req.user.email;

    const result = await prisma.$transaction(async (tx) => {
      await tx.claimActivity.update({
        where: { id: current.id },
        data: {
          status: "Completed",
          completed_at: now,
          comments: comments || action_taken || current.comments,
          responsible_user_id: req.user.id,
          responsible_user_name: actorName,
        },
      });

      await tx.claimAction.create({
        data: {
          claim_id: claim.id,
          action_type: finalize ? "Approved" : "Forwarded",
          action_by_id: req.user.id,
          action_by_name: actorName,
          action_by_role: req.user.role,
          comments:
            comments ||
            action_taken ||
            (finalize
              ? `Finalized at "${current.stage_name}" — further tier stages skipped`
              : assign_user_name
                ? `Completed "${current.stage_name}" and assigned to ${assign_user_name}`
                : `Completed stage "${current.stage_name}" in ${daysTaken} day(s)`),
        },
      });

      let next = claim.activities.find(
        (a) => a.stage_order === current.stage_order + 1,
      );

      // Finalize: skip remaining approval-tier stages
      const tierIdx = GIO_APPROVAL_TIER_STAGES.indexOf(current.stage_name);
      const isTierDecision =
        tierIdx !== -1 && tierIdx < GIO_APPROVAL_TIER_STAGES.length - 1;
      const shouldSkip = !!finalize && isTierDecision;

      if (shouldSkip) {
        const tierNames = new Set(GIO_APPROVAL_TIER_STAGES);
        const remainingTierActivities = claim.activities.filter(
          (a) =>
            a.stage_order > current.stage_order && tierNames.has(a.stage_name),
        );

        for (const skipActivity of remainingTierActivities) {
          await tx.claimActivity.update({
            where: { id: skipActivity.id },
            data: {
              status: "Skipped",
              comments: `Skipped — ${actorName} approved and finalized without further sign-off.`,
            },
          });
        }

        const maxTierOrder = Math.max(
          current.stage_order,
          ...remainingTierActivities.map((a) => a.stage_order),
        );

        next = claim.activities.find((a) => a.stage_order > maxTierOrder);
      }

      if (!next) {
        return tx.claim.update({
          where: { id: claim.id },
          data: {
            status: "Closed",
            approval_date: now,
            closure_date: now,
            workflow_stage: current.stage_name,
            current_owner_id: null,
            current_owner_name: null,
            current_approver_role: "None",
          },
          include: {
            activities: { orderBy: { stage_order: "asc" } },
            actions: { orderBy: { createdAt: "desc" } },
          },
        });
      }

      const nextOwnerId = assign_user_id || next.responsible_user_id || null;
      const nextOwnerName =
        assign_user_name || next.responsible_user_name || null;

      await tx.claimActivity.update({
        where: { id: next.id },
        data: {
          status: "In_Progress",
          started_at: now,
          responsible_user_id: nextOwnerId,
          responsible_user_name: nextOwnerName,
        },
      });

      const nextStatus =
        GIO_STAGE_STATUS[next.stage_name] || "GIO_Review_In_Progress";

      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: {
          status: nextStatus,
          workflow_stage: next.stage_name,
          workflow_stage_order: next.stage_order,
          remarks: action_taken || claim.remarks,
          current_owner_id: nextOwnerId,
          current_owner_name: nextOwnerName,
          assigned_performer_id: assign_user_id || claim.assigned_performer_id,
          assigned_performer_name:
            assign_user_name || claim.assigned_performer_name,
          assignment_date: assign_user_id ? now : claim.assignment_date,
          current_department: "GIO",
        },
        include: {
          activities: { orderBy: { stage_order: "asc" } },
          actions: { orderBy: { createdAt: "desc" } },
        },
      });

      if (nextOwnerId) {
        await tx.notification.create({
          data: {
            user_id: nextOwnerId,
            claim_id: claim.id,
            claim_reference: claim.claim_reference,
            title: `GIO case assigned: ${claim.claim_reference}`,
            message: `"${next.stage_name}" is assigned to you.${
              assign_user_name ? ` Assigned by ${actorName}.` : ""
            } Previous stage took ${daysTaken} day(s).`,
            type: "approval_required",
          },
        });
      } else {
        const users = await tx.user.findMany({
          where: {
            role: next.responsible_role,
            is_active: true,
          },
          select: { id: true },
          take: 10,
        });

        if (users.length) {
          await tx.notification.createMany({
            data: users.map((u) => ({
              user_id: u.id,
              claim_id: claim.id,
              claim_reference: claim.claim_reference,
              title: `GIO stage ready: ${claim.claim_reference}`,
              message: `"${next.stage_name}" is now assigned. Previous stage took ${daysTaken} day(s).`,
              type: "approval_required",
            })),
          });
        }
      }

      return updated;
    });

    res.json({
      success: true,
      days_taken: daysTaken,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const returnStage = async (req, res, next) => {
  try {
    const { comments, target_stage_order, target_stage_name } = req.body;

    if (!comments?.trim()) {
      throw new ApiError(
        400,
        "Comments are required when returning for correction",
      );
    }

    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
      include: { activities: { orderBy: { stage_order: "asc" } } },
    });

    if (!claim) throw new ApiError(404, "Claim not found");
    if (claim.workflow_type !== "GIO_Approval") {
      throw new ApiError(400, "GIO cases only");
    }

    const current = claim.activities.find((a) => a.status === "In_Progress");
    if (!current) throw new ApiError(400, "No in-progress stage");

    if (!canActOnGioStage(req.user.role, current.responsible_role)) {
      throw new ApiError(403, "Not allowed to act on this GIO stage");
    }

    let targetOrder =
      target_stage_order != null && target_stage_order !== ""
        ? Number(target_stage_order)
        : NaN;

    if (!Number.isFinite(targetOrder) && target_stage_name) {
      const byName = claim.activities.find(
        (a) => a.stage_name === target_stage_name,
      );
      if (byName) targetOrder = byName.stage_order;
    }

    if (!Number.isFinite(targetOrder)) {
      throw new ApiError(400, "target_stage_order is required");
    }

    if (targetOrder >= current.stage_order) {
      throw new ApiError(
        400,
        "Return target must be an earlier stage than the current one",
      );
    }

    const target = claim.activities.find((a) => a.stage_order === targetOrder);
    if (!target) throw new ApiError(400, "Target stage not found");

    const now = new Date();
    const actorName =
      req.user.full_name ||
      [req.user.first_name, req.user.last_name].filter(Boolean).join(" ") ||
      req.user.email;

    // Owner = target stage role (NOT always secretary)
    let ownerId = target.responsible_user_id || null;
    let ownerName = target.responsible_user_name || null;

    if (!ownerId && target.responsible_role) {
      const users = await prisma.user.findMany({
        where: { role: target.responsible_role, is_active: true },
        take: 1,
      });
      if (users[0]) {
        ownerId = users[0].id;
        ownerName = users[0].email;
      }
    }

    // Only registration-style first stage goes back to submitter
    const isRegistrationTarget =
      target.stage_order === 1 || /registration/i.test(target.stage_name || "");

    if (isRegistrationTarget) {
      ownerId = claim.submitted_by_id || ownerId;
      ownerName = claim.submitted_by_name || ownerName;
    }

    const result = await prisma.$transaction(async (tx) => {
      const inRange = claim.activities.filter(
        (a) =>
          a.stage_order >= target.stage_order &&
          a.stage_order <= current.stage_order,
      );

      for (const a of inRange) {
        const isTarget = a.stage_order === target.stage_order;

        await tx.claimActivity.update({
          where: { id: a.id },
          data: isTarget
            ? {
                status: "In_Progress",
                started_at: now,
                completed_at: null,
                comments: `Returned for correction: ${comments}`,
              }
            : {
                status: "Pending",
                started_at: null,
                completed_at: null,
                comments: null,
                responsible_user_id: null,
                responsible_user_name: null,
              },
        });
      }

      await tx.claimAction.create({
        data: {
          claim_id: claim.id,
          action_type: "Returned",
          action_by_id: req.user.id,
          action_by_name: actorName,
          action_by_role: req.user.role,
          comments: `Returned from "${current.stage_name}" to "${target.stage_name}": ${comments}`,
        },
      });

      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: {
          status: "Returned_for_Correction", // must match Prisma enum
          return_count: (claim.return_count || 0) + 1,
          remarks: comments,
          workflow_stage: target.stage_name,
          workflow_stage_order: target.stage_order,
          current_owner_id: ownerId,
          current_owner_name: ownerName,
          current_approver_role: "None",
        },
        include: {
          activities: { orderBy: { stage_order: "asc" } },
          actions: { orderBy: { createdAt: "desc" } },
        },
      });

      if (ownerId) {
        await tx.notification.create({
          data: {
            user_id: ownerId,
            claim_id: claim.id,
            claim_reference: claim.claim_reference,
            title: `Correction needed: ${claim.claim_reference}`,
            message: `Returned to "${target.stage_name}": ${comments}`,
            type: "claim_returned",
          },
        });
      }

      return updated;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const resubmitStage = async (req, res, next) => {
  try {
    const { comments } = req.body;

    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
      include: { activities: { orderBy: { stage_order: "asc" } } },
    });

    if (!claim) throw new ApiError(404, "Claim not found");

    const returnedOk = [
      "Returned_for_Correction",
      "Returned_to_Originating_Office",
      "Returned",
    ].includes(claim.status);

    if (!returnedOk) {
      throw new ApiError(400, "Only returned cases can be resubmitted");
    }

    // Never default to activities[0]
    const stage =
      claim.activities.find((a) => a.status === "In_Progress") ||
      claim.activities.find((a) => a.status === "On_Hold") ||
      claim.activities.find((a) => a.stage_name === claim.workflow_stage);

    if (!stage) throw new ApiError(400, "No stage to resume");

    const now = new Date();
    const actorName = req.user.full_name || req.user.email;

    let ownerId = stage.responsible_user_id;
    let ownerName = stage.responsible_user_name;

    if (!ownerId && stage.responsible_role) {
      const users = await prisma.user.findMany({
        where: { role: stage.responsible_role, is_active: true },
        take: 1,
      });
      if (users[0]) {
        ownerId = users[0].id;
        ownerName = users[0].email;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.claimActivity.update({
        where: { id: stage.id },
        data: {
          status: "In_Progress",
          started_at: stage.started_at || now,
          completed_at: null,
          comments: comments ? `Resubmitted: ${comments}` : stage.comments,
        },
      });

      await tx.claimAction.create({
        data: {
          claim_id: claim.id,
          action_type: "Resubmitted",
          action_by_id: req.user.id,
          action_by_name: actorName,
          action_by_role: req.user.role,
          comments: comments || "Corrected information resubmitted",
        },
      });

      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: {
          status:
            GIO_STAGE_STATUS[stage.stage_name] || "GIO_Review_In_Progress",
          workflow_stage: stage.stage_name,
          workflow_stage_order: stage.stage_order,
          current_owner_id: ownerId,
          current_owner_name: ownerName,
        },
        include: {
          activities: { orderBy: { stage_order: "asc" } },
          actions: { orderBy: { createdAt: "desc" } },
        },
      });

      if (ownerId) {
        await tx.notification.create({
          data: {
            user_id: ownerId,
            claim_id: claim.id,
            claim_reference: claim.claim_reference,
            title: `Resubmitted: ${claim.claim_reference}`,
            message: `Continue at "${stage.stage_name}".`,
            type: "approval_required",
          },
        });
      }

      return updated;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
