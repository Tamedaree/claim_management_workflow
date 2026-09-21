const CLASS_OF_BUSINESS_OPTIONS = [
  "Motor",
  "Fire",
  "GPA",
  "Workmens_Compensation",
  "Engineering",
  "Marine",
  "Liability",
  "Agriculture",
  "Life",
  "Medical",
  "CPM",
  "Money",
  "PVT",
  "Bond",
  "Aviation",
  "Marine_Hull",
  "Other",
];

const KEFLA_AGER_BRANCHES = [
  "Humera Branch",
  "Gambella Branch",
  "Jigjiga Branch",
  "Asosa Branch",
  "Semera Branch",
  "Mizan Aman Branch",
  "Chero Branch",
  "Bonga Branch",
  "Metu Branch",
  "Gimbi Branch",
  "Denbidollo Branch",
  "Gelemso Branch",
  "Harrar Branch",
  "Moyale Branch",
];

const DISTRICT_OFFICES = [
  "Central Addis District",
  "Northern Addis District",
  "Western Addis District",
  "Southern Addis District",
  "Eastern Addis District",
  "Mekelle District",
  "Adama District",
  "Hawassa District",
  "Nekemte District",
  "Jimma District",
  "Dire Dawa District",
  "Bahir Dar District",
  "Arada District",
];

/** New Claim — Branch (Kefla Ager) */
const CLAIM_REGISTRATION_FIELDS = [
  {
    key: "claim_reference",
    label: "Claim Reference",
    type: "text",
  },
  {
    key: "notification_received_date",
    label: "Notification Received Date",
    type: "date",
  },
  {
    key: "district_branch_name",
    label: "Branch Name",
    type: "select",
    options: KEFLA_AGER_BRANCHES,
  },
  {
    key: "class_of_business",
    label: "Class of Business / Insurance Type",
    type: "select",
    options: CLASS_OF_BUSINESS_OPTIONS,
  },
  {
    key: "plate_number",
    label: "Plate Number (Motor only)",
    type: "text",
    showWhen: { key: "class_of_business", value: "Motor" },
  },
  {
    key: "insured_name",
    label: "Insured Name",
    type: "text",
  },
  {
    key: "review_date",
    label: "Review Date",
    type: "date",
  },
  {
    key: "correction_comments",
    label: "Comments",
    type: "textarea",
    placeholder: "Notes or corrections after return...",
  },
];

/** Claim for Approval — District office */
const APPROVAL_CASE_REGISTRATION_FIELDS = [
  {
    key: "claim_reference",
    label: "Claim Reference",
    type: "text",
  },
  {
    key: "notification_received_date",
    label: "Notification Received Date",
    type: "date",
  },
  {
    key: "district_branch_name",
    label: "District Office",
    type: "select",
    options: DISTRICT_OFFICES,
  },
  {
    key: "class_of_business",
    label: "Class of Business / Insurance Type",
    type: "select",
    options: CLASS_OF_BUSINESS_OPTIONS,
  },
  {
    key: "plate_number",
    label: "Plate Number (Motor only)",
    type: "text",
    showWhen: { key: "class_of_business", value: "Motor" },
  },
  {
    key: "insured_name",
    label: "Insured Name",
    type: "text",
  },
  {
    key: "is_subrogation",
    label: "Subrogation",
    type: "yesno",
  },
  {
    key: "is_recovery",
    label: "Third Party Recovery",
    type: "yesno",
  },
  {
    key: "is_reinsurance",
    label: "Reinsurance",
    type: "yesno",
  },
  {
    key: "review_date",
    label: "Review Date",
    type: "date",
  },
  {
    key: "correction_comments",
    label: "Comments",
    type: "textarea",
    placeholder: "Notes or corrections after return...",
  },
];

