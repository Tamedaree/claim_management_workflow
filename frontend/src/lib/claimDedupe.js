const CLOSED_STATUSES = new Set([
  "Claim_Closed",
  "Closed",
  "Completed",
  "Approved",
  "Rejected",
]);

export function isClosedClaim(c) {
  return CLOSED_STATUSES.has(c?.status) || !!c?.closure_date;
}

/**
 * Hide closed claims when a newer active claim shares the same claim_number.
 * Claims without claim_number are always kept.
 */
export function dedupeClosedWhenActiveExists(list) {
  if (!Array.isArray(list) || list.length === 0) return list || [];

  const byClaimNo = new Map();
  for (const c of list) {
    const key = (c.claim_number || "").trim().toLowerCase();
    if (!key) continue;
    if (!byClaimNo.has(key)) byClaimNo.set(key, []);
    byClaimNo.get(key).push(c);
  }

  const hideIds = new Set();
  for (const [, group] of byClaimNo) {
    if (group.length < 2) continue;
    const hasActive = group.some((c) => !isClosedClaim(c));
    if (!hasActive) continue;
    for (const c of group) {
      if (isClosedClaim(c)) hideIds.add(c.id);
    }
  }

  return list.filter((c) => !hideIds.has(c.id));
}
