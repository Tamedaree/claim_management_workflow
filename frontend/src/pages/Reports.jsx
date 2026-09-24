import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Sheet,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  MapPin,
  Layers,
  Link2,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import moment from "moment";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  ROLE_LABELS,
  STATUS_COLORS,
  ROLE_HIERARCHY,
  getWorkflowScopeForRole,
} from "@/lib/roleConfig";
import {
  buildGioMonitoring,
  buildGioPerformance,
} from "@/lib/gioReportMetrics";

const PAGE_SIZE = 50;

const CLOSED_STATUSES = new Set([
  "Claim_Closed",
  "Closed",
  "Completed",
  "Approved",
  "Rejected",
]);

const DELAY_DAYS_THRESHOLD = 7;

const REPORT_TYPES = [
  { value: "tracking", label: "Claim Status / Tracking", icon: FileText },
  { value: "tat", label: "Turnaround Time (TAT)", icon: Clock },
  { value: "bottleneck", label: "Bottleneck / Delay (Aging)", icon: Gauge },
  { value: "district", label: "District / Branch Summary", icon: MapPin },
  { value: "class", label: "Class-of-Business Summary", icon: Layers },
  { value: "decision", label: "Decision Outcome", icon: CheckCircle2 },
  { value: "payment", label: "Payment / Disbursement", icon: FileDown },
  { value: "recovery", label: "Subrogation / Recovery-Linked", icon: Link2 },
  { value: "doa", label: "Approval / DoA Compliance", icon: ShieldCheck },
  { value: "pending", label: "Pending Claims", icon: Inbox },
];

function getClaimDate(c) {
  return c.createdAt || c.created_date || c.submission_date || c.date_received;
}

function isClosed(c) {
  if (c.closure_date) return true;
  return CLOSED_STATUSES.has(c.status);
}

function isActive(c) {
  if (isClosed(c)) return false;
  if (c.status === "Draft" || c.status === "Rejected") return false;
  return true;
}

function stageEnteredAt(c) {
  return (
    c.stage_entered_at ||
    c.assignment_date ||
    c.updatedAt ||
    c.updated_at ||
    getClaimDate(c)
  );
}
function daysInCurrentStage(c) {
  const start = stageEnteredAt(c);
  if (!start) return 0;
  return Math.max(0, moment().diff(moment(start), "days"));
}

function isDelayed(c) {
  if (!isActive(c)) return false;
  if (c.due_date && moment().isAfter(moment(c.due_date))) return true;
  return daysInCurrentStage(c) > DELAY_DAYS_THRESHOLD;
}

function periodStart(period) {
  const now = moment();
  switch (period) {
    case "today":
      return now.clone().startOf("day");
    case "7d":
      return now.clone().subtract(7, "days").startOf("day");
    case "30d":
      return now.clone().subtract(30, "days").startOf("day");
    case "90d":
      return now.clone().subtract(90, "days").startOf("day");
    case "month":
      return now.clone().startOf("month");
    case "year":
      return now.clone().startOf("year");
    default:
      return null;
  }
}

function inPeriod(c, period) {
  const start = periodStart(period);
  if (!start) return true;
  const d = getClaimDate(c);
  if (!d) return false;
  return moment(d).isSameOrAfter(start);
}

function sourceBucket(c) {
  const t = c.originating_office_type || "";
  if (t === "Service_Center" || String(t).includes("Service"))
    return "Service Center";
  if (t === "District_Office" || String(t).includes("District"))
    return "District";
  if (t === "Kefla_Ager_Branch" || t === "Border_Branch") return "Branch";
  if (t === "Head_Office") return "Head Office";
  return "Other";
}

function trendKey(date, granularity) {
  const m = moment(date);
  if (granularity === "daily") return m.format("DD MMM");
  if (granularity === "weekly") return `W${m.isoWeek()} ${m.format("YY")}`;
  if (granularity === "yearly") return m.format("YYYY");
  return m.format("MMM YY");
}

function displayPerson(value, nameByEmail = {}) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s.includes("@")) return s;
  return nameByEmail[s.toLowerCase()] || null;
}

