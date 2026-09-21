import moment from "moment";

export const ROLE_LABELS = {
  admin: "System Administrator",
  ceo: "Chief Executive Officer",
  chief_of_gio: "Chief of GIO (Deputy CEO)",
  senior_director: "Senior Director (GIO)",
  director: "Director (Shared: GIO & Claim Division)",
  gio_claim_manager: "GIO Claim Manager",
  claim_manager: "Claim Manager",
  gio_principal_claim_officer: "GIO Claim Principal",
  principal_claim_officer: "Principal of Claim",
  claim_adjuster: "Claim Adjuster",
  surveyor: "Surveyor",
  secretary: "Secretary",
};

export const ROLE_HIERARCHY = [
  "secretary",
  "surveyor",
  "claim_adjuster",
  "gio_principal_claim_officer",
  "principal_claim_officer",
  "claim_manager",
  "gio_claim_manager",
  "director",
  "senior_director",
  "chief_of_gio",
  "ceo",
];

export const APPROVAL_ROLES = [
  "principal_claim_officer",
  "claim_manager",
  "gio_claim_manager",
  "director",
  "senior_director",
  "chief_of_gio",
  "ceo",
];

export const APPROVER_ROLE_MAP = {
  "Principal of Claim": "principal_claim_officer",
  "Claim Manager": "claim_manager",
  "GIO Claim Manager": "gio_claim_manager",
  "GIO Claim Principal": "gio_principal_claim_officer",
  Director: "director",
  "Senior Director": "senior_director",
  "Chief of GIO": "chief_of_gio",
  CEO: "ceo",
};

export const ROLE_TO_APPROVER_LABEL = {
  principal_claim_officer: "Principal of Claim",
  claim_manager: "Claim Manager",
  gio_claim_manager: "GIO Claim Manager",
  gio_principal_claim_officer: "GIO Claim Principal",
  director: "Director",
  senior_director: "Senior Director",
  chief_of_gio: "Chief of GIO",
  ceo: "CEO",
};

// Normalizes a stage name for comparison — trims stray whitespace.
export function normalizeStageName(name) {
  return (name || "").trim().replace(/\s+/g, " ");
}

export const CLAIM_DIVISION_APPROVAL_TIER = [
  { stage_name: "Payment Review and approve", role: "claim_manager" },
  { stage_name: "Director Approval", role: "director" },
  { stage_name: "Payment Document Approval", role: "director" },
];

// GIO approval tier, in order — four decision points, each can
// finalize or forward to the next level up.
export const GIO_APPROVAL_TIER = [
  { stage_name: "GIO Claim Manager Review", role: "gio_claim_manager" },
  { stage_name: "Director Decision", role: "director" },
  { stage_name: "Senior Director Decision", role: "senior_director" },
  { stage_name: "Chief of GIO Approval", role: "chief_of_gio" },
  { stage_name: "CEO Decision", role: "ceo" },
];
export function findTierEntry(tierList, stageName) {
  const n = normalizeStageName(stageName);
  return tierList.find((t) => normalizeStageName(t.stage_name) === n);
}

export function isLastTierStage(tierList, stageName) {
  const n = normalizeStageName(stageName);
  const idx = tierList.findIndex((t) => normalizeStageName(t.stage_name) === n);
  return idx === -1 || idx === tierList.length - 1;
}

// The tier stage that comes after the given one — used to label the
// "Forward to X" button with the correct next role.
export function nextTierEntry(tierList, stageName) {
  const n = normalizeStageName(stageName);
  const idx = tierList.findIndex((t) => normalizeStageName(t.stage_name) === n);
  if (idx === -1 || idx === tierList.length - 1) return null;
  return tierList[idx + 1];
}

// ==================== STATUS COLORS ====================

