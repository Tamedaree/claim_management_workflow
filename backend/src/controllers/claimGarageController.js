import prisma from '../config/db.js';
import ApiError from '../utils/ApiError.js';

// @desc    Get all garages (optionally filter by claim_id)
// @route   GET /api/claim-garages
export const getGarages = async (req, res, next) => {
  try {
    const { claim_id, status, is_selected } = req.query;

    const where = {};
    if (claim_id) where.claim_id = claim_id;
    if (status) where.status = status;
    if (is_selected !== undefined) where.is_selected = is_selected === 'true';

    const garages = await prisma.claimGarage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: garages.length,
      data: garages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get garages by claim ID
// @route   GET /api/claim-garages/claim/:claimId
export const getGaragesByClaim = async (req, res, next) => {
  try {
    const garages = await prisma.claimGarage.findMany({
      where: { claim_id: req.params.claimId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: garages.length,
      data: garages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single garage
// @route   GET /api/claim-garages/:id
export const getGarage = async (req, res, next) => {
  try {
    const garage = await prisma.claimGarage.findUnique({
      where: { id: req.params.id },
    });

    if (!garage) {
      throw new ApiError(404, 'Garage record not found');
    }

    res.json({
      success: true,
      data: garage,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new garage record
// @route   POST /api/claim-garages
export const createGarage = async (req, res, next) => {
  try {
    const {
      claim_id,
      claim_reference,
      garage_name,
      garage_location,
      work_order_number,
      work_order_date,
      estimated_amount,
      final_amount,
      repair_description,
      status,
      start_date,
      completion_date,
      is_selected,
      notes,
    } = req.body;

    if (!claim_id || !garage_name) {
      throw new ApiError(400, 'claim_id and garage_name are required');
    }

    // Verify claim exists
    const claim = await prisma.claim.findUnique({ where: { id: claim_id } });
    if (!claim) {
      throw new ApiError(404, 'Claim not found');
    }

    const garage = await prisma.claimGarage.create({
      data: {
        claim_id,
        claim_reference: claim_reference || claim.claim_reference,
        garage_name,
        garage_location,
        work_order_number,
        work_order_date: work_order_date ? new Date(work_order_date) : null,
        estimated_amount: estimated_amount ? Number(estimated_amount) : null,
        final_amount: final_amount ? Number(final_amount) : null,
        repair_description,
        status: status || 'Proforma_Requested',
        start_date: start_date ? new Date(start_date) : null,
        completion_date: completion_date ? new Date(completion_date) : null,
        assigned_by_id: req.user.id,
        assigned_by_name: req.user.email,
        is_selected: is_selected || false,
        notes,
      },
    });

    res.status(201).json({
      success: true,
      data: garage,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update garage record
// @route   PUT /api/claim-garages/:id
export const updateGarage = async (req, res, next) => {
  try {
    const garage = await prisma.claimGarage.findUnique({
      where: { id: req.params.id },
    });

    if (!garage) {
      throw new ApiError(404, 'Garage record not found');
    }

    const data = { ...req.body };

    if (req.body.work_order_date) data.work_order_date = new Date(req.body.work_order_date);
    if (req.body.start_date) data.start_date = new Date(req.body.start_date);
    if (req.body.completion_date) data.completion_date = new Date(req.body.completion_date);
    if (req.body.estimated_amount !== undefined) data.estimated_amount = Number(req.body.estimated_amount);
    if (req.body.final_amount !== undefined) data.final_amount = Number(req.body.final_amount);

    const updatedGarage = await prisma.claimGarage.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: updatedGarage,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete garage record
// @route   DELETE /api/claim-garages/:id
export const deleteGarage = async (req, res, next) => {
  try {
    const garage = await prisma.claimGarage.findUnique({
      where: { id: req.params.id },
    });

    if (!garage) {
      throw new ApiError(404, 'Garage record not found');
    }

    await prisma.claimGarage.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Garage record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};