export default function Reports() {
  const { user } = useOutletContext();
  const role = user?.role || "claim_adjuster";
  const scope = getWorkflowScopeForRole(role);
  const [claims, setClaims] = useState([]);
  const [activities, setActivities] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [trendGranularity, setTrendGranularity] = useState("monthly");
  const [sortKey, setSortKey] = useState("days");
  const [sortDir, setSortDir] = useState("desc");
  const [nameByEmail, setNameByEmail] = useState({});
  const [page, setPage] = useState(1);
  const [reportType, setReportType] = useState("tracking");
  const [linkFlag, setLinkFlag] = useState("recovery");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [claimsRes, activitiesRes, thresholdsRes] = await Promise.all([
          api.get("/claims"),
          api.get("/claim-activities").catch(() => ({ data: { data: [] } })),
          api.get("/approval-thresholds").catch(() => ({ data: { data: [] } })),
        ]);
        if (!cancelled) {
          setClaims(claimsRes.data?.data || []);
          setActivities(activitiesRes.data?.data || []);
          setThresholds(thresholdsRes.data?.data || []);
        }
      } catch {
        if (!cancelled) setClaims([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    api
      .get("/staff")
      .then((res) => {
        const map = {};
        for (const s of res.data?.data || []) {
          const email = String(s.email || "").toLowerCase();
          const name = [s.first_name, s.middle_name, s.last_name]
            .filter(Boolean)
            .join(" ");
          if (email && name) map[email] = name;
        }
        setNameByEmail(map);
      })
      .catch(() => {});
  }, []);

  const canSwitch = scope === "all";
  const [streamChoice, setStreamChoice] = useState("Claim_Division");
  const stream = canSwitch ? streamChoice : scope;

  const effectiveReportType =
    stream === "GIO_Approval"
      ? reportType === "gio_performance"
        ? "gio_performance"
        : "gio_monitoring"
      : reportType === "gio_monitoring" || reportType === "gio_performance"
        ? "tracking"
        : reportType;

  const streamClaims = useMemo(() => {
    return claims.filter((c) => {
      if (stream === "all") return true;
      return (c.workflow_type || "Claim_Division") === stream;
    });
  }, [claims, stream]);

  const filtered = useMemo(
    () => streamClaims.filter((c) => inPeriod(c, period)),
    [streamClaims, period],
  );

  const gioClaims = useMemo(
    () =>
      filtered.filter(
        (c) => (c.workflow_type || "Claim_Division") === "GIO_Approval",
      ),
    [filtered],
  );

  const gioMonitoring = useMemo(
    () => buildGioMonitoring(gioClaims),
    [gioClaims],
  );

  const gioPerformance = useMemo(
    () => buildGioPerformance(gioClaims),
    [gioClaims],
  );

  const LINK_FLAG_OPTIONS = [
    { value: "recovery", label: "Third party recovery", field: "is_recovery" },
    { value: "subrogation", label: "Subrogation", field: "is_subrogation" },
    { value: "reinsurance", label: "Reinsurance", field: "is_reinsurance" },
  ];

  const linkMeta =
    LINK_FLAG_OPTIONS.find((o) => o.value === linkFlag) || LINK_FLAG_OPTIONS[0];

  const linkYesCount = useMemo(
    () => gioClaims.filter((c) => !!c[linkMeta.field]).length,
    [gioClaims, linkMeta.field],
  );

  const streamClaimIds = useMemo(
    () => new Set(filtered.map((c) => c.id)),
    [filtered],
  );
  const streamActivities = useMemo(
    () => activities.filter((a) => streamClaimIds.has(a.claim_id)),
    [activities, streamClaimIds],
  );

  const totalClaims = filtered.length;
  const activeClaims = filtered.filter(isActive);
  const closedClaims = filtered.filter(isClosed);
  const delayedClaims = filtered.filter(isDelayed);

  const pendingDelayedRows = useMemo(() => {
    const rows = activeClaims.map((c) => {
      const days = daysInCurrentStage(c);
      const ownerName = displayPerson(c.current_owner_name, nameByEmail);
      const roleLabel =
        c.current_approver_role && c.current_approver_role !== "None"
          ? ROLE_LABELS[c.current_approver_role] ||
            String(c.current_approver_role).replace(/_/g, " ")
          : null;

      return {
        id: c.id,
        claim_reference: c.claim_reference,
        insured: c.claimant_name,
        status: c.status,
        stage: c.workflow_stage || "—",
        responsible: ownerName || roleLabel || "—",
        entered: stageEnteredAt(c),
        days,
        delayed: isDelayed(c),
      };
    });

    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "claim") {
        return (
          dir *
          String(a.claim_reference || "").localeCompare(
            String(b.claim_reference || ""),
          )
        );
      }
      if (sortKey === "status") {
        return (
          dir * String(a.status || "").localeCompare(String(b.status || ""))
        );
      }
      return dir * ((a.days || 0) - (b.days || 0));
    });

    return rows;
  }, [activeClaims, sortKey, sortDir, nameByEmail]);

  const trendData = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      const d = getClaimDate(c);
      if (!d) return;
      const key = trendKey(d, trendGranularity);
      if (!map[key])
        map[key] = { label: key, count: 0, sort: moment(d).valueOf() };
      map[key].count += 1;
      map[key].sort = Math.min(map[key].sort, moment(d).valueOf());
    });
    return Object.values(map).sort((a, b) => a.sort - b.sort);
  }, [filtered, trendGranularity]);

  const sourceData = useMemo(() => {
    const buckets = {
      "Service Center": 0,
      District: 0,
      Branch: 0,
      "Head Office": 0,
      Other: 0,
    };
    filtered.forEach((c) => {
      const b = sourceBucket(c);
      buckets[b] = (buckets[b] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([name, count]) => ({ name, count }))
      .filter((d) => d.count > 0);
  }, [filtered]);

  // ---- TAT Report: average days per stage, and per performer ----
  const tatByStage = useMemo(() => {
    const map = {};
    streamActivities.forEach((a) => {
      if (!a.started_at || !a.completed_at) return;
      const stageName = a.stage_name || "Unknown";
      const days = moment(a.completed_at).diff(
        moment(a.started_at),
        "days",
        true,
      );
      if (!map[stageName])
        map[stageName] = { stage: stageName, totalDays: 0, count: 0 };
      map[stageName].totalDays += days;
      map[stageName].count += 1;
    });
    return Object.values(map)
      .map((s) => ({
        stage: s.stage,
        avgDays: Math.round((s.totalDays / s.count) * 10) / 10,
        completedCount: s.count,
      }))
      .sort((a, b) => b.avgDays - a.avgDays);
  }, [streamActivities]);

  const tatByPerformer = useMemo(() => {
    const map = {};
    streamActivities.forEach((a) => {
      if (!a.started_at || !a.completed_at) return;
      const person =
        displayPerson(a.responsible_user_name, nameByEmail) ||
        a.responsible_user_name ||
        "Unassigned";
      const days = moment(a.completed_at).diff(
        moment(a.started_at),
        "days",
        true,
      );
      if (!map[person])
        map[person] = { performer: person, totalDays: 0, count: 0 };
      map[person].totalDays += days;
      map[person].count += 1;
    });
    return Object.values(map)
      .map((p) => ({
        performer: p.performer,
        avgDays: Math.round((p.totalDays / p.count) * 10) / 10,
        stagesCompleted: p.count,
      }))
      .sort((a, b) => b.avgDays - a.avgDays);
  }, [streamActivities, nameByEmail]);

  // ---- Bottleneck / Aging: currently-open stages exceeding SLA ----
  const bottleneckRows = useMemo(() => {
    return streamActivities
      .filter((a) => a.status === "In_Progress" && a.started_at)
      .map((a) => {
        const days = moment().diff(moment(a.started_at), "days");
        const claim = filtered.find((c) => c.id === a.claim_id);
        return {
          id: a.id,
          claim_reference: claim?.claim_reference || a.claim_reference || "—",
          stage: a.stage_name,
          performer:
            displayPerson(a.responsible_user_name, nameByEmail) ||
            a.responsible_user_name ||
            "—",
          department: a.department || "—",
          days,
          exceeded: days > DELAY_DAYS_THRESHOLD,
        };
      })
      .filter((r) => r.exceeded)
      .sort((a, b) => b.days - a.days);
  }, [streamActivities, filtered, nameByEmail]);

  // ---- District / Branch Summary ----
  const districtSummary = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      const office = c.originating_office || "Unspecified";
      if (!map[office]) map[office] = { office, count: 0, totalDays: 0 };
      map[office].count += 1;
      map[office].totalDays += daysInCurrentStage(c);
    });
    return Object.values(map)
      .map((o) => ({
        office: o.office,
        volume: o.count,
        avgTAT: Math.round((o.totalDays / o.count) * 10) / 10,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [filtered]);

  // ---- Class of Business Summary ----
  const classSummary = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      const type = c.insurance_type || "Other";
      if (!map[type]) map[type] = { type, count: 0, closed: 0, amount: 0 };
      map[type].count += 1;
      if (isClosed(c)) map[type].closed += 1;
      map[type].amount += c.claim_amount || 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filtered]);

  // ---- Decision Outcome (needs registration_data.decision_type from StageRegistrationForm) ----
  const decisionRows = useMemo(() => {
    return filtered
      .filter((c) => c.registration_data?.decision_type)
      .map((c) => ({
        claim_reference: c.claim_reference,
        decision: c.registration_data.decision_type,
        amount: c.claim_amount,
      }));
  }, [filtered]);
  const decisionSummary = useMemo(() => {
    const map = {};
    decisionRows.forEach((r) => {
      map[r.decision] = (map[r.decision] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [decisionRows]);

  // ---- Payment / Disbursement (needs registration_data.final_payment_amount) ----
  const paymentRows = useMemo(() => {
    return filtered
      .filter(
        (c) =>
          c.registration_data?.final_payment_amount ||
          c.registration_data?.payee,
      )
      .map((c) => ({
        claim_reference: c.claim_reference,
        payee: c.registration_data?.payee || "—",
        amount: c.registration_data?.final_payment_amount || 0,
        date: c.registration_data?.payment_date,
      }));
  }, [filtered]);

  // ---- Subrogation / Recovery-Linked ----
  const recoveryRows = useMemo(() => {
    return filtered
      .filter((c) => c.is_subrogation || c.is_recovery || c.is_reinsurance)
      .map((c) => ({
        claim_reference: c.claim_reference,
        insured: c.claimant_name,
        type: [
          c.is_subrogation && "Subrogation",
          c.is_recovery && "Recovery",
          c.is_reinsurance && "Reinsurance",
        ]
          .filter(Boolean)
          .join(", "),
        status: c.status,
      }));
  }, [filtered]);

  // ---- Approval / DoA Compliance ----
  const doaRows = useMemo(() => {
    return filtered
      .filter(
        (c) => c.current_approver_role && c.current_approver_role !== "None",
      )
      .map((c) => {
        const match = thresholds.find(
          (t) =>
            (t.insurance_type === c.insurance_type ||
              t.insurance_type === "All") &&
            c.claim_amount >= t.min_amount &&
            c.claim_amount <= t.max_amount,
        );
        if (!match) return null;

        const requiredRole = String(
          match.required_approver_role || "",
        ).toLowerCase();
        const actualRole = String(c.current_approver_role || "").toLowerCase();
        const requiredIdx = ROLE_HIERARCHY.indexOf(requiredRole);
        const actualIdx = ROLE_HIERARCHY.indexOf(actualRole);
        const compliant =
          requiredIdx === -1 || actualIdx === -1 || actualIdx >= requiredIdx;

        return {
          claim_reference: c.claim_reference,
          amount: c.claim_amount,
          requiredRole: match.required_approver_role,
          actualRole: c.current_approver_role,
          compliant,
        };
      })
      .filter(Boolean);
  }, [filtered, thresholds]);
  const doaViolations = doaRows.filter((r) => !r.compliant);

  const totalPages = Math.max(
    1,
    Math.ceil(pendingDelayedRows.length / PAGE_SIZE),
  );
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = pendingDelayedRows.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = pendingDelayedRows.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, pendingDelayedRows.length);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "days" ? "desc" : "asc");
    }
    setPage(1);
  };

  const streamLabel =
    stream === "GIO_Approval"
      ? "GIO Cases"
      : stream === "Claim_Division"
        ? "Claim Division"
        : "All Streams";

  const currentReportLabel =
    effectiveReportType === "gio_monitoring"
      ? "GIO Claim & Approval Monitoring"
      : effectiveReportType === "gio_performance"
        ? "GIO Approval Performance"
        : REPORT_TYPES.find((r) => r.value === effectiveReportType)?.label ||
          "Report";

  // ---- Generic export: builds a table from whatever report is active ----
  function getExportTable() {
    switch (effectiveReportType) {
      case "tat":
        return {
          headers: ["Stage", "Avg Days", "Completed Count"],
          rows: tatByStage.map((s) => [s.stage, s.avgDays, s.completedCount]),
        };
      case "bottleneck":
        return {
          headers: [
            "Claim Ref",
            "Stage",
            "Performer",
            "Department",
            "Days Open",
          ],
          rows: bottleneckRows.map((r) => [
            r.claim_reference,
            r.stage,
            r.performer,
            r.department,
            r.days,
          ]),
        };
      case "district":
        return {
          headers: ["Office", "Volume", "Avg TAT (days)"],
          rows: districtSummary.map((d) => [d.office, d.volume, d.avgTAT]),
        };
      case "class":
        return {
          headers: [
            "Class of Business",
            "Volume",
            "Closed",
            "Total Amount (ETB)",
          ],
          rows: classSummary.map((c) => [c.type, c.count, c.closed, c.amount]),
        };
      case "decision":
        return {
          headers: ["Claim Ref", "Decision", "Amount (ETB)"],
          rows: decisionRows.map((r) => [
            r.claim_reference,
            r.decision,
            r.amount,
          ]),
        };
      case "payment":
        return {
          headers: ["Claim Ref", "Payee", "Amount (ETB)", "Payment Date"],
          rows: paymentRows.map((r) => [
            r.claim_reference,
            r.payee,
            r.amount,
            r.date ? moment(r.date).format("YYYY-MM-DD") : "—",
          ]),
        };
      case "recovery":
        return {
          headers: ["Claim Ref", "Insured", "Type", "Status"],
          rows: recoveryRows.map((r) => [
            r.claim_reference,
            r.insured,
            r.type,
            r.status,
          ]),
        };
      case "doa":
        return {
          headers: [
            "Claim Ref",
            "Amount (ETB)",
            "Required Role",
            "Actual Role",
            "Compliant",
          ],
          rows: doaRows.map((r) => [
            r.claim_reference,
            r.amount,
            String(r.requiredRole).replace(/_/g, " "),
            String(r.actualRole).replace(/_/g, " "),
            r.compliant ? "Yes" : "NO — VIOLATION",
          ]),
        };
      case "gio_monitoring":
        return {
          headers: [
            "Case reason",
            "Insurance type",
            "Originating Office Type",
            "Originating Office",
            "Final payment amount (ETB)",
            "Recovery links",
            "Completed",
            "Rejected",
            "Returned",
            "In progress",
          ],
          rows: gioClaims.map((c) => {
            const reasonKey = c.gio_case_reason || "";
            const reasonLabel =
              gioMonitoring.byType.find((r) => r.reason === reasonKey)?.label ||
              String(reasonKey).replace(/_/g, " ") ||
              "—";

            const completed =
              !!c.closure_date ||
              ["Claim_Closed", "Closed", "Completed", "Approved"].includes(
                c.status,
              );
            const rejected = c.status === "Rejected";
            const returned = [
              "Returned_for_Correction",
              "Returned_to_Originating_Office",
              "Additional_Info_Requested",
              "Returned",
            ].includes(c.status);
            const inProgress = !completed && !rejected && !returned;

            const pay =
              c.registration_data?.final_payment_amount ??
              c.final_approval_amount ??
              "";

            const recoveryLinks =
              [
                c.is_recovery && "Third party recovery",
                c.is_subrogation && "Subrogation",
                c.is_reinsurance && "Reinsurance",
              ]
                .filter(Boolean)
                .join("; ") || "None";

            return [
              reasonLabel,
              c.insurance_type || "—",
              String(c.originating_office_type || "—").replace(/_/g, " "),
              c.originating_office || "—",
              pay !== "" && pay != null ? Number(pay) : "",
              recoveryLinks,
              completed ? 1 : 0,
              rejected ? 1 : 0,
              returned ? 1 : 0,
              inProgress ? 1 : 0,
            ];
          }),
        };
      case "pending":
      case "tracking":
      default:
        return {
          headers: [
            "Reference",
            "Insured",
            "Insurance type",
            "Plate number",
            "Garage name",
            "Originating Office Type",
            "Originating Office",
            "Final payment amount (ETB)",
            "Completed",
            "Rejected",
            "Returned",
            "In progress",
          ],
          rows: filtered.map((c) => {
            const isMotor = String(c.insurance_type || "")
              .toLowerCase()
              .includes("motor");

            const completed =
              !!c.closure_date ||
              ["Claim_Closed", "Closed", "Completed", "Approved"].includes(
                c.status,
              );
            const rejected = c.status === "Rejected";
            const returned = [
              "Returned_for_Correction",
              "Returned_to_Originating_Office",
              "Additional_Info_Requested",
              "Returned",
            ].includes(c.status);
            const inProgress = !completed && !rejected && !returned;

            const pay =
              c.registration_data?.final_payment_amount ??
              c.final_approval_amount ??
              "";

            // plate / garage only meaningful for motor (show "—" otherwise)
            const plate = isMotor
              ? c.plate_number || c.vehicle_plate_number || "—"
              : "—";
            const garage = isMotor
              ? c.winning_garage_name ||
                c.garage_name ||
                c.selected_garage_name ||
                "—"
              : "—";

            return [
              c.claim_reference || "N/A",
              c.claimant_name || "—",
              c.insurance_type || "—",
              plate,
              garage,
              String(c.originating_office_type || "—").replace(/_/g, " "),
              c.originating_office || "—",
              pay !== "" && pay != null ? Number(pay) : "",
              completed ? 1 : 0,
              rejected ? 1 : 0,
              returned ? 1 : 0,
              inProgress ? 1 : 0,
            ];
          }),
        };
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const timestamp = moment().format("DD MMM YYYY, HH:mm");
    const fileNameDate = moment().format("YYYYMMDD_HHmm");

    const PRIMARY_COLOR = [37, 99, 235];
    const TEXT_DARK = [30, 41, 59];
    const LIGHT_GRAY = [241, 245, 249];
    const RED_COLOR = [220, 38, 38];

    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(0, 0, 210, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ETHIOPIAN INSURANCE CORPORATION", 14, 11);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(currentReportLabel, 14, 18);

    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(9);
    doc.text(`Stream: ${streamLabel}`, 14, 30);
    doc.text(`Filter Period: ${period}`, 85, 30);
    doc.text(`Generated: ${timestamp}`, 145, 30);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary KPIs", 14, 42);

    const cardWidth = 42;
    const cardHeight = 16;
    const kpis = [
      { label: "Total Claims", val: totalClaims, color: PRIMARY_COLOR },
      { label: "Active", val: activeClaims.length, color: [217, 119, 6] },
      { label: "Delayed", val: delayedClaims.length, color: RED_COLOR },
      { label: "Closed", val: closedClaims.length, color: [5, 150, 105] },
    ];
    kpis.forEach((kpi, idx) => {
      const x = 14 + idx * 46;
      const y = 46;
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F");
      doc.setFillColor(...kpi.color);
      doc.roundedRect(x, y, 2.5, cardHeight, 1, 1, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label.toUpperCase(), x + 5, y + 5.5);
      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(String(kpi.val), x + 5, y + 13);
    });

    const { headers, rows } = getExportTable();

    autoTable(doc, {
      startY: 68,
      head: [headers],
      body: rows,
      theme: "striped",
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 8, textColor: TEXT_DARK },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14, bottom: 15 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount} · EIC Claim Management System`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 8,
          { align: "center" },
        );
      },
    });

    doc.save(`EIC_${reportType}_${stream}_${fileNameDate}.pdf`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ethiopian Insurance Corporation";
    workbook.created = new Date();

    const HEADER_FILL = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "2563EB" },
    };
    const HEADER_FONT = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    const BORDER_STYLE = {
      top: { style: "thin", color: { argb: "E2E8F0" } },
      bottom: { style: "thin", color: { argb: "E2E8F0" } },
      left: { style: "thin", color: { argb: "E2E8F0" } },
      right: { style: "thin", color: { argb: "E2E8F0" } },
    };

    const wsSummary = workbook.addWorksheet("Executive Summary");
    wsSummary.columns = [
      { header: "Key Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 30 },
    ];
    wsSummary.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
    wsSummary.addRows([
      { metric: "Report", value: currentReportLabel },
      { metric: "Report Stream", value: streamLabel },
      { metric: "Selected Period", value: period },
      {
        metric: "Generated Timestamp",
        value: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
      { metric: "Total Claims", value: totalClaims },
      { metric: "Active Claims", value: activeClaims.length },
      { metric: "Delayed Claims", value: delayedClaims.length },
      { metric: "Closed Claims", value: closedClaims.length },
    ]);
    wsSummary.eachRow((row, i) => {
      if (i > 1) row.eachCell((cell) => (cell.border = BORDER_STYLE));
    });

    const { headers, rows } = getExportTable();
    const sheetName =
      (currentReportLabel || "Report")
        .replace(/[*?:\\/[\]]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 31) || "Report";

    const wsData = workbook.addWorksheet(sheetName);
    wsData.columns = headers.map((h) => ({ header: h, key: h, width: 22 }));
    wsData.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
    rows.forEach((r) => {
      const row = wsData.addRow(r);
      row.eachCell((cell) => (cell.border = BORDER_STYLE));
    });
    if (rows.length > 0) {
      wsData.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rows.length + 1, column: headers.length },
      };
    }

    const wsTrend = workbook.addWorksheet("Workflow Trend");
    wsTrend.columns = [
      { header: "Period", key: "label", width: 20 },
      { header: "Claim Count", key: "count", width: 16 },
    ];
    wsTrend.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
    trendData.forEach((t) => wsTrend.addRow(t));

    const buffer = await workbook.xlsx.writeBuffer();
    const fileNameDate = moment().format("YYYYMMDD_HHmm");
    saveAs(
      new Blob([buffer]),
      `EIC_${reportType}_${stream}_${fileNameDate}.xlsx`,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claim Operation Division — workflow &amp; performance reports
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportPDF}
            className="gap-1.5"
          >
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            className="gap-1.5"
          >
            <Sheet className="w-4 h-4" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        {canSwitch ? (
          <div className="flex gap-2">
            {[
              { value: "Claim_Division", label: "Claim Division" },
              { value: "GIO_Approval", label: "GIO Cases" },
              { value: "all", label: "All" },
            ].map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={streamChoice === t.value ? "default" : "outline"}
                onClick={() => {
                  setStreamChoice(t.value);
                  setPage(1);
                  if (t.value === "GIO_Approval") {
                    setReportType("gio_monitoring");
                  } else {
                    setReportType((prev) =>
                      prev === "gio_monitoring" || prev === "gio_performance"
                        ? "tracking"
                        : prev,
                    );
                  }
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Showing:{" "}
            {stream === "GIO_Approval" ? "GIO Cases" : "Claim Division"}
          </p>
        )}

        <Select
          value={period}
          onValueChange={(v) => {
            setPeriod(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {stream !== "GIO_Approval" && (
        // existing REPORT_TYPES UI — buttons or Select
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((r) => {
            const Icon = r.icon;
            return (
              <Button
                key={r.value}
                size="sm"
                variant={reportType === r.value ? "default" : "outline"}
                onClick={() => setReportType(r.value)}
                className="gap-1"
              >
                <Icon className="w-3.5 h-3.5" />
                {r.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* KPIs — always visible as the Management Dashboard baseline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">
                Total Claims
              </span>
            </div>
            <p className="text-2xl font-bold">{totalClaims}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">
                Active Claims
              </span>
            </div>
            <p className="text-2xl font-bold">{activeClaims.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-muted-foreground">
                Delayed Claims
              </span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {delayedClaims.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">
                Closed Claims
              </span>
            </div>
            <p className="text-2xl font-bold">{closedClaims.length}</p>
          </CardContent>
        </Card>
      </div>
      {stream === "GIO_Approval" && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={reportType === "gio_monitoring" ? "default" : "outline"}
            onClick={() => {
              setReportType("gio_monitoring");
            }}
          >
            Claim & Approval Monitoring
          </Button>
          <Button
            size="sm"
            variant={reportType === "gio_performance" ? "default" : "outline"}
            onClick={() => {
              setReportType("gio_performance");
            }}
          >
            Approval Performance
          </Button>
        </div>
      )}

      {stream === "GIO_Approval" && reportType === "gio_monitoring" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              ["Received", gioMonitoring.totals.received],
              ["In progress", gioMonitoring.totals.inProgress],
              ["Returned", gioMonitoring.totals.returned],
              ["Completed", gioMonitoring.totals.completed],
              ["Rejected", gioMonitoring.totals.rejected],
            ].map(([label, value]) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Complaints</p>
                <p className="text-xl font-bold">
                  {gioMonitoring.complaintsCount}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Advisory requests
                </p>
                <p className="text-xl font-bold">
                  {gioMonitoring.advisoryCount}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Status by case reason</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Case reason</TableHead>
                    <TableHead className="text-xs">Completed</TableHead>
                    <TableHead className="text-xs">Rejected</TableHead>
                    <TableHead className="text-xs">Returned</TableHead>
                    <TableHead className="text-xs">In progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gioMonitoring.byType.map((r) => (
                    <TableRow key={r.reason}>
                      <TableCell className="text-xs">{r.label}</TableCell>
                      <TableCell className="text-xs">{r.completed}</TableCell>
                      <TableCell className="text-xs">{r.rejected}</TableCell>
                      <TableCell className="text-xs">{r.returned}</TableCell>
                      <TableCell className="text-xs">{r.inProgress}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {stream === "GIO_Approval" && reportType === "gio_performance" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Received", gioPerformance.received],
            ["Completed", gioPerformance.completed],
            ["In progress", gioPerformance.inProgress],
            ["Returned", gioPerformance.returned],
            ["Work orders completed", gioPerformance.workOrders],
            ["Cash option completed", gioPerformance.cashOption],
            ["Payment approvals completed", gioPerformance.paymentApprovals],
            [
              "Total completed amount (ETB)",
              gioPerformance.totalCompletedAmount,
            ],
          ].map(([label, value]) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-lg font-bold tabular-nums">
                  {String(label).includes("amount")
                    ? Number(value || 0).toLocaleString()
                    : value}
                </p>
              </CardContent>
            </Card>
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-[220px]">
              <p className="text-[10px] uppercase text-muted-foreground">
                Recovery / link type
              </p>
              <Select value={linkFlag} onValueChange={setLinkFlag}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_FLAG_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="border-0 shadow-sm flex-1 min-w-[160px]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase text-muted-foreground">
                  {linkMeta.label} — Yes
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {linkYesCount}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  of {gioClaims.length} GIO claims
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {stream !== "GIO_Approval" && (
        <>
          {(reportType === "tracking" || reportType === "pending") && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {reportType === "pending"
                    ? "Pending Claims"
                    : "Claim Status / Tracking"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Active claims in the selected stream. Delayed if &gt;{" "}
                  {DELAY_DAYS_THRESHOLD} days in stage or past due date.
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {pendingDelayedRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No active claims
                  </p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1"
                              onClick={() => toggleSort("claim")}
                            >
                              Claim Number <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </TableHead>
                          <TableHead className="text-xs">Insured</TableHead>
                          <TableHead className="text-xs">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1"
                              onClick={() => toggleSort("status")}
                            >
                              Status <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </TableHead>
                          <TableHead className="text-xs">
                            Current Stage
                          </TableHead>
                          <TableHead className="text-xs">Responsible</TableHead>
                          <TableHead className="text-xs">
                            Entered Stage
                          </TableHead>
                          <TableHead className="text-xs">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1"
                              onClick={() => toggleSort("days")}
                            >
                              Days <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </TableHead>
                          <TableHead className="text-xs">Indicator</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs font-medium">
                              {r.claim_reference}
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.insured}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${STATUS_COLORS[r.status] || ""}`}
                              >
                                {String(r.status || "").replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[160px] truncate">
                              {r.stage}
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.responsible}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.entered
                                ? moment(r.entered).format("DD MMM YYYY")
                                : "—"}
                            </TableCell>
                            <TableCell
                              className={`text-xs font-semibold ${r.delayed ? "text-red-600" : ""}`}
                            >
                              {r.days}
                            </TableCell>
                            <TableCell>
                              {r.delayed ? (
                                <Badge className="bg-red-100 text-red-700 text-[10px]">
                                  Delayed
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                                  On track
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {showingFrom}–{showingTo} of{" "}
                        {pendingDelayedRows.length} claims
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="w-4 h-4" /> Prev
                        </Button>
                        <span className="text-xs text-muted-foreground tabular-nums px-1">
                          Page {safePage} of {totalPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          disabled={safePage >= totalPages}
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                        >
                          Next <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === "tat" && (
            <>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Turnaround Time by Stage
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Average days spent in each stage, based on completed
                    activities.
                  </p>
                </CardHeader>
                <CardContent>
                  {tatByStage.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No completed stage data yet
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={tatByStage}
                        layout="vertical"
                        margin={{ left: 40 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis
                          dataKey="stage"
                          type="category"
                          width={160}
                          tick={{ fontSize: 9 }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="avgDays"
                          fill="#2563eb"
                          radius={[0, 6, 6, 0]}
                          name="Avg Days"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Turnaround Time by Performer
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {tatByPerformer.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No data yet
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Performer</TableHead>
                          <TableHead className="text-xs">
                            Stages Completed
                          </TableHead>
                          <TableHead className="text-xs">
                            Avg Days / Stage
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tatByPerformer.map((p) => (
                          <TableRow key={p.performer}>
                            <TableCell className="text-xs">
                              {p.performer}
                            </TableCell>
                            <TableCell className="text-xs">
                              {p.stagesCompleted}
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              {p.avgDays}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {reportType === "bottleneck" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Bottleneck / Delay (Aging)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Stages currently open longer than {DELAY_DAYS_THRESHOLD} days.
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {bottleneckRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No bottlenecked stages
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Claim Ref</TableHead>
                        <TableHead className="text-xs">Stage</TableHead>
                        <TableHead className="text-xs">Performer</TableHead>
                        <TableHead className="text-xs">Department</TableHead>
                        <TableHead className="text-xs">Days Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bottleneckRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs font-medium">
                            {r.claim_reference}
                          </TableCell>
                          <TableCell className="text-xs">{r.stage}</TableCell>
                          <TableCell className="text-xs">
                            {r.performer}
                          </TableCell>
                          <TableCell className="text-xs">
                            {String(r.department).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-red-600">
                            {r.days}d
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === "district" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  District / Branch Claims Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {districtSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No data
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">
                          Office / Branch
                        </TableHead>
                        <TableHead className="text-xs">Volume</TableHead>
                        <TableHead className="text-xs">
                          Avg TAT (days)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {districtSummary.map((d) => (
                        <TableRow key={d.office}>
                          <TableCell className="text-xs">{d.office}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            {d.volume}
                          </TableCell>
                          <TableCell className="text-xs">{d.avgTAT}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === "class" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Class-of-Business Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {classSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No data
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">
                          Class of Business
                        </TableHead>
                        <TableHead className="text-xs">Volume</TableHead>
                        <TableHead className="text-xs">Closed</TableHead>
                        <TableHead className="text-xs">
                          Total Amount (ETB)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classSummary.map((c) => (
                        <TableRow key={c.type}>
                          <TableCell className="text-xs">{c.type}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            {c.count}
                          </TableCell>
                          <TableCell className="text-xs">{c.closed}</TableCell>
                          <TableCell className="text-xs">
                            {c.amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === "decision" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Decision Outcome</CardTitle>
              </CardHeader>
              <CardContent>
                {decisionRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No decision data captured yet — this populates once the
                    per-stage decision field (Total Loss / Repair / Less Salvage
                    / Cash Option) is recorded on the Decision stage.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={decisionSummary}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#8b5cf6"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === "payment" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Payment / Disbursement
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {paymentRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No payment data captured yet — this populates once payee and
                    final payment amount are recorded on the Discharge &amp;
                    Payment stage.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Claim Ref</TableHead>
                        <TableHead className="text-xs">Payee</TableHead>
                        <TableHead className="text-xs">Amount (ETB)</TableHead>
                        <TableHead className="text-xs">Payment Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            {r.claim_reference}
                          </TableCell>
                          <TableCell className="text-xs">{r.payee}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            {r.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.date
                              ? moment(r.date).format("DD MMM YYYY")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === "recovery" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Subrogation / Recovery-Linked Claims
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {recoveryRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No linked claims in this period
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Claim Ref</TableHead>
                        <TableHead className="text-xs">Insured</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recoveryRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">
                            {r.claim_reference}
                          </TableCell>
                          <TableCell className="text-xs">{r.insured}</TableCell>
                          <TableCell className="text-xs">{r.type}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${STATUS_COLORS[r.status] || ""}`}
                            >
                              {String(r.status || "").replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === "doa" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Approval / DoA Compliance
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {doaViolations.length > 0 ? (
                    <span className="text-red-600 font-medium">
                      {doaViolations.length} claim(s) outside delegated
                      authority
                    </span>
                  ) : (
                    "All current approvals are within delegated authority"
                  )}
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {doaRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No claims with an active approver to check
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Claim Ref</TableHead>
                        <TableHead className="text-xs">Amount (ETB)</TableHead>
                        <TableHead className="text-xs">Required Role</TableHead>
                        <TableHead className="text-xs">Actual Role</TableHead>
                        <TableHead className="text-xs">Compliant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doaRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">
                            {r.claim_reference}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.amount?.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {String(r.requiredRole).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-xs">
                            {String(r.actualRole).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>
                            {r.compliant ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                                Compliant
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 text-[10px]">
                                Violation
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Trend + Source stay visible for the overview-style reports */}
          {["tracking", "pending"].includes(reportType) && (
            <>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm">
                    Claim Workflow Trend
                  </CardTitle>
                  <Select
                    value={trendGranularity}
                    onValueChange={setTrendGranularity}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="opacity-30"
                        />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Claims"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No data
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Claim Source</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Originating office type (Service Center, District, etc.)
                  </p>
                </CardHeader>
                <CardContent>
                  {sourceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={sourceData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          fill="#2563eb"
                          radius={[6, 6, 0, 0]}
                          name="Claims"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No source data
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
