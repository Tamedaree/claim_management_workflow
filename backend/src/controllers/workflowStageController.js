import prisma from "../config/db.js";
import ApiError from "../utils/ApiError.js";

export const getWorkflowStages = async (req, res, next) => {
  try {
    const { workflow_type, workflow_stream, department, is_active, responsible_role } =
      req.query;
    const where = {};
    if (workflow_type) where.workflow_type = workflow_type;
    if (workflow_stream) where.workflow_stream = workflow_stream;
    if (department) where.department = department;
    if (is_active !== undefined) where.is_active = is_active === "true";
    if (responsible_role) where.responsible_role = responsible_role;

    const stages = await prisma.workflowStage.findMany({
      where,
      orderBy: { stage_order: "asc" },
    });

    res.json({ success: true, count: stages.length, data: stages });
  } catch (error) {
    next(error);
  }
};

export const getWorkflowStage = async (req, res, next) => {
  try {
    const stage = await prisma.workflowStage.findUnique({
      where: { id: req.params.id },
    });
    if (!stage) throw new ApiError(404, "Workflow stage not found");
    res.json({ success: true, data: stage });
  } catch (error) {
    next(error);
  }
};

export const createWorkflowStage = async (req, res, next) => {
  try {
    const {
      stage_name,
      description,
      stage_order,
      responsible_role,
      workflow_type,
      workflow_stream,
      applicable_insurance_types,
      applicable_office_types,
      sla_days,
      department,
      is_active,
      is_configurable,
    } = req.body;

    if (!stage_name || stage_order === undefined || !responsible_role) {
      throw new ApiError(
        400,
        "stage_name, stage_order and responsible_role are required",
      );
    }

    const stage = await prisma.workflowStage.create({
      data: {
        stage_name,
        description,
        stage_order: Number(stage_order),
        responsible_role,
        workflow_type: workflow_type || "Claim_Division",
        workflow_stream: workflow_stream || "New_Claim",
        applicable_insurance_types: applicable_insurance_types || [],
        applicable_office_types: applicable_office_types || [],
        sla_days:
          sla_days !== undefined && sla_days !== null && sla_days !== ""
            ? Number(sla_days)
            : null,
        department,
        is_active: is_active !== undefined ? is_active : true,
        is_configurable: is_configurable !== undefined ? is_configurable : true,
      },
    });

    res.status(201).json({ success: true, data: stage });
  } catch (error) {
    next(error);
  }
};

export const updateWorkflowStage = async (req, res, next) => {
  try {
    const stage = await prisma.workflowStage.findUnique({
      where: { id: req.params.id },
    });
    if (!stage) throw new ApiError(404, "Workflow stage not found");

    const data = { ...req.body };
    if (req.body.stage_order !== undefined)
      data.stage_order = Number(req.body.stage_order);
    if (req.body.sla_days !== undefined) {
      data.sla_days =
        req.body.sla_days === "" || req.body.sla_days === null
          ? null
          : Number(req.body.sla_days);
    }

    const updatedStage = await prisma.workflowStage.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, data: updatedStage });
  } catch (error) {
    next(error);
  }
};

export const deleteWorkflowStage = async (req, res, next) => {
  try {
    const stage = await prisma.workflowStage.findUnique({
      where: { id: req.params.id },
    });
    if (!stage) throw new ApiError(404, "Workflow stage not found");
    await prisma.workflowStage.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Workflow stage deleted successfully" });
  } catch (error) {
    next(error);
  }
};
