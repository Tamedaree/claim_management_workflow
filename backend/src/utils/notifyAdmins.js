import prisma from "../config/db.js";

/**
 * Create the same notification for every active admin.
 * Respects SystemSettings.sec_enable_security_notifications for security types.
 */
export async function notifyAdmins({
  title,
  message,
  type = "security_alert",
  claim_id = null,
  claim_reference = null,
}) {
  const settings = await prisma.systemSettings.findFirst({
    where: { key: "singleton" },
  });

  const securityTypes = [
    "account_locked",
    "password_changed",
    "security_alert",
  ];

  if (
    securityTypes.includes(type) &&
    settings &&
    settings.sec_enable_security_notifications === false
  ) {
    return;
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin", is_active: true },
    select: { id: true },
  });

  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      user_id: a.id,
      title,
      message,
      type,
      claim_id,
      claim_reference,
      is_read: false,
    })),
  });
}
