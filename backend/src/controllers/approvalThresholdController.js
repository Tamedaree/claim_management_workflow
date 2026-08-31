import prisma from '../config/db.js';
import ApiError from '../utils/ApiError.js';

// @desc    Get all approval thresholds
// @route   GET /api/approval-thresholds
export const getThresholds = async (req, res, next) => {
  try {
    const { insurance_type, is_active } = req.query;

    const where = {};
    if (insurance_type) where.insurance_type = insurance_type;
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const thresholds = await prisma.approvalThreshold.findMany({
      where,
      orderBy: [{ insurance_type: 'asc' }, { min_amount: 'asc' }],
    });

    res.json({
      success: true,
      count: thresholds.length,
      data: thresholds,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single threshold
// @route   GET /api/approval-thresholds/:id
export const getThreshold = async (req, res, next) => {
  try {
    const threshold = await prisma.approvalThreshold.findUnique({
      where: { id: req.params.id },
    });

    if (!threshold) {
      throw new ApiError(404, 'Approval threshold not found');
    }

    res.json({
      success: true,
      data: threshold,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new approval threshold
// @route   POST /api/approval-thresholds
export const createThreshold = async (req, res, next) => {
  try {
    const {
      insurance_type,
      min_amount,
      max_amount,
      required_approver_role,
      approval_chain,
      is_active,
    } = req.body;

    if (
      !insurance_type ||
      min_amount === undefined ||
      max_amount === undefined ||
      !required_approver_role ||
      !approval_chain
    ) {
      throw new ApiError(
        400,
        'insurance_type, min_amount, max_amount, required_approver_role and approval_chain are required'
      );
    }

    if (Number(min_amount) > Number(max_amount)) {
      throw new ApiError(400, 'min_amount cannot be greater than max_amount');
    }

    const threshold = await prisma.approvalThreshold.create({
      data: {
        insurance_type,
        min_amount: Number(min_amount),
        max_amount: Number(max_amount),
        required_approver_role,
        approval_chain,
        is_active: is_active !== undefined ? is_active : true,
      },
    });

    res.status(201).json({
      success: true,
      data: threshold,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update approval threshold
// @route   PUT /api/approval-thresholds/:id
export const updateThreshold = async (req, res, next) => {
  try {
    const threshold = await prisma.approvalThreshold.findUnique({
      where: { id: req.params.id },
    });

    if (!threshold) {
      throw new ApiError(404, 'Approval threshold not found');
    }

    const data = { ...req.body };

    if (req.body.min_amount !== undefined) data.min_amount = Number(req.body.min_amount);
    if (req.body.max_amount !== undefined) data.max_amount = Number(req.body.max_amount);

    const updatedThreshold = await prisma.approvalThreshold.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: updatedThreshold,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete approval threshold
// @route   DELETE /api/approval-thresholds/:id
export const deleteThreshold = async (req, res, next) => {
  try {
    const threshold = await prisma.approvalThreshold.findUnique({
      where: { id: req.params.id },
    });

    if (!threshold) {
      throw new ApiError(404, 'Approval threshold not found');
    }

    await prisma.approvalThreshold.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Approval threshold deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};