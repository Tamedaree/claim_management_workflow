import { GIO_CASE_REASONS } from "@/lib/roleConfig";

export const GIO_REASON_LABELS = Object.fromEntries(
  GIO_CASE_REASONS.map((r) => [r.value, r.label]),
);

export const GIO_REASON_GROUPS = {
  complaint: ["Customer_Complaint_Handling"],
  advisory: [
    "Advice_Request",
    "Legal_Advice",
    "Technical_Advice",
    "Third_Party_Recovery_Advice",
  ],
};

/** Operationally finished (manual workflow completed / closed) */
export function isGioCompleted(c) {
  if (c?.closure_date) return true;
  const s = c?.status;
  return (
    s === "Claim_Closed" ||
    s === "Closed" ||
    s === "Completed" ||
    s === "Approved" // only if your backend sets this when work finishes
  );
}

export function isGioRejected(c) {
  return c?.status === "Rejected";
}

export function isGioReturned(c) {
  const s = c?.status;
  return (
    s === "Returned" ||
    s === "Returned_for_Correction" ||
    s === "Returned_to_Originating_Office" ||
    s === "Additional_Info_Requested"
  );
}

export function isGioPending(c) {
  if (!c?.status || c.status === "Draft") return false;
  return !isGioCompleted(c) && !isGioRejected(c) && !isGioReturned(c);
}

function emptyTypeRow(reason) {
  return {
    reason,
    label: GIO_REASON_LABELS[reason] || String(reason).replace(/_/g, " "),
    completed: 0,
    rejected: 0,
    returned: 0,
    inProgress: 0,
  };
}

/**
 * GIO monitoring — by case reason × operational outcome
 */
export function buildGioMonitoring(claims = []) {
  const byType = {};
  for (const r of GIO_CASE_REASONS) {
    byType[r.value] = emptyTypeRow(r.value);
  }

  const totals = {
    received: claims.length,
    inProgress: 0,
    returned: 0,
    completed: 0,
    rejected: 0,
    totalCompletedAmount: 0,
    totalPaid: 0,
  };

  for (const c of claims) {
    const key = c.gio_case_reason || "Other_Management_Decisions";
    if (!byType[key]) byType[key] = emptyTypeRow(key);

    if (isGioCompleted(c)) {
      totals.completed += 1;
      byType[key].completed += 1;
      totals.totalCompletedAmount += Number(
        c.final_approval_amount ?? c.claim_amount ?? 0,
      );
      totals.totalPaid += Number(
        c.registration_data?.final_payment_amount || 0,
      );
    } else if (isGioRejected(c)) {
      totals.rejected += 1;
      byType[key].rejected += 1;
    } else if (isGioReturned(c)) {
      totals.returned += 1;
      byType[key].returned += 1;
    } else if (isGioPending(c)) {
      totals.inProgress += 1;
      byType[key].inProgress += 1;
    }
  }

  return {
    totals,
    byType: Object.values(byType),
    complaintsCount: claims.filter((c) =>
      GIO_REASON_GROUPS.complaint.includes(c.gio_case_reason),
    ).length,
    advisoryCount: claims.filter((c) =>
      GIO_REASON_GROUPS.advisory.includes(c.gio_case_reason),
    ).length,
  };
}

/**
 * GIO performance — counts by reason group (completed cases)
 */
export function buildGioPerformance(claims = []) {
  const m = buildGioMonitoring(claims);
  const completedWith = (reasons) =>
    claims.filter(
      (c) => reasons.includes(c.gio_case_reason) && isGioCompleted(c),
    ).length;

  return {
    received: m.totals.received,
    inProgress: m.totals.inProgress,
    returned: m.totals.returned,
    completed: m.totals.completed,
    rejected: m.totals.rejected,
    workOrders: completedWith([
      "Work_Order_Approval",
      "Additional_WO_Approval",
    ]),
    cashOption: completedWith(["Cash_Option_Approval"]),
    paymentApprovals: completedWith([
      "Payment_Approval",
      "Direct_Cash_Payment_Approval",
      "Vendor_Payment_Approval",
    ]),
    salvage: completedWith(["Less_Salvage_Verification"]),
    totalLoss: completedWith(["Total_Loss_Approval"]),
    repair: completedWith(["Repair_Approval", "Additional_Repair_Approval"]),
    standardClaim: completedWith(["Standard_Claim_Approval"]),
    complaints: m.complaintsCount,
    advisory: m.advisoryCount,
    totalCompletedAmount: m.totals.totalCompletedAmount,
    totalPaid: m.totals.totalPaid,
    byType: m.byType,
  };
}
