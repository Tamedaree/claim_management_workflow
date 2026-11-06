import prisma from "../config/db.js";
import ApiError from "../utils/ApiError.js";

export const getSettings = async (req, res, next) => {
  try {
    let settings = await prisma.systemSettings.findUnique({
      where: { key: "singleton" },
    });
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { key: "singleton" },
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      throw new ApiError(403, "Only System Administrators can modify settings");
    }

    const data = { ...req.body };
    delete data.id;
    delete data.key;
    delete data.updatedAt;

    // Password policy bounds (production-safe)
    if (data.sec_min_password_length != null) {
      const n = Number(data.sec_min_password_length);
      if (!Number.isFinite(n) || n < 8 || n > 128) {
        throw new ApiError(
          400,
          "Minimum password length must be between 8 and 128",
        );
      }
      data.sec_min_password_length = Math.floor(n);
    }
    if (data.sec_max_failed_attempts != null) {
      const n = Number(data.sec_max_failed_attempts);
      if (!Number.isFinite(n) || n < 3 || n > 20) {
        throw new ApiError(400, "Max failed attempts must be between 3 and 20");
      }
    }
    if (data.sec_lockout_minutes != null) {
      const n = Number(data.sec_lockout_minutes);
      if (!Number.isFinite(n) || n < 1 || n > 1440) {
        throw new ApiError(400, "Lockout minutes must be between 1 and 1440");
      }
    }

    const updated = await prisma.systemSettings.upsert({
      where: { key: "singleton" },
      update: {
        ...data,
        updated_by_id: req.user.id,
        updated_by_name: req.user.email,
      },
      create: {
        key: "singleton",
        ...data,
        updated_by_id: req.user.id,
        updated_by_name: req.user.email,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const getPublicSettings = async (req, res, next) => {
  try {
    const s = await prisma.systemSettings.findFirst({
      where: { key: "singleton" },
    });
    res.json({
      success: true,
      data: {
        system_name: s?.system_name ?? "EIC Claim Management System",
        organization_name: s?.organization_name,
        timezone: s?.timezone,
        date_format: s?.date_format,
        sec_min_password_length: s?.sec_min_password_length ?? 10,
        sec_require_uppercase: s?.sec_require_uppercase ?? true,
        sec_require_number: s?.sec_require_number ?? true,
        sec_require_special_char: s?.sec_require_special_char ?? true,
      },
    });
  } catch (error) {
    next(error);
  }
};
