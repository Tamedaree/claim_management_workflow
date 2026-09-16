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
