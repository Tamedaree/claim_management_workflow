import prisma from "../config/db.js";

function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

function parsePagination(req) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  return { page, limit, skip: (page - 1) * limit };
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

// @desc    Business/data-change audit log — filtered, paginated
// @route   GET /api/audit/data-changes
export async function getDataAuditLogs(req, res) {
  const { entityType, entityId, actorId, action, search, from, to } = req.query;
  const { page, limit, skip } = parsePagination(req);

  try {
    const where = {
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      actorId: actorId || undefined,
      action: action || undefined,
      createdAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    };

    if (search) {
      where.OR = [
        { entityId: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
        { actorName: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
      ];
    }

    if (req.user.role !== "admin") {
      if (!entityType) {
        where.entityType = "Claim";
      } else if (entityType !== "Claim") {
        return res.status(403).json({
          success: false,
          error: "Only claim data changes are available for your role",
        });
      }
    }

    const [logs, total] = await Promise.all([
      prisma.dataAuditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      prisma.dataAuditLog.count({ where }),
    ]);

    return res.json({
      success: true,
      data: logs,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("[auditController] getDataAuditLogs failed:", err);
    return res.status(500).json({ error: "Failed to load data audit logs" });
  }
}

// @desc    Access / API request log — filtered, paginated
// @route   GET /api/audit/access-logs
export async function getAccessLogs(req, res) {
  const { actorId, method, action, status, search, from, to } = req.query;
  const { page, limit, skip } = parsePagination(req);

  try {
    const where = {
      actorId: actorId || undefined,
      method: method || undefined,
      action: action || undefined,
      createdAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    };

    if (status === "success") {
      where.statusCode = { gte: 200, lt: 400 };
    } else if (status === "denied") {
      where.statusCode = { in: [401, 403] };
    } else if (status === "error") {
      where.statusCode = { gte: 400 };
    }

    if (search) {
      where.path = { contains: search, mode: "insensitive" };
    }

    if (req.user.role !== "admin") {
      if (!req.query.action) {
        where.action = {
          in: [
            "LOGIN_SUCCESS",
            "LOGIN_FAILED",
            "LOGOUT",
            "VIEW_CLAIM",
            "EXPORT",
          ],
        };
      }
    }

    const [logs, total] = await Promise.all([
      prisma.accessLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      prisma.accessLog.count({ where }),
    ]);

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

    let data = logs.map((log) => {
      const user = userById.get(log.actorId);
      const member = user && staffByEmail.get(user.email);
      const actorName = member
        ? [member.first_name, member.middle_name, member.last_name]
            .filter(Boolean)
            .join(" ")
        : user?.email || null;

      return {
        ...log,
        actorName,
        actorEmail: user?.email || null,
        ip: normalizeIp(log.ip),
      };
    });

    // Search by actor name/email happens after the join, since the DB
    // query can't filter on a computed field — acceptable at current
    // scale (limit is capped at 200/page), revisit with a raw query
    // or a denormalized actorEmail column on AccessLog if volume grows.
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (d) =>
          d.path?.toLowerCase().includes(s) ||
          d.actorName?.toLowerCase().includes(s) ||
          d.actorEmail?.toLowerCase().includes(s),
      );
    }

    return res.json({
      success: true,
      data,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("[auditController] getAccessLogs failed:", err);
    return res.status(500).json({ error: "Failed to load access logs" });
  }
}
