import { getAuditContext } from "../middleware/auditContext.js";

const AUDITED_MODELS = [
  "Claim",
  "StaffMember",
  "ApprovalThreshold",
  "WorkflowStage",
  "User",
];
const SENSITIVE_FIELDS = { User: ["password"] };

function diff(model, before, after) {
  if (!before || !after) return null;
  const excluded = SENSITIVE_FIELDS[model] || [];
  const changes = {};

  for (const key of Object.keys(after)) {
    if (excluded.includes(key)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = { old: "[redacted]", new: "[redacted]" };
      }
      continue;
    }
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { old: before[key], new: after[key] };
    }
  }
  return Object.keys(changes).length ? changes : null;
}

async function logChange(basePrisma, model, entityId, action, before, after) {
  const ctx = getAuditContext();
  console.log("[auditExtension] context at write time:", ctx); // temporary debug line

  try {
    await basePrisma.dataAuditLog.create({
      data: {
        entityType: model,
        entityId: String(entityId),
        action,
        changes: action === "DELETE" ? null : diff(model, before, after),
        actorId: ctx.userId ?? null,
        actorName: ctx.userName ?? null,
        actorRole: ctx.userRole ?? null,
        requestId: ctx.requestId ?? null,
      },
    });
  } catch (err) {
    console.error(`[auditExtension] failed for ${model}:`, err);
  }
}

async function logBulk(basePrisma, model, action, args, affectedCount) {
  const ctx = getAuditContext();
  try {
    await basePrisma.dataAuditLog.create({
      data: {
        entityType: model,
        entityId: "bulk",
        action,
        changes: {
          where: args.where ?? null,
          data: action === "UPDATE" ? (args.data ?? null) : null,
          affectedCount,
        },
        actorId: ctx.userId ?? null,
        actorName: ctx.userName ?? null,
        actorRole: ctx.userRole ?? null,
        requestId: ctx.requestId ?? null,
      },
    });
  } catch (err) {
    console.error(`[auditExtension] bulk failed for ${model}:`, err);
  }
}

function uncapitalize(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function auditExtension(basePrisma) {
  return basePrisma.$extends({
    name: "auditExtension",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.includes(model)) {
            await logChange(
              basePrisma,
              model,
              result.id,
              "CREATE",
              null,
              result,
            );
          }
          return result;
        },
        async update({ model, args, query }) {
          const shouldAudit = AUDITED_MODELS.includes(model);
          const before = shouldAudit
            ? await basePrisma[uncapitalize(model)].findUnique({
                where: args.where,
              })
            : null;
          const result = await query(args);
          if (shouldAudit) {
            await logChange(
              basePrisma,
              model,
              result.id,
              "UPDATE",
              before,
              result,
            );
          }
          return result;
        },
        async delete({ model, args, query }) {
          const shouldAudit = AUDITED_MODELS.includes(model);
          const before = shouldAudit
            ? await basePrisma[uncapitalize(model)].findUnique({
                where: args.where,
              })
            : null;
          const result = await query(args);
          if (shouldAudit) {
            await logChange(
              basePrisma,
              model,
              before?.id ?? result?.id,
              "DELETE",
              before,
              null,
            );
          }
          return result;
        },
        async updateMany({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.includes(model)) {
            await logBulk(basePrisma, model, "UPDATE", args, result?.count);
          }
          return result;
        },
        async deleteMany({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.includes(model)) {
            await logBulk(basePrisma, model, "DELETE", args, result?.count);
          }
          return result;
        },
      },
    },
  });
}

export default auditExtension;
