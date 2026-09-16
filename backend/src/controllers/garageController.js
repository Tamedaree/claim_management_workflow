import prisma from "../config/db.js";

export const listGarages = async (req, res, next) => {
  try {
    const data = await prisma.garage.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const upsertGarageByName = async (name) => {
  const n = (name || "").trim();
  if (!n) return null;
  return prisma.garage.upsert({
    where: { name: n },
    create: { name: n },
    update: { is_active: true },
  });
};