// Claim Division status → color/badge tone
export const CLAIM_DIVISION_STATUS_COLORS = {
  Claim_Registered: "bg-blue-100 text-blue-700",
  Pending_Assignment: "bg-amber-100 text-amber-700",
  Assigned_to_Claim_Adjuster: "bg-blue-100 text-blue-700",
  Survey_in_Progress: "bg-blue-100 text-blue-700",
  Bid_Tender_in_Progress: "bg-indigo-100 text-indigo-700",
  Decision_Pending: "bg-amber-100 text-amber-700",
  Work_Order_Pending: "bg-amber-100 text-amber-700",
  Work_Order_Approved: "bg-emerald-100 text-emerald-700",
  Payment_Preparation: "bg-blue-100 text-blue-700",
  Payment_Approved: "bg-emerald-100 text-emerald-700",
  Claim_Closed: "bg-emerald-100 text-emerald-700",

  // keep if still used by return / entry
  Returned_for_Correction: "bg-orange-100 text-orange-700",
  Notification_Received: "bg-gray-100 text-gray-700",
};

// GIO case status → color/badge tone
export const GIO_STATUS_COLORS = {
  Case_Received: "bg-gray-100 text-gray-700",
  Pending_GIO_Assignment: "bg-amber-100 text-amber-700",
  Director_Assignment_Pending: "bg-amber-100 text-amber-700",
  Manager_Assignment_Pending: "bg-amber-100 text-amber-700",
  Assigned_to_GIO_Principal: "bg-blue-100 text-blue-700",
  Document_Review_Pending: "bg-amber-100 text-amber-700",
  GIO_Review_In_Progress: "bg-blue-100 text-blue-700",
  Claim_Manager_Review_Pending: "bg-amber-100 text-amber-700",
  Director_Decision_Pending: "bg-amber-100 text-amber-700",
  Senior_Director_Decision_Pending: "bg-amber-100 text-amber-700",
  Chief_of_GIO_Approval_Pending: "bg-amber-100 text-amber-700",
  CEO_Approval_Pending: "bg-amber-100 text-amber-700",
  Returned_to_Originating_Office: "bg-orange-100 text-orange-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Closed: "bg-emerald-100 text-emerald-700",
};

// Shared/legacy statuses still used by draft-save and info-request flows
export const LEGACY_STATUS_COLORS = {
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-700",
  Additional_Info_Requested: "bg-cyan-100 text-cyan-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

// Merged lookup — use this anywhere a claim's status badge is rendered,
// regardless of workflow_type, since claim.status is a single field.
export const STATUS_COLORS = {
  ...LEGACY_STATUS_COLORS,
  ...CLAIM_DIVISION_STATUS_COLORS,
  ...GIO_STATUS_COLORS,
};

export const CLAIM_DIVISION_STATUS_LIST = Object.keys(
  CLAIM_DIVISION_STATUS_COLORS,
);
export const GIO_STATUS_LIST = Object.keys(GIO_STATUS_COLORS);

// ==================== END STATUS COLORS ====================

export const PRIORITY_COLORS = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-blue-100 text-blue-600",
  High: "bg-orange-100 text-orange-600",
  Urgent: "bg-red-100 text-red-600",
};

export const INSURANCE_TYPES = [
  "Motor",
  "Fire",
  "Marine",
  "Engineering",
  "Liability",
  "Agriculture",
  "Life",
  "Health",
  "GPA",
  "CPM",
  "WC",
  "PVT",
  "Money",
  "Bond",
  "Other",
];

// Head Office is the work location; GIO is the parent department; Claim Division sits under GIO
export const DEPARTMENTS = ["GIO", "Claim Division"]; // display-only, keep for existing filter UIs

// Prisma enum-safe versions — use these for any <Select> whose value gets sent to the backend
export const DEPARTMENT_OPTIONS = [
  { value: "GIO", label: "GIO" },
  { value: "Claim_Division", label: "Claim Division" },
];

export const WORK_LOCATION_TYPES = ["Head Office"]; // display-only

export const WORK_LOCATION_TYPE_OPTIONS = [
  { value: "Head_Office", label: "Head Office" },
];

