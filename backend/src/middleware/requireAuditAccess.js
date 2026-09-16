import ApiError from "../utils/ApiError.js";

const FULL = ["admin"];
const OVERSIGHT = ["ceo", "chief_of_gio", "senior_director","director"];

export function requireAuditAccess(req, res, next) {
  const role = req.user?.role;
  if (!role || ![...FULL, ...OVERSIGHT].includes(role)) {
    return next(new ApiError(403, "Not authorized to view audit logs"));
  }
  next();
}

export function requireAuditAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(new ApiError(403, "Admin only"));
  }
  next();
}
