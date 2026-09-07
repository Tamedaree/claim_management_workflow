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
} from "lucide-react";
import moment from "moment";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  ROLE_LABELS,
  STATUS_COLORS,
  getWorkflowScopeForRole,
} from "@/lib/roleConfig";

const PAGE_SIZE = 50;

const CLOSED_STATUSES = new Set([
  "Claim_Closed",
  "Closed",
  "Completed",
  "Approved",
  "Rejected",
]);

const DELAY_DAYS_THRESHOLD = 7; // change or load from config later

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

/** Best-effort: when claim entered current stage */
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
      return null; // all
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
  return m.format("MMM YY"); // monthly
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
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [trendGranularity, setTrendGranularity] = useState("monthly");
  const [sortKey, setSortKey] = useState("days");
  const [sortDir, setSortDir] = useState("desc");
  const [nameByEmail, setNameByEmail] = useState({});
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/claims");
        if (!cancelled) setClaims(res.data?.data || []);
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

  const totalPages = Math.max(
    1,
    Math.ceil(pendingDelayedRows.length / PAGE_SIZE),
  );
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = pendingDelayedRows.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = pendingDelayedRows.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, pendingDelayedRows.length);

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

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const timestamp = moment().format("DD MMM YYYY, HH:mm");
    const fileNameDate = moment().format("YYYYMMDD_HHmm");

    // Colors based on EIC Corporate Palette
    const PRIMARY_COLOR = [37, 99, 235]; // #2563eb
    const TEXT_DARK = [30, 41, 59]; // #1e293b
    const LIGHT_GRAY = [241, 245, 249]; // #f1f5f9
    const RED_COLOR = [220, 38, 38]; // #dc2626

    // Header Banner Background
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(0, 0, 210, 24, "F");

    // Header Title Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ETHIOPIAN INSURANCE CORPORATION", 14, 11);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Workflow Analytics & Status Report", 14, 18);

    // Metadata Sub-bar
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(9);
    doc.text(`Stream: ${streamLabel}`, 14, 30);
    doc.text(`Filter Period: ${period}`, 85, 30);
    doc.text(`Generated: ${timestamp}`, 145, 30);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Summary Metrics Section (KPI Cards Visual Representation)
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

      // Card background
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F");

      // Left accent strip
      doc.setFillColor(...kpi.color);
      doc.roundedRect(x, y, 2.5, cardHeight, 1, 1, "F");

      // Label & Value
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label.toUpperCase(), x + 5, y + 5.5);

      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(String(kpi.val), x + 5, y + 13);
    });

    // Table Data Preparation
    const tableHeaders = [
      [
        "Reference",
        "Insured Name",
        "Status",
        "Current Stage",
        "Responsible",
        "Days",
        "Health",
      ],
    ];

    const tableBody = pendingDelayedRows.map((r) => [
      r.claim_reference || "N/A",
      r.insured || "—",
      String(r.status || "").replace(/_/g, " "),
      r.stage || "—",
      r.responsible || "—",
      `${r.days}d`,
      r.delayed ? "DELAYED" : "ON TRACK",
    ]);

    // Render Table with autoTable
    autoTable(doc, {
      startY: 68,
      head: tableHeaders,
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: TEXT_DARK,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 32 },
        5: { halign: "center", fontStyle: "bold" },
        6: { halign: "center", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        // Highlight delayed cells in red text
        if (data.section === "body" && data.column.index === 6) {
          if (data.cell.raw === "DELAYED") {
            data.cell.styles.textColor = RED_COLOR;
          } else {
            data.cell.styles.textColor = [5, 150, 105];
          }
        }
      },
      margin: { left: 14, right: 14, bottom: 15 },
      didDrawPage: (data) => {
        // Footer Page Numbering
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Page ${data.pageNumber} of ${pageCount} · EIC Claim Management System`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 8,
          { align: "center" },
        );
      },
    });

    doc.save(`EIC_Workflow_Report_${stream}_${fileNameDate}.pdf`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ethiopian Insurance Corporation";
    workbook.created = new Date();

    const PRIMARY_HEX = "2563EB";
    // eslint-disable-next-line no-unused-vars
    const LIGHT_GRAY_HEX = "F1F5F9";
    const HEADER_FILL = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: PRIMARY_HEX },
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

    // --- SHEET 1: SUMMARY DASHBOARD ---
    const wsSummary = workbook.addWorksheet("Executive Summary");

    wsSummary.columns = [
      { header: "Key Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 30 },
    ];

    // Header Styling
    wsSummary.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle" };
    });

    wsSummary.addRows([
      { metric: "Report Stream", value: streamLabel },
      { metric: "Selected Period", value: period },
      {
        metric: "Generated Timestamp",
        value: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
      { metric: "Total Claims Received", value: totalClaims },
      { metric: "Currently Active Claims", value: activeClaims.length },
      { metric: "Delayed Claims (>7 Days)", value: delayedClaims.length },
      { metric: "Closed/Completed Claims", value: closedClaims.length },
    ]);

    wsSummary.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = BORDER_STYLE;
          cell.font = { name: "Calibri", size: 10 };
        });
      }
    });

    // --- SHEET 2: PENDING & DELAYED CLAIMS ---
    const wsPending = workbook.addWorksheet("Pending & Delayed");

    wsPending.columns = [
      { header: "Claim Reference", key: "ref", width: 22 },
      { header: "Insured Name", key: "insured", width: 25 },
      { header: "Status", key: "status", width: 20 },
      { header: "Current Stage", key: "stage", width: 28 },
      { header: "Responsible Party", key: "responsible", width: 24 },
      { header: "Entered Stage Date", key: "entered", width: 18 },
      { header: "Days in Stage", key: "days", width: 14 },
      { header: "Indicator", key: "indicator", width: 14 },
    ];

    // Table Headers
    const headerRow = wsPending.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Table Body Rows
    pendingDelayedRows.forEach((r, idx) => {
      const row = wsPending.addRow({
        ref: r.claim_reference || "N/A",
        insured: r.insured || "—",
        status: String(r.status || "").replace(/_/g, " "),
        stage: r.stage || "—",
        responsible: r.responsible || "—",
        entered: r.entered ? moment(r.entered).format("YYYY-MM-DD") : "—",
        days: r.days || 0,
        indicator: r.delayed ? "DELAYED" : "On Track",
      });

      // Zebra striping
      const isEven = idx % 2 === 0;
      const rowFill = isEven
        ? null
        : { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };

      row.eachCell((cell, colNumber) => {
        if (rowFill) cell.fill = rowFill;
        cell.border = BORDER_STYLE;
        cell.font = { name: "Calibri", size: 10 };
        cell.alignment = { vertical: "middle" };

        // Number formatting for Days column
        if (colNumber === 7) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "#,##0";
        }

        // Highlight Delayed rows
        if (colNumber === 8) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (r.delayed) {
            cell.font = {
              name: "Calibri",
              size: 10,
              bold: true,
              color: { argb: "DC2626" },
            };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FEE2E2" },
            };
          } else {
            cell.font = {
              name: "Calibri",
              size: 10,
              bold: true,
              color: { argb: "059669" },
            };
          }
        }
      });
    });

    // Enable Auto Filter on main data table
    wsPending.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: pendingDelayedRows.length + 1, column: 8 },
    };

    // --- SHEET 3: TREND DATA ---
    const wsTrend = workbook.addWorksheet("Workflow Trend");
    wsTrend.columns = [
      { header: "Period", key: "label", width: 20 },
      { header: "Claim Count", key: "count", width: 16 },
    ];
    wsTrend.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
    trendData.forEach((t) => {
      const row = wsTrend.addRow(t);
      row.eachCell((cell) => (cell.border = BORDER_STYLE));
    });

    // --- SHEET 4: SOURCE DATA ---
    const wsSource = workbook.addWorksheet("Claim Sources");
    wsSource.columns = [
      { header: "Office / Unit Type", key: "name", width: 24 },
      { header: "Claims Received", key: "count", width: 18 },
    ];
    wsSource.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
    sourceData.forEach((s) => {
      const row = wsSource.addRow(s);
      row.eachCell((cell) => (cell.border = BORDER_STYLE));
    });

    // Save File
    const buffer = await workbook.xlsx.writeBuffer();
    const fileNameDate = moment().format("YYYYMMDD_HHmm");
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `EIC_Workflow_Report_${stream}_${fileNameDate}.xlsx`,
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
            Workflow monitoring — Claim Division and GIO cases
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
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Showing: {stream === "GIO_Approval" ? "GIO Cases" : "Claim Division"}
        </p>
      )}

      {/* Date period */}
      <div className="flex justify-end">
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

      {/* KPIs */}
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

      {/* Pending & Delayed */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pending & Delayed Claims</CardTitle>
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
                    <TableHead className="text-xs">Current Stage</TableHead>
                    <TableHead className="text-xs">Responsible</TableHead>
                    <TableHead className="text-xs">Entered Stage</TableHead>
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
                      <TableCell className="text-xs">{r.insured}</TableCell>
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
                      <TableCell className="text-xs">{r.responsible}</TableCell>
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
                    <ChevronLeft className="w-4 h-4" />
                    Prev
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trend */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Claim Workflow Trend</CardTitle>
          <Select value={trendGranularity} onValueChange={setTrendGranularity}>
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
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
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

      {/* Claim source */}
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
    </div>
  );
}
