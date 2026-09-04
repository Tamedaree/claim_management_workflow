// src/middleware/auditContext.js
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

const als = new AsyncLocalStorage();

export function auditContext(req, res, next) {
  const user = req.user || null;

  const store = {
    requestId: randomUUID(),
    userId: user?.id ?? null,
    userName: user
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
        user.email ||
        null
      : null,
    userRole: user?.role ?? null,
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
    startTime: Date.now(),
  };

  res.locals.requestId = store.requestId;
  als.run(store, () => next());
}

export function getAuditContext() {
  return als.getStore() || {};
}

// Called by `protect` once it has decoded the user, so the context
// reflects the actual authenticated actor even though `protect` runs
// per-route, after auditContext has already opened the store.
export function setAuditActor(user) {
  const store = als.getStore();
  if (!store || !user) return;
  store.userId = user.id ?? null;
  store.userName =
    (`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email) ??
    null;
  store.userRole = user.role ?? null;
}
