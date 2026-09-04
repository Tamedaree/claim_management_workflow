import prisma from "../config/db.js";

export async function getClaimAuditTimeline(req, res) {
  const claimId = req.params.id;

  try {
    const [actions, dataChanges, views] = await Promise.all([
      prisma.claimAction.findMany({
        where: { claim_id: claimId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dataAuditLog.findMany({
        where: { entityType: "Claim", entityId: claimId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.accessLog.findMany({
        where: { claimId, action: "VIEW_CLAIM" },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const timeline = [
      ...actions.map((a) => ({
        kind: "action",
        at: a.createdAt,
        actorName: a.action_by_name,
        actorRole: a.action_by_role,
        summary: `${a.action_type}${a.comments ? `: ${a.comments}` : ""}`,
        raw: a,
      })),
      ...dataChanges.map((d) => ({
        kind: "change",
        at: d.createdAt,
        actorName: d.actorName,
        actorRole: d.actorRole,
        summary: `${d.action} — ${d.changes ? Object.keys(d.changes).join(", ") : "no field diff"}`,
        raw: d,
      })),
      ...views.map((v) => ({
        kind: "view",
        at: v.createdAt,
        actorName: null,
        actorRole: v.actorRole,
        summary: "Viewed claim",
        raw: v,
      })),
    ].sort((x, y) => new Date(x.at) - new Date(y.at));

    return res.json({ claimId, timeline });
  } catch (err) {
    console.error("[auditController] timeline failed:", err);
    return res.status(500).json({ error: "Failed to load audit timeline" });
  }
}

export async function getDataAuditLogs(req, res) {
  const { entityType, entityId, actorId, from, to } = req.query;
  try {
    const logs = await prisma.dataAuditLog.findMany({
      where: {
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        actorId: actorId || undefined,
        createdAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json(logs);
  } catch (err) {
    console.error("[auditController] getDataAuditLogs failed:", err);
    return res.status(500).json({ error: "Failed to load data audit logs" });
  }
}

export async function getAccessLogs(req, res) {
  const { actorId, path, action, from, to } = req.query;
  try {
    const logs = await prisma.accessLog.findMany({
      where: {
        actorId: actorId || undefined,
        path: path || undefined,
        action: action || undefined,
        createdAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json(logs);
  } catch (err) {
    console.error("[auditController] getAccessLogs failed:", err);
    return res.status(500).json({ error: "Failed to load access logs" });
  }
}