export const STAGE_FIELD_CONFIG = {
  "Claim Receipt & Registration": CLAIM_REGISTRATION_FIELDS,

  "Approval Case Registration": APPROVAL_CASE_REGISTRATION_FIELDS,

  "Survey & Damage Assessment Request": [
    { key: "towed_to_rtc_date", label: "Towed to RTC Date", type: "date" },
    {
      key: "internal_survey_request",
      label: "Internal Survey Requested",
      type: "yesno",
    },
    {
      key: "internal_survey_date",
      label: "Internal Survey Request Date",
      type: "date",
    },
    {
      key: "damage_assessment_request_date",
      label: "Damage Assessment Request Date (RTC)",
      type: "date",
    },
  ],

  "Survey & Damage Assessment Review": [
    { key: "review_notes", label: "Review Notes", type: "textarea" },
    { key: "review_date", label: "Review Date", type: "date" },
  ],

  "Bid / Tender Process": [
    {
      key: "bid_participants",
      label: "Garages / Dealers / Suppliers Invited",
      type: "multitext",
      placeholder: "One name per line",
    },
    { key: "bid_opening_date", label: "Bid Opening Date", type: "date" },
    {
      key: "bid_status",
      label: "Bid Processing Status",
      type: "select",
      options: ["In Progress", "Agreed", "Not Agreed"],
    },
    {
      key: "rebid_or_independent_assessment",
      label: "Re-bid / Independent Assessment",
      type: "yesno",
    },
    { key: "rebid_reason", label: "Reason (if Yes above)", type: "textarea" },
  ],

  Decision: [
    {
      key: "decision_type",
      label: "Decision Type",
      type: "select",
      options: ["Total_Loss", "Repair", "Less_Salvage", "Cash_Option"],
    },
    { key: "decision_remark", label: "Remark", type: "textarea" },
  ],

  "Work Order / Payment Authorization": [
    {
      key: "work_order_date",
      label: "Work Order / Authorization Date",
      type: "date",
    },
    {
      key: "work_order_amount",
      label: "Authorized Amount (ETB)",
      type: "currency",
    },
  ],

  "Repair Execution & Quality Check": [
    {
      key: "repair_approval_survey_date",
      label: "Repair-Approval Survey Date",
      type: "date",
    },
    {
      key: "satisfaction_confirmation",
      label: "Satisfaction Confirmation",
      type: "yesno",
    },
    { key: "satisfaction_date", label: "Satisfaction Date", type: "date" },
  ],

  "Discharge & Payment Preparation": [
    {
      key: "payee",
      label: "Payee",
      type: "select",
      options: ["Garage", "Dealer", "Insured"],
    },
    {
      key: "final_payment_amount",
      label: "Final Payment Amount (ETB)",
      type: "currency",
    },
    { key: "payment_date", label: "Payment Date", type: "date" },
    {
      key: "total_loss_checklist",
      label: "Total-Loss Document Checklist Verified",
      type: "checklist",
      options: [
        "Ownership documents",
        "Police report",
        "Salvage handover",
        "Satisfaction note",
      ],
    },
  ],

  "Discharge & Payment Approval": [
    { key: "approval_remark", label: "Approval Remark", type: "textarea" },
  ],

  Closure: [
    {
      key: "final_status_remark",
      label: "Final Status / Remark",
      type: "textarea",
    },
    { key: "claim_closed_date", label: "Claim Closed Date", type: "date" },
  ],

  "Approval Review": [
    {
      key: "review_remark",
      label: "Review / Approval Remark",
      type: "textarea",
    },
  ],

  "Approval Case Closure": [
    {
      key: "final_status_remark",
      label: "Final Status / Remark",
      type: "textarea",
    },
    { key: "claim_closed_date", label: "Claim Closed Date", type: "date" },
  ],
};

/**
 * @param {string} stageName
 * @returns {Array}
 */
export function getStageFields(stageName) {
  return STAGE_FIELD_CONFIG[stageName] || [];
}

/**
 * Fields visible for the current form values (respects showWhen).
 * @param {string} stageName
 * @param {Record<string, unknown>} value
 */
export function getVisibleStageFields(stageName, value = {}) {
  return getStageFields(stageName).filter((f) => {
    if (!f.showWhen) return true;
    return value?.[f.showWhen.key] === f.showWhen.value;
  });
}
