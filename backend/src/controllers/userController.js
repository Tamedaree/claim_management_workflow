import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import ApiError from "../utils/ApiError.js";

async function withStaffNames(user) {
  if (!user) return user;
  const staff = await prisma.staffMember.findUnique({
    where: { email: user.email },
    select: {
      first_name: true,
      middle_name: true,
      last_name: true,
    },
  });
  const first_name = staff?.first_name || null;
  const middle_name = staff?.middle_name || null;
  const last_name = staff?.last_name || null;
  const full_name =
    [first_name, middle_name, last_name].filter(Boolean).join(" ") || null;

  return {
    ...user,
    first_name,
    middle_name,
    last_name,
    full_name,
  };
}

async function withStaffNamesMany(users) {
  if (!users.length) return users;
  const emails = users.map((u) => u.email);
  const staffList = await prisma.staffMember.findMany({
    where: { email: { in: emails } },
    select: {
      email: true,
      first_name: true,
      middle_name: true,
      last_name: true,
    },
  });
  const byEmail = Object.fromEntries(staffList.map((s) => [s.email, s]));
  return users.map((u) => {
    const s = byEmail[u.email];
    const first_name = s?.first_name || null;
    const middle_name = s?.middle_name || null;
    const last_name = s?.last_name || null;
    return {
      ...u,
      first_name,
      middle_name,
      last_name,
      full_name:
        [first_name, middle_name, last_name].filter(Boolean).join(" ") || null,
    };
  });
}

// @desc    Get all users
// @route   GET /api/users
export const getUsers = async (req, res, next) => {
  try {
    const { role, department, is_active, search } = req.query;

    const where = {};

    if (role) where.role = role;
    if (department) where.department = department;
    if (is_active !== undefined) where.is_active = is_active === "true";

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { position_title: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        department: true,
        work_location: true,
        work_location_type: true,
        phone: true,
        position_title: true,
        is_active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const data = await withStaffNamesMany(users);

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
export const getUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        role: true,
        department: true,
        work_location: true,
        work_location_type: true,
        phone: true,
        position_title: true,
        is_active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.json({
      success: true,
      data: await withStaffNames(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user (Admin only)
// @route   POST /api/users
export const createUser = async (req, res, next) => {
  try {
    const {
      email,
      password,
      role,
      department,
      work_location,
      phone,
      position_title,
    } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(400, "User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || "claim_adjuster",
        department,
        work_location,
        phone,
        position_title,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        department: true,
        work_location: true,
        phone: true,
        position_title: true,
        is_active: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
export const updateUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const {
      email,
      role,
      department,
      work_location,
      phone,
      position_title,
      is_active,
    } = req.body;

    // Prevent email duplication
    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ApiError(400, "Email already in use");
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        email,
        role,
        department,
        work_location,
        phone,
        position_title,
        is_active,
      },
      select: {
        id: true,
        email: true,
        role: true,
        department: true,
        work_location: true,
        phone: true,
        position_title: true,
        is_active: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate / Activate user
// @route   PATCH /api/users/:id/status
export const updateUserStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      throw new ApiError(400, "is_active must be a boolean");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { is_active },
      select: {
        id: true,
        email: true,
        role: true,
        is_active: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
export const deleteUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      throw new ApiError(400, "You cannot delete your own account");
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
