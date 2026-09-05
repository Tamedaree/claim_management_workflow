import { getAuditContext } from "./auditContext.js";
import prisma from "../config/db.js";

const SKIP_PATHS = ["/health", "/favicon.ico"];

function shouldSkip(req) {
  return SKIP_PATHS.includes(req.path) || req.path.startsWith("/static");
}

function extractClaimId(req) {
  if (req.params?.claimId || req.params?.id || req.body?.claim_id) {
    return req.params?.claimId || req.params?.id || req.body?.claim_id;
  }

  const path = req.originalUrl?.split("?")[0] || "";
  const claimPath = path.match(/^\/api\/claims\/([^/]+)/);
  if (claimPath) return claimPath[1];

  const relatedClaimPath = path.match(
    /^\/api\/(?:claim-actions|claim-activities|claim-garages)\/claim\/([^/]+)/,
  );
  return relatedClaimPath?.[1] || null;
}

function classifyAction(req, statusCode) {
  if (req.path === "/api/auth/login") {
    return statusCode >= 400 ? "LOGIN_FAILED" : "LOGIN_SUCCESS";
  }
  if (req.path === "/api/auth/logout") return "LOGOUT";

  const isClaimDetailGet =
    req.method === "GET" &&
    /^\/api\/claims\/[^/]+$/.test(req.originalUrl?.split("?")[0] || "");
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
          requestId: ctx.requestId,
          actorId: req.user?.id ?? ctx.userId ?? null,
          actorRole: req.user?.role ?? ctx.userRole ?? null,
          method: req.method,
          path: req.route?.path
            ? `${req.baseUrl}${req.route.path}`
            : req.originalUrl,
          statusCode: res.statusCode,
          ip: getRequestIp(req),
          userAgent: ctx.userAgent,
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
