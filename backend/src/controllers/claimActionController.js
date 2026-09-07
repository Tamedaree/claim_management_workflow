import prisma from "../config/db.js";
import ApiError from "../utils/ApiError.js";

async function resolveUserDisplayName(user, bodyName) {
  if (bodyName && String(bodyName).trim() && !String(bodyName).includes("@")) {
    return String(bodyName).trim();
  }
  if (!user?.email) return bodyName || user?.id || "Unknown";

  const staff = await prisma.staffMember.findUnique({
    where: { email: user.email },
    select: { first_name: true, middle_name: true, last_name: true },
  });
  const full = [staff?.first_name, staff?.middle_name, staff?.last_name]
    .filter(Boolean)
    .join(" ");
  return full || bodyName || user.email;
}

export const getActions = async (req, res, next) => {
  try {
    const {
      claim_id,
      action_type,
      action_by_id,
      workflow_type,
      role,
      search,
      from_date,
      to_date,
      stage,
    } = req.query;

    const where = {};
    if (claim_id) where.claim_id = claim_id;
    if (action_type) where.action_type = action_type;
    if (action_by_id) where.action_by_id = action_by_id;
    if (workflow_type) {
      where.OR = [
        { workflow_type },
        {
          workflow_type: null,
          claim: { is: { workflow_type } },
        },
      ];
    }
    if (role) where.action_by_role = role;

    if (stage) {
      where.OR = [
        { from_stage: { contains: stage, mode: "insensitive" } },
        { to_stage: { contains: stage, mode: "insensitive" } },
      ];
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { claim_reference: { contains: search, mode: "insensitive" } },
            { action_by_name: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (from_date || to_date) {
      where.createdAt = {};
      if (from_date) where.createdAt.gte = new Date(from_date);
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const actions = await prisma.claimAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        claim: { select: { claim_reference: true, workflow_type: true } },
      },
    });

    const data = actions.map((a) => ({
      ...a,
      claim_reference: a.claim_reference || a.claim?.claim_reference,
      workflow_type: a.workflow_type || a.claim?.workflow_type || null,
    }));

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const getActionsByClaim = async (req, res, next) => {
  try {
    const actions = await prisma.claimAction.findMany({
      where: { claim_id: req.params.claimId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, count: actions.length, data: actions });
  } catch (error) {
    next(error);
  }
};

export const getAction = async (req, res, next) => {
  try {
    const action = await prisma.claimAction.findUnique({
      where: { id: req.params.id },
    });
    if (!action) throw new ApiError(404, "Action not found");
    res.json({ success: true, data: action });
  } catch (error) {
    next(error);
  }
};

export const createAction = async (req, res, next) => {
  try {
    const {
      claim_id,
      action_type,
      comments,
      from_stage,
      to_stage,
      from_status,
      to_status,
      previous_responsible_person,
      new_responsible_person,
      claim_reference,
      workflow_type,
      update_claim = false,
      from_level,
      to_level,
      documents,
      action_by_name: bodyName,
    } = req.body;

    if (!claim_id || !action_type) {
      throw new ApiError(400, "claim_id and action_type are required");
    }

    const claim = await prisma.claim.findUnique({ where: { id: claim_id } });
    if (!claim) throw new ApiError(404, "Claim not found");

    const action_by_name = await resolveUserDisplayName(req.user, bodyName);

    const action = await prisma.claimAction.create({
      data: {
        claim_id,
        claim_reference: claim_reference || claim.claim_reference,
        action_type,
        from_stage: from_stage || null,
        to_stage: to_stage || null,
        from_status: from_status || null,
        to_status: to_status || null,
        action_by_id: req.user.id,
        action_by_name,
        action_by_role: req.user.role,
        previous_responsible_person: previous_responsible_person || null,
        new_responsible_person: new_responsible_person || null,
        comments: comments || null,
        workflow_type: workflow_type || claim.workflow_type || null,
        from_level: from_level !== undefined ? Number(from_level) : null,
        to_level: to_level !== undefined ? Number(to_level) : null,
        documents: documents || [],
      },
    });

    // Only change claim when explicitly requested (not on stage Forwarded)
    if (update_claim === true) {
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
        case "Returned_for_Correction":
        case "Returned":
          claimUpdateData = {
            status: "Returned_for_Correction",
            return_count: { increment: 1 },
          };
          break;
        case "Escalated":
          claimUpdateData = { status: "Escalated" };
          break;
        case "Closed":
          claimUpdateData = {
            status: "Claim_Closed",
            closure_date: new Date(),
          };
          break;
        case "Submitted":
        case "Registered":
          claimUpdateData = {
            status: "Claim_Registered",
            submission_date: new Date(),
          };
          break;
        default:
          break;
      }
      if (Object.keys(claimUpdateData).length) {
        await prisma.claim.update({
          where: { id: claim_id },
          data: claimUpdateData,
        });
      }
    }

    res.status(201).json({ success: true, data: action });
  } catch (error) {
    next(error);
  }
};

export const deleteAction = async (req, res, next) => {
  try {
    const action = await prisma.claimAction.findUnique({
      where: { id: req.params.id },
    });
    if (!action) throw new ApiError(404, "Action not found");
    await prisma.claimAction.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Action deleted successfully" });
  } catch (error) {
    next(error);
  }
};