export const BRANCH_OFFICES = [
  "Addis Ababa Main Branch",
  "Bole Branch",
  "Merkato Branch",
  "Arat Kilo Branch",
  "Mekanisa Branch",
  "Saris Branch",
  "Lideta Branch",
  "Nifas Silk Branch",
  "Akaki Branch",
  "Kolfe Branch",
  "Bahir Dar Branch",
  "Gondar Branch",
  "Dessie Branch",
  "Mekelle Branch",
  "Adama Branch",
  "Jimma Branch",
  "Hawassa Branch",
  "Dire Dawa Branch",
  "Harar Branch",
  "Jigjiga Branch",
  "Assosa Branch",
  "Gambela Branch",
  "Semera Branch",
  "Arbaminch Branch",
  "Wolaita Sodo Branch",
  "Hossana Branch",
  "Debre Markos Branch",
  "Debre Berhan Branch",
  "Shashemene Branch",
  "Nekemte Branch",
  "Gore Branch",
  "Bedelle Branch",
  "Asela Branch",
  "Adigrat Branch",
  "Axum Branch",
  "Shire Branch",
  "Woldia Branch",
  "Debre Tabor Branch",
];

export const DISTRICT_OFFICES = [
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

export const FORWARDING_OFFICE_TYPES = [
  "Service Center",
  "District Office",
  "Kefla Ager Branch",
]; // display-only

export const ORIGINATING_OFFICE_TYPE_OPTIONS = [
  { value: "Service_Center", label: "Service Center" },
  { value: "District_Office", label: "District Office" },
  { value: "Kefla_Ager_Branch", label: "Kefla Ager Branch" },
  { value: "Head_Office", label: "Head Office" },
];

// Kefla Ager (border-area) branches — remote/border-area branches forwarding claims to Head Office
// Kefla Ager / remote & border-area branches (unique, full set)
export const KEFLA_AGER_BRANCHES = [
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

// Motor insurance cover types
export const MOTOR_COVER_TYPES = [
  "Comprehensive",
  "Third Party",
  "Third Party Fire & Theft",
  "Comprehensive - Commercial",
  "Third Party - Commercial",
];

// Converts a spaced display label into a Prisma enum key
// e.g. "Kefla Ager Branch" -> "Kefla_Ager_Branch"
export function toEnumKey(label) {
  return typeof label === "string" ? label.trim().replace(/\s+/g, "_") : label;
}

export function canSubmitClaims(role) {
  return ["secretary", "principal_claim_officer", "admin"].includes(role);
}

export function canRegisterClaims(role) {
  return ["secretary", "claim_adjuster", "admin"].includes(role);
}

export function canApproveClaims(role) {
  return [
    "principal_claim_officer",
    "claim_manager",
    "gio_claim_manager",
    "director",
    "senior_director",
    "chief_of_gio",
    "ceo",
    "admin",
  ].includes(role);
}

export function canConfigureSystem(role) {
  return role === "admin";
}

// eslint-disable-next-line no-unused-vars
export function canTrackWorkflow(role) {
  return true;
}

export function canManageGarages(role) {
  return ["claim_adjuster", "admin"].includes(role);
}

export function canViewGarages(role) {
  return [
    "claim_adjuster",
    "surveyor",
    "principal_claim_officer",
    "claim_manager",
    "director",
    "admin",
  ].includes(role);
  // no gio_claim_adjuster / gio_claim_manager / chief_of_gio
}

export function canViewMyClaims(role) {
  return (
    canRegisterClaims(role) ||
    [
      "surveyor",
      "claim_adjuster",
      "gio_claim_adjuster",
      "principal_claim_officer",
    ].includes(role)
  );
}

export function canViewAllClaims(role) {
  return (
    canApproveClaims(role) || canConfigureSystem(role) || role === "surveyor"
  );
}

export function canRegisterGioCases(role) {
  return ["secretary", "gio_principal_claim_officer", "admin"].includes(role);
}

export const AUDIT_FULL_ROLES = ["admin"];
export const AUDIT_OVERSIGHT_ROLES = [
  "ceo",
  "chief_of_gio",
  "senior_director",
  "director",
];

export function canViewAudit(role) {
  return [...AUDIT_FULL_ROLES, ...AUDIT_OVERSIGHT_ROLES].includes(role);
}
export function canExportAudit(role) {
  return role === "admin";
}
export function isAuditAdmin(role) {
  return role === "admin";
}

export function canActOnGioCases(role) {
  return [
    "secretary",
    "gio_principal_claim_officer",
    "gio_claim_manager",
    "director",
    "senior_director",
    "chief_of_gio",
    "ceo",
    "admin",
  ].includes(role);
}

/** Higher GIO role may act on a stage owned by a lower role. */
export function canActOnGioStage(actorRole, stageRole) {
  if (!actorRole) return false;
  if (actorRole === "admin") return true;
  if (!stageRole) return false;
  if (!canActOnGioCases(actorRole)) return false;
  if (actorRole === stageRole) return true;
  const a = ROLE_HIERARCHY.indexOf(actorRole);
  const s = ROLE_HIERARCHY.indexOf(stageRole);
  return a > -1 && s > -1 && a > s;
}

// Operational roles work on claim stages (register data, complete stages, flow to next role)
export const OPERATIONAL_ROLES = [
  "secretary",
  "surveyor",
  "claim_adjuster",
  "gio_principal_claim_officer",
  "claim_manager",
  "gio_claim_manager",
  "principal_claim_officer",
];

export function isOperationalRole(role) {
  return OPERATIONAL_ROLES.includes(role);
}

// Approval roles can approve/reject/escalate claims in the hierarchical chain
export function isApprovalRole(role) {
  return canApproveClaims(role);
}

// Returns the stages visible to a given role: only their own stages + already-completed stages + the next pending stage
export function getVisibleStagesForRole(allStages, activities, userRole) {
  if (userRole === "admin") return allStages;
  const completedStageNames = new Set(
    activities.filter((a) => a.status === "Completed").map((a) => a.stage_name),
  );
  const myStages = allStages.filter((s) => s.responsible_role === userRole);
  const myStageOrders = new Set(myStages.map((s) => s.stage_order));

  // Find the next pending stage after the last completed one
  const maxCompletedOrder = Math.max(
    0,
    ...allStages
      .filter((s) => completedStageNames.has(s.stage_name))
      .map((s) => s.stage_order),
  );
  const nextPending = allStages.find(
    (s) =>
      s.stage_order > maxCompletedOrder &&
      !completedStageNames.has(s.stage_name),
  );

  return allStages.filter(
    (s) =>
      myStageOrders.has(s.stage_order) ||
      completedStageNames.has(s.stage_name) ||
      (nextPending && s.stage_order === nextPending.stage_order),
  );
}

// eslint-disable-next-line no-unused-vars
export function canSearchClaims(role) {
  return true;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(amount);
}

export const WORKFLOW_SCOPE_BY_ROLE = {
  admin: "all",
  secretary: "all",
  director: "all",
  senior_director: "all",
  ceo: "all",
  surveyor: "Claim_Division",
  claim_adjuster: "Claim_Division",
  principal_claim_officer: "Claim_Division",
  claim_manager: "Claim_Division",
  gio_claim_adjuster: "GIO_Approval",
  gio_claim_manager: "GIO_Approval",
  chief_of_gio: "GIO_Approval",
};

export const CLAIM_DIVISION_ROLES = [
  "secretary",
  "surveyor",
  "claim_adjuster",
  "principal_claim_officer",
  "claim_manager",
  "director", // shared
];

/** Roles that appear on GIO workflow / audit filters */
export const GIO_ROLES = [
  "secretary",
  "gio_principal_claim_officer",
  "gio_claim_manager",
  "director",
  "senior_director",
  "chief_of_gio",
  "ceo",
];

export const MOTOR_VEHICLE_TYPES = [
  "Electric",
  "Conventional",
  "Hybrid",
  "Private Car",
  "Commercial Vehicle",
  "Truck",
  "Pickup",
  "Bus",
  "Motorcycle",
  "Taxi",
  "Three-Wheeler",
  "Special Purpose Vehicle",
  "Other",
];

/**
 * Roles to show in a filter dropdown for a workflow stream.
 * @param {"Claim_Division"|"GIO_Approval"|"all"} stream
 */
export function getRolesForWorkflowStream(stream) {
  if (stream === "GIO_Approval") return GIO_ROLES;
  if (stream === "Claim_Division") return CLAIM_DIVISION_ROLES;
  return Object.keys(ROLE_LABELS);
}

export function getWorkflowScopeForRole(role) {
  return WORKFLOW_SCOPE_BY_ROLE[role] || "all";
}

// ============ OPERATION 1: Claim Division New Claim Notification (Kefla Ager Branch) ============
export const WORKFLOW_STAGES = [
  {
    stage_name: "Claim Receipt & Registration",
    stage_order: 1,
    responsible_role: "secretary",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Register and manage incoming claim notifications and related claim information.",
  },
  {
    stage_name: "Claim Review & Assignment",
    stage_order: 2,
    responsible_role: "claim_manager",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Claim Manager assigns the registered claim to the appropriate Principal of Claim.",
  },
  {
    stage_name: "Principal Assignment to Adjuster",
    stage_order: 3,
    responsible_role: "principal_claim_officer",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Assigned Principal of Claim allocates the claim to one of the Claim Adjusters within their team.",
  },
  {
    stage_name: "Survey & Damage Assessment Request",
    stage_order: 4,
    responsible_role: "claim_adjuster",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Date towed to RTC; internal survey request (Yes/No + date); damage assessment request at RTC (date).",
  },
  {
    stage_name: "Survey & Damage Assessment Review",
    stage_order: 5,
    responsible_role: "principal_claim_officer",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Principal of Claim reviews the survey and damage assessment submitted by the Adjuster.",
  },
  {
    stage_name: "Bid / Tender Process",
    stage_order: 6,
    responsible_role: "principal_claim_officer",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    applicable_insurance_types: ["Motor"],
    description:
      "Garages/dealers/suppliers invited to bid; bid opening date; re-bid or independent-assessment flag.",
  },
  {
    stage_name: "Decision",
    stage_order: 7,
    responsible_role: "claim_manager", // entry role — escalates via ESCALATION_CHAINS
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Decision type: Total Loss / Repair / Less Salvage / Cash Option. Manager may finalize or forward to Director.",
  },
  {
    stage_name: "Work Order / Payment Authorization",
    stage_order: 8,
    responsible_role: "claim_manager",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Work order or payment authorization for the approved option. Escalates Manager → Director → Senior Director → CEO as needed.",
  },
  {
    stage_name: "Repair Execution & Quality Check",
    stage_order: 9,
    responsible_role: "principal_claim_officer",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Repair-approval survey date; satisfaction confirmation (Yes/No + date).",
  },
  {
    stage_name: "Discharge & Payment Preparation",
    stage_order: 10,
    responsible_role: "principal_claim_officer",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Payee, final payment amount, payment date; total-loss document checklist if applicable.",
  },
  {
    stage_name: "Discharge & Payment Approval",
    stage_order: 11,
    responsible_role: "claim_manager",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Discharge and payment approval. Escalates Manager → Director as needed.",
  },
  {
    stage_name: "Closure",
    stage_order: 12,
    responsible_role: "claim_manager",
    department: "Claim Division",
    applicable_office_types: ["Kefla_Ager_Branch"],
    description:
      "Final status/remark; claim closed date. Escalates Manager → Director as needed.",
  },
];

// ============ OPERATION 2: Claim for Approval (District/Branch) ============
export const CLAIM_APPROVAL_STAGES = [
  {
    stage_name: "Approval Case Registration",
    stage_order: 1,
    responsible_role: "secretary",
    department: "Claim Division",
    applicable_office_types: ["District_Office"],
    description:
      "Claim file received from District/Branch. Notification received date; district/branch name; class of business; insured name; plate number (motor); claim number; subrogation/recovery/reinsurance flag.",
  },
  {
    stage_name: "Approval Review",
    stage_order: 2,
    responsible_role: "director",
    department: "Claim Division",
    applicable_office_types: ["District_Office"],
    description: "Escalates Director → Senior Director → CEO as needed.",
  },
  {
    stage_name: "Approval Case Closure",
    stage_order: 3,
    responsible_role: "secretary",
    department: "Claim Division",
    applicable_office_types: ["District_Office"],
    description: "Secretary closes the case.",
  },
];

export const GIO_WORKFLOW_STAGES = [
  {
    stage_name: "GIO Case Registration",
    stage_order: 1,
    responsible_role: "secretary",
    department: "GIO",
    description: "Secretary registers the GIO case",
  },
  {
    stage_name: "Director Assignment",
    stage_order: 2,
    responsible_role: "director",
    department: "GIO",
    description: "Director assigns GIO Claim Manager",
  },
  {
    stage_name: "Manager Assignment",
    stage_order: 3,
    responsible_role: "gio_claim_manager",
    department: "GIO",
    description: "Manager assigns GIO Claim Principal",
  },
  {
    stage_name: "GIO Case Work",
    stage_order: 4,
    responsible_role: "gio_principal_claim_officer",
    department: "GIO",
    description: "GIO Claim Principal works the case",
  },
  {
    stage_name: "GIO Claim Manager Review",
    stage_order: 5,
    responsible_role: "gio_claim_manager",
    department: "GIO",
    description: "Manager may finalize within authority or forward",
  },
  {
    stage_name: "Director Decision",
    stage_order: 6,
    responsible_role: "director",
    department: "GIO",
    description: "Director may finalize or forward",
  },
  {
    stage_name: "Senior Director Decision",
    stage_order: 7,
    responsible_role: "senior_director",
    department: "GIO",
    description: "Senior Director may finalize or forward",
  },
  {
    stage_name: "Chief of GIO Approval",
    stage_order: 8,
    responsible_role: "chief_of_gio",
    department: "GIO",
    description: "Chief of GIO may finalize or forward",
  },
  {
    stage_name: "CEO Decision",
    stage_order: 9,
    responsible_role: "ceo",
    department: "GIO",
    description: "CEO decision when required",
  },
  {
    stage_name: "GIO Case Closure",
    stage_order: 10,
    responsible_role: "secretary",
    department: "GIO",
    description: "Secretary closes the case",
  },
];

export const ESCALATION_CHAINS = {
  Decision: ["claim_manager", "director"],
  "Work Order / Payment Authorization": [
    "claim_manager",
    "director",
    "senior_director",
    "ceo",
  ],
  "Discharge & Payment Approval": ["claim_manager", "director"],
  Closure: ["claim_manager", "director"],
  "Approval Review": ["director", "senior_director", "ceo"],
};

export function getEscalationChain(stageName) {
  return ESCALATION_CHAINS[stageName] || null;
}

export function isEscalationStage(stageName) {
  return !!ESCALATION_CHAINS[stageName];
}

export function currentRoleForActivity(stage, activity) {
  if (activity?.responsible_role && isEscalationStage(stage.stage_name)) {
    return activity.responsible_role;
  }
  return stage.responsible_role;
}

export function isLastInChain(stageName, role) {
  const chain = getEscalationChain(stageName);
  if (!chain) return true;
  const idx = chain.indexOf(role);
  return idx === -1 || idx === chain.length - 1;
}

export function nextRoleInChain(stageName, role) {
  const chain = getEscalationChain(stageName);
  if (!chain) return null;
  const idx = chain.indexOf(role);
  if (idx === -1 || idx === chain.length - 1) return null;
  return chain[idx + 1];
}

export function getStageLabel(stageName) {
  return stageName || "";
}
export function getStageDescription(stageName) {
  const all = [...WORKFLOW_STAGES, ...CLAIM_APPROVAL_STAGES];
  return all.find((s) => s.stage_name === stageName)?.description || "";
}

export const ACTIVITY_STATUS_COLORS = {
  Pending: "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Skipped: "bg-slate-100 text-slate-500",
  "On Hold": "bg-amber-100 text-amber-700",
};

export const GARAGE_STATUS_COLORS = {
  "Proforma Requested": "bg-gray-100 text-gray-700",
  "Proforma Received": "bg-blue-100 text-blue-700",
  "Tender Under Review": "bg-amber-100 text-amber-700",
  "Work Order Issued": "bg-indigo-100 text-indigo-700",
  "Repair In Progress": "bg-purple-100 text-purple-700",
  "Repair Completed": "bg-emerald-100 text-emerald-700",
  "Survey After Repair": "bg-cyan-100 text-cyan-700",
  "Invoice Settled": "bg-teal-100 text-teal-700",
};

export function getClaimAging(claim) {
  if (!claim.submission_date) return 0;
  return moment().diff(moment(claim.submission_date), "days");
}

export function isClaimOverdue(claim) {
  const aging = getClaimAging(claim);
  const thresholds = { Low: 30, Medium: 21, High: 14, Urgent: 7 };
  return (
    aging > (thresholds[claim.priority] || 21) &&
    !["Approved", "Rejected"].includes(claim.status)
  );
}

export const GIO_CASE_REASONS = [
  { value: "Standard_Claim_Approval", label: "Standard Claim Approval" },
  { value: "Work_Order_Approval", label: "Work Order Approval" },
  { value: "Additional_WO_Approval", label: "Additional WO Approval" },
  { value: "Claim_Within_15_Days_Case", label: "Claim Within 15 Days Case" },
  { value: "Repair_Approval", label: "Repair Approval" },
  { value: "Total_Loss_Approval", label: "Total Loss Approval" },
  { value: "Additional_Repair_Approval", label: "Additional Repair Approval" },
  { value: "Payment_Approval", label: "Payment Approval" },
  {
    value: "Direct_Cash_Payment_Approval",
    label: "Direct Cash Payment Approval",
  },
  { value: "Vendor_Payment_Approval", label: "Vendor Payment Approval" },
  { value: "Legal_Expense_Approval", label: "Legal Expense Approval" },
  { value: "Advice_Request", label: "Advice Request" },
  { value: "Legal_Advice", label: "Legal Advice" },
  { value: "Technical_Advice", label: "Technical Advice" },
  {
    value: "Third_Party_Recovery_Advice",
    label: "Third-Party Recovery Advice",
  },
  { value: "Cash_Option_Approval", label: "Cash Option Approval" },
  { value: "Less_Salvage_Verification", label: "Less Salvage Verification" },
  { value: "Ex_gratia_Claim_Approval", label: "Ex-gratia Claim Approval" },
  {
    value: "Customer_Complaint_Handling",
    label: "Customer Complaint Handling",
  },
  { value: "Other_Management_Decisions", label: "Other Management Decisions" },
];

// Service Centers
export const SERVICE_CENTERS = [
  "Government Service Center",
  "Public Enterprise Service Center",
  "Premium Service Center",
];

// Map forwarding office type to its list of offices
export const FORWARDING_OFFICES = {
  "Service Center": SERVICE_CENTERS,
  "District Office": DISTRICT_OFFICES,
  "Kefla Ager Branch": KEFLA_AGER_BRANCHES,
};

// Delegation of Authority limits (ETB) by role and class — per EIC delegation matrix
// Director is shared between GIO and Claim Division
export const DELEGATION_LIMITS = {
  ceo: "Unlimited",
  chief_of_gio: {
    Motor: 10000000,
    Fire: 10000000,
    Marine: 10000000,
    Engineering: 10000000,
    default: 5000000,
  },
  director: {
    Motor: 3000000,
    Fire: 3000000,
    Marine: 1500000,
    Engineering: 1000000,
    default: 1000000,
  },
  gio_claim_manager: {
    Motor: 2000000,
    Fire: 2000000,
    Marine: 1000000,
    Engineering: 750000,
    default: 500000,
  },
  claim_manager: {
    Motor: 2000000,
    Fire: 2000000,
    Marine: 1000000,
    Engineering: 750000,
    default: 500000,
  },
  principal_claim_officer: {
    Motor: 1000000,
    Fire: 1000000,
    Marine: 500000,
    Engineering: 300000,
    default: 250000,
  },
};
