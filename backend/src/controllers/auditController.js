import prisma from "../config/db.js";

function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

export async function getClaimAuditTimeline(req, res) {
  const claimIdentifier = req.params.id?.trim();

  try {
    const claim = await prisma.claim.findFirst({
      where: {
        OR: [{ claim_reference: claimIdentifier }, { id: claimIdentifier }],
      },
      select: { id: true, claim_reference: true },
    });

    if (!claim) {
      return res.status(404).json({ error: "Claim reference not found" });
    }

    const claimId = claim.id;
    const [actions, dataChanges, activities, accessLogs] = await Promise.all([
      prisma.claimAction.findMany({
        where: { claim_id: claimId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.dataAuditLog.findMany({
        where: { entityType: "Claim", entityId: claimId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.claimActivity.findMany({
        where: { claim_id: claimId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.accessLog.findMany({
        where: { claimId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
      ...activities.map((activity) => ({
        kind: "activity",
        at: activity.updatedAt || activity.createdAt,
        actorName: activity.responsible_user_name,
        actorRole: activity.responsible_role,
        summary: `${activity.stage_name} — ${activity.status}${activity.comments ? `: ${activity.comments}` : ""}`,
        raw: activity,
      })),
      ...accessLogs.map((log) => ({
        kind: "access",
        at: log.createdAt,
        actorName: null,
        actorRole: log.actorRole,
        summary: `${log.action || "API_CALL"} — ${log.method} ${log.path} (${log.statusCode ?? "unknown"})`,
        raw: log,
      })),
    ].sort((x, y) => {
      const timeDifference = new Date(x.at) - new Date(y.at);
      return timeDifference || String(x.raw.id).localeCompare(String(y.raw.id));
    });

    return res.json({
      claimId,
      claimReference: claim.claim_reference,
      timeline,
    });
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
    });

    const actorIds = [
      ...new Set(logs.map((log) => log.actorId).filter(Boolean)),
    ];
    const users = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));
    const staff = users.length
      ? await prisma.staffMember.findMany({
          where: { email: { in: users.map((user) => user.email) } },
          select: {
            email: true,
            first_name: true,
            middle_name: true,
            last_name: true,
          },
        })
      : [];
    const staffByEmail = new Map(staff.map((member) => [member.email, member]));

    return res.json(
      logs.map((log) => {
        const user = userById.get(log.actorId);
        const member = user && staffByEmail.get(user.email);
        const actorName = member
          ? [member.first_name, member.middle_name, member.last_name]
              .filter(Boolean)
              .join(" ")
          : user?.email || null;

        return { ...log, actorName, ip: normalizeIp(log.ip) };
      }),
    );
  } catch (err) {
    console.error("[auditController] getAccessLogs failed:", err);
    return res.status(500).json({ error: "Failed to load access logs" });
  }
}
