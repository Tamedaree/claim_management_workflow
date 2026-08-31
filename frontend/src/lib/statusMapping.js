// Maps each workflow stage name to the ClaimStatus it should set once
// that stage is completed.

export const CLAIM_DIVISION_STAGE_STATUS = {
  "Claim Receipt & Registration": "Claim_Registered",
  "Claim Assignment": "Assigned_to_Claim_Adjuster",
  "Claim Adjuster Allocation": "Underwriting_Verification",
  "Policy & Underwriting Verification": "Survey_Requested",
  "Third-Party Recovery Recording": "Survey_Requested",
  "Damage Assessment Request": "Survey_in_Progress",
  "Survey & Damage Assessment": "Damage_Assessment_Completed",
  "Assessment Review by Principal": "Principal_Review_Pending",
  "Proforma & Garage Bidding": "Proforma_Collection",
  "Tender Analysis & Garage Selection": "Tender_Analysis_Pending",
  "Work Order Preparation & Issuance": "Work_Order_Approved",
  "Repair Monitoring": "Repair_in_Progress",
  "Final Inspection (Post-Repair)": "Repair_Approved",
  // "Total Loss Assessment" removed — Total_Loss_Review is no longer
  // a valid ClaimStatus. Falls back to the claim's current status
  // until you tell me what this stage should set instead.
  "Salvage & Satisfaction Note Collection": "Salvage_Pending",
  "Payment Preparation & Settlement Recommendation": "Payment_Preparation",
  "Managerial Review": "Payment_Review_Pending",
  "Director Approval": "Payment_Approval_Pending",
  "Payment Processing": "Payment_Pending",
  "Claim Closed": "Claim_Closed",
};

export const CLAIM_DIVISION_INITIAL_STATUS = "Notification_Received";

export const GIO_STAGE_STATUS = {
  "GIO Case Registration": "Pending_GIO_Assignment",
  "Chief of GIO Decision": "Assigned_to_GIO_Claim_Adjuster",
  "GIO Claim Adjuster Review": "Document_Review_Pending",
  "GIO Claim Manager Review": "Claim_Manager_Review_Pending",
  "Director Decision": "Director_Decision_Pending",
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
