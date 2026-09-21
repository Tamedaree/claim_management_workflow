export const CLAIM_DIVISION_STAGE_STATUS = {
  "Claim Receipt & Registration": "Claim_Registered",
  "Claim Review & Assignment": "Pending_Assignment",
  "Principal Assignment to Adjuster": "Assigned_to_Claim_Adjuster",
  "Survey & Damage Assessment Request": "Survey_in_Progress",
  "Survey & Damage Assessment Review": "Bid_Tender_in_Progress",
  "Bid / Tender Process": "Decision_Pending",
  Decision: "Work_Order_Pending",
  "Work Order / Payment Authorization": "Work_Order_Approved",
  "Repair Execution & Quality Check": "Payment_Preparation",
  "Discharge & Payment Preparation": "Payment_Preparation",
  "Discharge & Payment Approval": "Payment_Approved",
  Closure: "Claim_Closed",

  "Approval Case Registration": "Notification_Received",
  "Approval Review": "Approved",
  "Approval Case Closure": "Claim_Closed",
};

export const CLAIM_DIVISION_INITIAL_STATUS = "Notification_Received";

export const GIO_STAGE_STATUS = {
  "GIO Case Registration": "Pending_GIO_Assignment",
  "Chief of GIO Decision": "Assigned_to_GIO_Claim_Adjuster",
  "GIO Claim Adjuster Review": "Document_Review_Pending",
  "GIO Claim Manager Review": "Claim_Manager_Review_Pending",
  "Director Decision": "Director_Decision_Pending",
  "Senior Director Decision": "Senior_Director_Decision_Pending",
  "Chief of GIO Approval": "Chief_of_GIO_Approval_Pending",
  "CEO Decision": "CEO_Approval_Pending",
  "GIO Case Closure": "Closed",
};

export const GIO_INITIAL_STATUS = "Case_Received";

export function statusForCompletedStage(stageName, workflowType, fallback) {
  const map =
    workflowType === "GIO_Approval"
      ? GIO_STAGE_STATUS
      : CLAIM_DIVISION_STAGE_STATUS;
  return map[stageName] || fallback;
}
