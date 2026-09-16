import { getAuditContext } from "./auditContext.js";
import prisma from "../config/db.js";

const SKIP_PATHS = ["/health", "/favicon.ico"];

function shouldSkip(req) {
  const path = (req.originalUrl || req.path || "").split("?")[0];
  return (
    SKIP_PATHS.includes(req.path) ||
    SKIP_PATHS.includes(path) ||
    path.startsWith("/static") ||
    path.startsWith("/uploads")
  );
}

function getFullPath(req) {
  return (req.originalUrl || "").split("?")[0] || req.path || "";
}

function extractClaimId(req) {
  if (req.params?.claimId || req.params?.id || req.body?.claim_id) {
    return req.params?.claimId || req.params?.id || req.body?.claim_id || null;
  }

  const path = getFullPath(req);

  const claimPath = path.match(/^\/api\/claims\/([^/]+)/);
  if (claimPath) return claimPath[1];

  const relatedClaimPath = path.match(
    /^\/api\/(?:claim-actions|claim-activities|claim-garages)\/claim\/([^/]+)/,
  );
  return relatedClaimPath?.[1] || null;
}

function classifyAction(req, statusCode) {
  const path = getFullPath(req);

  // Use full path — req.path is only "/login" when mounted at /api/auth
  if (path === "/api/auth/login" || path.endsWith("/auth/login")) {
    return statusCode >= 400 ? "LOGIN_FAILED" : "LOGIN_SUCCESS";
  }
  if (path === "/api/auth/logout" || path.endsWith("/auth/logout")) {
    return "LOGOUT";
  }

  const isClaimDetailGet =
    req.method === "GET" && /^\/api\/claims\/[^/]+$/.test(path);
  if (isClaimDetailGet) return "VIEW_CLAIM";

  if (req.method === "GET" && req.query?.export) return "EXPORT";

  return "API_CALL";
}

function normalizeIp(ip) {
  if (!ip) return null;
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

function getRequestIp(req) {
  const forwardedFor = req.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0].trim() || req.ip || req.socket.remoteAddress;
  return normalizeIp(ip);
}

function accessLog(req, res, next) {
  if (shouldSkip(req)) return next();

  res.on("finish", () => {
    const ctx = getAuditContext();

    prisma.accessLog
      .create({
        data: {
          requestId: ctx.requestId ?? null,
          actorId: req.user?.id ?? ctx.userId ?? null,
          actorRole: req.user?.role ?? ctx.userRole ?? null,
          method: req.method,
          path: req.route?.path
            ? `${req.baseUrl || ""}${req.route.path}`
            : getFullPath(req),
          statusCode: res.statusCode,
          ip: getRequestIp(req),
          userAgent: ctx.userAgent ?? req.get("user-agent") ?? null,
          durationMs: ctx.startTime ? Date.now() - ctx.startTime : null,
          claimId: extractClaimId(req),
          action: classifyAction(req, res.statusCode),
        },
      })
      .catch((err) => console.error("[accessLog] failed:", err));
  });

  next();
}

export default accessLog;
