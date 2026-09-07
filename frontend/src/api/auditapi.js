import api from "@/api/api"; // adjust to the actual path/alias where api.js lives

export async function fetchDataAuditLogs(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== "" && v != null),
  );
  const { data } = await api.get("/audit/data-changes", { params });
  return data;
}

export async function fetchAccessLogs(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== "" && v != null),
  );
  const { data } = await api.get("/audit/access-logs", { params });
  return data;
}

export async function fetchClaimTimeline(claimId) {
  const { data } = await api.get(`/audit/claims/${claimId}/timeline`);
  return data;
}
