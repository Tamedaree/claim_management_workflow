import prisma from "../config/db.js";
import ApiError from "../utils/ApiError.js";

/**
 * Prefer a non-email name from the request body, otherwise resolve
 * first + middle + last from StaffMember by the actor's email.
 */
async function resolveUserDisplayName(user, bodyName) {
  if (bodyName && String(bodyName).trim() && !String(bodyName).includes("@")) {
    return String(bodyName).trim();
  }

  if (!user?.email) {
    return bodyName || user?.id || "Unknown";
  }

  const staff = await prisma.staffMember.findUnique({
    where: { email: user.email },
    select: {
      first_name: true,
      middle_name: true,
      last_name: true,
    },
  });

  const full = [staff?.first_name, staff?.middle_name, staff?.last_name]
    .filter(Boolean)
    .join(" ");

  return full || bodyName || user.email;
}

// @desc    Get all actions (optionally filter by claim_id)
// @route   GET /api/claim-actions
export const getActions = async (req, res, next) => {
  try {
    const { claim_id, action_type, action_by_id } = req.query;

    const where = {};
    if (claim_id) where.claim_id = claim_id;
    if (action_type) where.action_type = action_type;
    if (action_by_id) where.action_by_id = action_by_id;

    const actions = await prisma.claimAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      count: actions.length,
      data: actions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get actions by claim ID
// @route   GET /api/claim-actions/claim/:claimId
export const getActionsByClaim = async (req, res, next) => {
  try {
    const actions = await prisma.claimAction.findMany({
      where: { claim_id: req.params.claimId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      count: actions.length,
      data: actions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single action
// @route   GET /api/claim-actions/:id
export const getAction = async (req, res, next) => {
  try {
    const action = await prisma.claimAction.findUnique({
      where: { id: req.params.id },
    });

    if (!action) {
      throw new ApiError(404, "Action not found");
    }

    res.json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new action (Approve / Reject / Return / Escalate etc.)
// @route   POST /api/claim-actions
export const createAction = async (req, res, next) => {
  try {
    const {
      claim_id,
      action_type,
      comments,
      from_level,
      to_level,
      documents,
      action_by_name: bodyName,
    } = req.body;

    if (!claim_id || !action_type) {
      throw new ApiError(400, "claim_id and action_type are required");
    }

    const claim = await prisma.claim.findUnique({ where: { id: claim_id } });
    if (!claim) {
      throw new ApiError(404, "Claim not found");
    }

    const action_by_name = await resolveUserDisplayName(req.user, bodyName);

    const action = await prisma.claimAction.create({
      data: {
        claim_id,
        action_type,
        action_by_id: req.user.id,
        action_by_name,
        action_by_role: req.user.role,
        comments,
        from_level: from_level !== undefined ? Number(from_level) : null,
        to_level: to_level !== undefined ? Number(to_level) : null,
        documents: documents || [],
      },
    });

    // Optionally update the claim status based on action_type
    let claimUpdateData = {};

    switch (action_type) {
      case "Approved":
        claimUpdateData = {
          status: "Approved",
          approval_date: new Date(),
          current_approver_role: "None",
        };
        break;
      case "Rejected":
        claimUpdateData = {
          status: "Rejected",
          rejection_date: new Date(),
          current_approver_role: "None",
        };
        break;
      case "Returned":
        claimUpdateData = {
          status: "Returned",
          return_count: { increment: 1 },
        };
        break;
      case "Escalated":
        claimUpdateData = {
          status: "Escalated",
        };
        break;
      case "Additional_Info_Requested":
        claimUpdateData = {
          status: "Additional_Info_Requested",
        };
        break;
      case "Submitted":
        claimUpdateData = {
          status: "Submitted",
          submission_date: new Date(),
        };
        break;
      default:
        break;
    }

    if (Object.keys(claimUpdateData).length > 0) {
      await prisma.claim.update({
        where: { id: claim_id },
        data: claimUpdateData,
      });
    }

    res.status(201).json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete action
// @route   DELETE /api/claim-actions/:id
export const deleteAction = async (req, res, next) => {
  try {
    const action = await prisma.claimAction.findUnique({
      where: { id: req.params.id },
    });

    if (!action) {
      throw new ApiError(404, "Action not found");
    }

    await prisma.claimAction.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: "Action deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
