import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { generateToken } from "../utils/generateToken.js";
import ApiError from "../utils/ApiError.js";
import { setAuditActor } from "../middleware/auditContext.js";
import { notifyAdmins } from "../utils/notifyAdmins.js";

// @desc    Register new user
// @route   POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      role,
      department,
      phone,
      position_title,
      work_location,
    } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(400, "User already exists with this email");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || "claim_adjuster",
        department,
        phone,
        position_title,
        work_location,
      },
      select: {
        id: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        position_title: true,
        work_location: true,
        is_active: true,
        createdAt: true,
      },
    });

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.user.findUnique({ where: { email } });

    const settings = await prisma.systemSettings.findFirst({
      where: { key: "singleton" },
    });
    const maxAttempts = settings?.sec_max_failed_attempts ?? 5;
    const lockMinutes = settings?.sec_lockout_minutes ?? 15;

    // Unknown email — same message (no user enumeration)
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Already locked?
    if (user.locked_until && user.locked_until > new Date()) {
      throw new ApiError(
        403,
        "Account temporarily locked due to too many failed logins. Try again later.",
      );
    }

    const passwordOk = await bcrypt.compare(password, user.password);

    if (!passwordOk) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const data = { failed_login_attempts: attempts };

      if (attempts >= maxAttempts) {
        data.locked_until = new Date(Date.now() + lockMinutes * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data,
      });

      // Optional: AccessLog LOGIN_FAILED here

      if (attempts >= maxAttempts) {
        try {
          await notifyAdmins({
            title: "Account locked",
            message: `Account ${user.email} locked after ${attempts} failed login attempts (lock ${lockMinutes} min).`,
            type: "account_locked",
          });
        } catch {
          // never block login response on notify failure
        }
      }

      throw new ApiError(401, "Invalid email or password");
    }

    if (!user.is_active) {
      throw new ApiError(403, "Your account is deactivated");
    }

    // Success — clear lock counters
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    const token = generateToken(user.id);
    req.user = user;
    setAuditActor(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone,
        position_title: user.position_title,
        work_location: user.work_location,
        profile_image_url: user.profile_image_url,
        is_active: user.is_active,
        must_change_password: user.must_change_password === true,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        position_title: true,
        work_location: true,
        work_location_type: true,
        profile_image_url: true,
        is_active: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/auth/update-profile
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { phone, position_title, work_location, department } = req.body;

    const data = {};
    if (phone !== undefined) data.phone = phone;
    if (position_title !== undefined) data.position_title = position_title;
    if (work_location !== undefined) data.work_location = work_location;
    if (department !== undefined) data.department = department;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
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

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
export const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new ApiError(400, "Current password and new password are required");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new ApiError(400, "Current password is incorrect");
    }

    if (currentPassword === newPassword) {
      throw new ApiError(
        400,
        "New password must be different from current password",
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, must_change_password: false },
    });

    try {
      await notifyAdmins({
        title: "Password changed",
        message: `${user.email} (${user.role}) changed their password.`,
        type: "password_changed",
      });
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const uploadProfileImage = async (req, res, next) => {
  try {
    console.log("========== PROFILE PHOTO ==========");
    console.log("User:", req.user);
    console.log("File:", req.file);
    console.log("Body:", req.body);
    console.log("===================================");
    if (!req.file) {
      throw new ApiError(400, "No image uploaded");
    }

    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { profile_image_url: imageUrl },
      select: {
        id: true,
        email: true,
        role: true,
        phone: true,
        position_title: true,
        department: true,
        work_location: true,
        work_location_type: true,
        profile_image_url: true,
        is_active: true,
      },
    });

    res.json({
      success: true,
      message: "Profile photo updated",
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const resetStaffPassword = async (req, res, next) => {
  try {
    const { password } = req.body; // temp password from admin UI
    if (!password || password.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }

    const hashed = await bcrypt.hash(password, 12);

    // Update StaffMember if you keep a staff row, AND the login User by email
    const staff = await prisma.staffMember.findUnique({
      where: { id: req.params.id },
    });
    if (!staff) throw new ApiError(404, "Staff not found");

    await prisma.user.update({
      where: { email: staff.email },
      data: {
        password: hashed,
        must_change_password: true,
      },
    });

    try {
      await notifyAdmins({
        title: "Password reset by admin",
        message: `Temporary password set for ${staff.email}. User must change it on next login.`,
        type: "security_alert",
      });
    } catch {
      // non-fatal
    }

    // Never persist plain password in DB
    res.json({
      success: true,
      message: "Temporary password set. User must change it on next login.",
      // Return plain password ONLY in this admin response so UI can show/copy once
      temporaryPassword: password,
    });
  } catch (e) {
    next(e);
  }
};
