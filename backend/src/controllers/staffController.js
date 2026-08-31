import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import ApiError from "../utils/ApiError.js";

// @desc    Get all staff members
// @route   GET /api/staff
export const getStaffMembers = async (req, res, next) => {
  try {
    const { role, department, status, search, email, employee_id } = req.query;

    const where = {};

    if (role) where.role = role;
    if (department) where.department = department;
    if (status) where.status = status;
    if (email) where.email = email;
    if (employee_id) where.employee_id = employee_id;

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employee_id: { contains: search, mode: "insensitive" } },
      ];
    }

    const staff = await prisma.staffMember.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      count: staff.length,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single staff member
// @route   GET /api/staff/:id
export const getStaffMember = async (req, res, next) => {
  try {
    const staff = await prisma.staffMember.findUnique({
      where: { id: req.params.id },
    });

    if (!staff) {
      throw new ApiError(404, "Staff member not found");
    }

    res.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new staff member + linked login account
// @route   POST /api/staff
export const createStaffMember = async (req, res, next) => {
  try {
    const {
      email,
      password,
      first_name,
      middle_name,
      last_name,
      gender,
      phone,
      role,
      department,
      work_location,
      joining_date,
      employee_id,
      notes,
    } = req.body;

    if (!email || !first_name || !last_name || !role || !password) {
      throw new ApiError(
        400,
        "email, first_name, last_name, role and password are required",
      );
    }

    if (password.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }

    const existingStaff = await prisma.staffMember.findUnique({
      where: { email },
    });
    if (existingStaff) {
      throw new ApiError(400, "Staff member with this email already exists");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(400, "A login account with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [staff] = await prisma.$transaction([
      prisma.staffMember.create({
        data: {
          email,
          first_name,
          middle_name,
          last_name,
          gender,
          phone,
          role,
          department,
          work_location,
          joining_date: joining_date ? new Date(joining_date) : null,
          employee_id,
          notes,
          status: "Active",
          invited: true,
        },
      }),
      prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
          department,
          work_location,
          phone,
          is_active: true,
        },
      }),
    ]);

    res.status(201).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update staff member (+ keep linked User in sync)
// @route   PUT /api/staff/:id
export const updateStaffMember = async (req, res, next) => {
  try {
    const staff = await prisma.staffMember.findUnique({
      where: { id: req.params.id },
    });

    if (!staff) {
      throw new ApiError(404, "Staff member not found");
    }

    const data = { ...req.body };
    delete data.password; // password changes go through resetStaffPassword only

    if (req.body.joining_date) {
      data.joining_date = new Date(req.body.joining_date);
    }

    // Prevent email duplication
    if (req.body.email && req.body.email !== staff.email) {
      const existing = await prisma.staffMember.findUnique({
        where: { email: req.body.email },
      });
      if (existing) {
        throw new ApiError(400, "Email already in use");
      }
    }

    const updatedStaff = await prisma.staffMember.update({
      where: { id: req.params.id },
      data,
    });

    // Keep the linked login account's role/department/phone/work_location in sync
    const linkedUser = await prisma.user.findUnique({
      where: { email: staff.email },
    });
    if (linkedUser) {
      await prisma.user.update({
        where: { email: staff.email },
        data: {
          role: req.body.role ?? undefined,
          department: req.body.department ?? undefined,
          phone: req.body.phone ?? undefined,
          work_location: req.body.work_location ?? undefined,
        },
      });
    }

    res.json({
      success: true,
      data: updatedStaff,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate / Activate staff (+ linked login account)
// @route   PATCH /api/staff/:id/status
export const updateStaffStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["Active", "Inactive"].includes(status)) {
      throw new ApiError(400, "Status must be Active or Inactive");
    }

    const staff = await prisma.staffMember.findUnique({
      where: { id: req.params.id },
    });

    if (!staff) {
      throw new ApiError(404, "Staff member not found");
    }

    const updatedStaff = await prisma.staffMember.update({
      where: { id: req.params.id },
      data: { status },
    });

    // Deactivating a staff member also blocks their login
    const linkedUser = await prisma.user.findUnique({
      where: { email: staff.email },
    });
    if (linkedUser) {
      await prisma.user.update({
        where: { email: staff.email },
        data: { is_active: status === "Active" },
      });
    }

    res.json({
      success: true,
      data: updatedStaff,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset a staff member's login password (admin-set)
// @route   PATCH /api/staff/:id/reset-password
export const resetStaffPassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }

    const staff = await prisma.staffMember.findUnique({
      where: { id: req.params.id },
    });

    if (!staff) {
      throw new ApiError(404, "Staff member not found");
    }

    const linkedUser = await prisma.user.findUnique({
      where: { email: staff.email },
    });
    if (!linkedUser) {
      throw new ApiError(
        404,
        "No login account is linked to this staff member",
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { email: staff.email },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete staff member (+ linked login account)
// @route   DELETE /api/staff/:id
export const deleteStaffMember = async (req, res, next) => {
  try {
    const staff = await prisma.staffMember.findUnique({
      where: { id: req.params.id },
    });

    if (!staff) {
      throw new ApiError(404, "Staff member not found");
    }

    const linkedUser = await prisma.user.findUnique({
      where: { email: staff.email },
    });

    await prisma.$transaction([
      prisma.staffMember.delete({ where: { id: req.params.id } }),
      ...(linkedUser
        ? [prisma.user.delete({ where: { email: staff.email } })]
        : []),
    ]);

    res.json({
      success: true,
      message: "Staff member deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
