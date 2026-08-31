// Role-specific registration fields per insurance type.
// When a user works on a workflow stage, they fill in these fields
// which are stored in ClaimActivity.registration_data.

/**
 * @typedef {Object} RegistrationField
 * @property {string} key
 * @property {string} label
 * @property {"date" | "text" | "select" | "textarea" | "number"} type
 * @property {boolean} [required]
 * @property {string[]} [options]
 */

/**
 * @typedef {Record<string, RegistrationField[]>} RoleFieldSet
 */

/** @type {Record<string, RoleFieldSet>} */
export const REGISTRATION_FIELDS = {
  surveyor: {
    default: [
      {
        key: "survey_date",
        label: "Survey Date",
        type: "date",
        required: true,
      },
      {
        key: "survey_location",
        label: "Survey Location",
        type: "text",
        required: true,
      },
      {
        key: "damage_severity",
        label: "Damage Severity",
        type: "select",
        options: ["Minor", "Moderate", "Severe", "Total Loss"],
        required: true,
      },
      {
        key: "survey_findings",
        label: "Survey Findings",
        type: "textarea",
        required: true,
      },
      {
        key: "repair_recommendation",
        label: "Repair Recommendation",
        type: "textarea",
      },
      {
        key: "estimated_repair_cost",
        label: "Estimated Repair Cost (ETB)",
        type: "number",
      },
      { key: "salvage_value", label: "Salvage Value (ETB)", type: "number" },
    ],
  },

  claim_manager: {
    default: [
      {
        key: "tender_analysis_date",
        label: "Tender Analysis Date",
        type: "date",
        required: true,
      },
      {
        key: "selected_garage",
        label: "Selected Garage / Vendor",
        type: "text",
      },
      { key: "work_order_number", label: "Work Order Number", type: "text" },
      {
        key: "approved_amount",
        label: "Approved Amount (ETB)",
        type: "number",
        required: true,
      },
      {
        key: "settlement_recommendation",
        label: "Settlement Recommendation",
        type: "textarea",
      },
    ],
  },

  principal_claim_officer: {
    default: [
      {
        key: "review_date",
        label: "Review Date",
        type: "date",
        required: true,
      },
      {
        key: "review_findings",
        label: "Review Findings",
        type: "textarea",
        required: true,
      },
      {
        key: "recommended_settlement",
        label: "Recommended Settlement (ETB)",
        type: "number",
        required: true,
      },
      { key: "payment_account", label: "Payment Account Number", type: "text" },
      { key: "payment_reference", label: "Payment Reference", type: "text" },
    ],
  },
};

/**
 * @param {string} role
 * @param {string} insuranceType
 * @returns {RegistrationField[]}
 */
export function getRegistrationFields(role, insuranceType) {
  const roleFields = REGISTRATION_FIELDS[role];
  if (!roleFields) return [];
  return roleFields[insuranceType] || roleFields.default || [];
}
