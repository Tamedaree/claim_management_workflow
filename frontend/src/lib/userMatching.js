import api from "@/api/api";

/**
 * Location-aware approver matching for your EIC role set only.
 *
 * Matching priority:
 * 1. Same originating_office
 * 2. Same forwarding_office_type
 * 3. Same department
 * 4. Head Office preference for senior roles
 * 5. Fallback: all users with that role
 */

const LOCAL_ROLES = [
  "secretary",
  "claim_adjuster",
  "surveyor",
  "principal_claim_officer",
  "claim_manager",
  "gio_claim_adjuster",
];

const HEAD_OFFICE_ROLES = [
  "admin",
  "ceo",
  "chief_of_gio",
  "director",
  "gio_claim_manager",
];

export async function findApproversByRoleAndLocation(systemRole, claim) {
  try {
    const res = await api.get(`/users?role=${encodeURIComponent(systemRole)}`);
    const users = res.data?.data || res.data || [];
    if (!Array.isArray(users) || users.length === 0) return [];

    let matched = [];

    // 1) originating office
    if (claim?.originating_office) {
      matched = users.filter(
        (u) =>
          u.work_location === claim.originating_office ||
          u.originating_office === claim.originating_office,
      );
    }

    // 2) forwarding office type
    if (matched.length === 0 && claim?.forwarding_office_type) {
      matched = users.filter(
        (u) =>
          u.work_location_type === claim.forwarding_office_type ||
          u.forwarding_office_type === claim.forwarding_office_type,
      );
    }

    // 3) department
    if (matched.length === 0 && claim?.current_department) {
      matched = users.filter(
        (u) =>
          u.department === claim.current_department ||
          u.current_department === claim.current_department,
      );
    }

    // 4) senior roles prefer Head Office
    if (matched.length === 0 && HEAD_OFFICE_ROLES.includes(systemRole)) {
      matched = users.filter(
        (u) =>
          u.work_location_type === "Head Office" ||
          u.work_location_type === "Head_Office",
      );
    }

    // 5) local roles prefer non-head-office when available
    if (matched.length === 0 && LOCAL_ROLES.includes(systemRole)) {
      matched = users.filter(
        (u) =>
          u.work_location_type &&
          u.work_location_type !== "Head Office" &&
          u.work_location_type !== "Head_Office",
      );
    }

    // 6) fallback
    if (matched.length === 0) matched = users;
    return matched;
  } catch (err) {
    console.error("findApproversByRoleAndLocation error:", err);
    return [];
  }
}

export async function findFirstApprovers(chain, claim, approverRoleMap) {
  if (!chain || chain.length === 0) return { users: [], systemRole: null };

  const firstRoleLabel = chain[0];
  const systemRole = approverRoleMap?.[firstRoleLabel];
  if (!systemRole) return { users: [], systemRole: null };

  const users = await findApproversByRoleAndLocation(systemRole, claim);
  return { users, systemRole };
}
