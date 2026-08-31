import prisma from '../config/db.js';
import ApiError from '../utils/ApiError.js';

// @desc    Get all activities (optionally filter by claim_id)
// @route   GET /api/claim-activities
export const getActivities = async (req, res, next) => {
  try {
    const { claim_id, status, responsible_user_id } = req.query;

    const where = {};
    if (claim_id) where.claim_id = claim_id;
    if (status) where.status = status;
    if (responsible_user_id) where.responsible_user_id = responsible_user_id;

    const activities = await prisma.claimActivity.findMany({
      where,
      orderBy: [{ stage_order: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activities by claim ID
// @route   GET /api/claim-activities/claim/:claimId
export const getActivitiesByClaim = async (req, res, next) => {
  try {
    const activities = await prisma.claimActivity.findMany({
      where: { claim_id: req.params.claimId },
      orderBy: { stage_order: 'asc' },
    });

    res.json({
      success: true,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single activity
// @route   GET /api/claim-activities/:id
export const getActivity = async (req, res, next) => {
  try {
    const activity = await prisma.claimActivity.findUnique({
      where: { id: req.params.id },
    });

    if (!activity) {
      throw new ApiError(404, 'Activity not found');
    }

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new activity
// @route   POST /api/claim-activities
export const createActivity = async (req, res, next) => {
  try {
    const {
      claim_id,
      claim_reference,
      stage_name,
      stage_order,
      status,
      responsible_user_id,
      responsible_user_name,
      responsible_role,
      department,
      comments,
      documents,
      due_date,
      registration_data,
    } = req.body;

    if (!claim_id || !stage_name || stage_order === undefined) {
      throw new ApiError(400, 'claim_id, stage_name and stage_order are required');
    }

    // Verify claim exists
    const claim = await prisma.claim.findUnique({ where: { id: claim_id } });
    if (!claim) {
      throw new ApiError(404, 'Claim not found');
    }

    const activity = await prisma.claimActivity.create({
      data: {
        claim_id,
        claim_reference: claim_reference || claim.claim_reference,
        stage_name,
        stage_order: Number(stage_order),
        status: status || 'Pending',
        responsible_user_id,
        responsible_user_name,
        responsible_role,
        department,
        comments,
        documents: documents || [],
        due_date: due_date ? new Date(due_date) : null,
        registration_data,
      },
    });

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update activity
// @route   PUT /api/claim-activities/:id
export const updateActivity = async (req, res, next) => {
  try {
    const activity = await prisma.claimActivity.findUnique({
      where: { id: req.params.id },
    });

    if (!activity) {
      throw new ApiError(404, 'Activity not found');
    }

    const data = { ...req.body };

    if (req.body.due_date) data.due_date = new Date(req.body.due_date);
    if (req.body.started_at) data.started_at = new Date(req.body.started_at);
    if (req.body.completed_at) data.completed_at = new Date(req.body.completed_at);
    if (req.body.stage_order !== undefined) data.stage_order = Number(req.body.stage_order);

    // Auto set started_at when status becomes In_Progress
    if (req.body.status === 'In_Progress' && !activity.started_at) {
      data.started_at = new Date();
    }

    // Auto set completed_at when status becomes Completed
    if (req.body.status === 'Completed' && !activity.completed_at) {
      data.completed_at = new Date();
    }

    const updatedActivity = await prisma.claimActivity.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: updatedActivity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete activity
// @route   DELETE /api/claim-activities/:id
export const deleteActivity = async (req, res, next) => {
  try {
    const activity = await prisma.claimActivity.findUnique({
      where: { id: req.params.id },
    });

    if (!activity) {
      throw new ApiError(404, 'Activity not found');
    }

    await prisma.claimActivity.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};