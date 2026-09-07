import api from "@/api/api";

/**
 * Return active users with the given system role.
 * Optional light preference for same department; always falls back to all role users.
 */
export async function findApproversByRoleAndLocation(systemRole, claim) {
  try {
    const res = await api.get(`/users?role=${encodeURIComponent(systemRole)}`);
    let users = res.data?.data ?? res.data ?? [];
    if (!Array.isArray(users)) users = [];

    // Only active accounts
    users = users.filter((u) => u.is_active !== false);

    if (users.length === 0) {
      // Fallback: load all users and filter client-side (if role query unsupported)
      const allRes = await api.get("/users");
      const all = allRes.data?.data ?? allRes.data ?? [];
      users = (Array.isArray(all) ? all : []).filter(
        (u) => u.role === systemRole && u.is_active !== false,
      );
    }

    if (users.length === 0) return [];

    // Prefer same department when claim has one
    if (claim?.current_department) {
      const deptMatch = users.filter(
        (u) => u.department === claim.current_department,
      );
      if (deptMatch.length > 0) return deptMatch;
    }

    return users;
  } catch (err) {
    console.error("findApproversByRoleAndLocation error:", err);
    return [];
  }
}

export async function findFirstApprovers(chain, claim, approverRoleMap) {
  if (!chain?.length) return { users: [], systemRole: null };
  const systemRole = approverRoleMap?.[chain[0]];
  if (!systemRole) return { users: [], systemRole: null };
  const users = await findApproversByRoleAndLocation(systemRole, claim);
  return { users, systemRole };
}
