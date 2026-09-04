import { getAuditContext } from "./auditContext.js";
import prisma from "../config/db.js";

const SKIP_PATHS = ["/health", "/favicon.ico"];

function shouldSkip(req) {
  return SKIP_PATHS.includes(req.path) || req.path.startsWith("/static");
}

function extractClaimId(req) {
  return req.params?.claimId || req.params?.id || req.body?.claim_id || null;
}

function classifyAction(req) {
  if (req.path === "/api/auth/login") return null;
  if (req.path === "/api/auth/logout") return "LOGOUT";

  const isClaimDetailGet =
    req.method === "GET" &&
    req.baseUrl?.includes("/claims") &&
    !!extractClaimId(req);
  if (isClaimDetailGet) return "VIEW_CLAIM";
  if (req.method === "GET" && req.query?.export) return "EXPORT";

  return null;
}

function accessLog(req, res, next) {
  if (shouldSkip(req)) return next();

  res.on("finish", () => {
    const ctx = getAuditContext();
    prisma.accessLog
      .create({
        data: {
          requestId: ctx.requestId,
          actorId: ctx.userId,
          actorRole: ctx.userRole,
          method: req.method,
          path: req.route?.path
            ? `${req.baseUrl}${req.route.path}`
            : req.originalUrl,
          statusCode: res.statusCode,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          durationMs: ctx.startTime ? Date.now() - ctx.startTime : null,
          claimId: extractClaimId(req),
          action: classifyAction(req),
        },
      })
      .catch((err) => console.error("[accessLog] failed:", err));
  });

  next();
}

export default accessLog;
