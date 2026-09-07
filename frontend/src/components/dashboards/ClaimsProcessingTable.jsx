import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, Calendar } from "lucide-react";
import { getWorkflowScopeForRole } from "@/lib/roleConfig";
import moment from "moment";

// Claim Division: In Progress / Completed / Escalated / Total Claims
const CLAIM_DIVISION_IN_PROGRESS = [
  "Submitted",
  "Under_Review",
  "Additional_Info_Requested",
  "Notification_Received",
  "Claim_Registered",
  "Pending_Assignment",
  "Assigned_to_Principal_of_Claim",
  "Assigned_to_Claim_Adjuster",
  "Underwriting_Verification",
  "Survey_Requested",
  "Survey_in_Progress",
  "Damage_Assessment_Completed",
  "Principal_Review_Pending",
  "Proforma_Collection",
  "Tender_Analysis_Pending",
  "Garage_Selection_Pending",
  "Re_bid_Pending",
  "Independent_Assessment_Pending",
  "Work_Order_Review_Pending",
  "Work_Order_Approved",
  "Repair_in_Progress",
  "Repair_Approval_Pending",
  "Repair_Approved",
  "Salvage_Pending",
  "Satisfaction_Pending",
  "Payment_Preparation",
  "Payment_Review_Pending",
  "Payment_Approval_Pending",
  "Payment_Document_Approved",
  "Forwarded_to_Finance",
  "Payment_Pending",
];

const CLAIM_DIVISION_COMPLETED = [
  "Approved",
  "Payment_Completed",
  "Claim_Closed",
  "Closed",
];

const CLAIM_DIVISION_ESCALATED = ["Escalated", "Escalated_to_GIO"];

// GIO: In Progress / Completed / Returned / Total Claims
const GIO_IN_PROGRESS = [
  "Submitted",
  "Under_Review",
  "Case_Received",
  "Pending_GIO_Assignment",
  "Assigned_to_GIO_Claim_Adjuster",
  "Document_Review_Pending",
  "GIO_Review_In_Progress",
  "Claim_Manager_Review_Pending",
  "Director_Decision_Pending",
  "Chief_of_GIO_Approval_Pending",
  "CEO_Approval_Pending",
  "Additional_Info_Requested",
];

const GIO_COMPLETED = ["Approved", "Completed", "Closed"];

const GIO_RETURNED = ["Returned", "Returned_to_Originating_Office", "Rejected"];

function getEventDate(c) {
  return (
    c.closure_date ||
    c.approval_date ||
    c.rejection_date ||
    c.updatedAt ||
    c.updated_at ||
    c.createdAt ||
    c.created_date ||
    c.submission_date
  );
}

function classifyClaim(c, mode) {
  const status = c.status || "";
  if (mode === "GIO_Approval") {
    if (GIO_COMPLETED.includes(status)) return "completed";
    if (GIO_RETURNED.includes(status)) return "returned";
    if (GIO_IN_PROGRESS.includes(status)) return "in_progress";
    // fallback heuristics
    if (["Approved", "Completed", "Closed"].includes(status))
      return "completed";
    if (String(status).includes("Return") || status === "Rejected")
      return "returned";
    return "in_progress";
  }

  // Claim Division
  if (CLAIM_DIVISION_COMPLETED.includes(status)) return "completed";
  if (CLAIM_DIVISION_ESCALATED.includes(status)) return "escalated";
  if (CLAIM_DIVISION_IN_PROGRESS.includes(status)) return "in_progress";
  if (status === "Approved" || status === "Claim_Closed") return "completed";
  if (String(status).includes("Escalat")) return "escalated";
  return "in_progress";
}

export default function ClaimsProcessingTable() {
  const { user } = useOutletContext() || {};
  const scope = getWorkflowScopeForRole(user?.role || "claim_adjuster");

  // admin / secretary / director / ceo can see both; pick filter tabs if needed
  const [stream, setStream] = useState(
    scope === "GIO_Approval" ? "GIO_Approval" : "Claim_Division",
  );

  const activeStream =
    scope === "all"
      ? stream
      : scope === "GIO_Approval"
        ? "GIO_Approval"
        : "Claim_Division";

  const isGio = activeStream === "GIO_Approval";

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/claims");
        if (cancelled) return;
        setClaims(res.data?.data || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scopedClaims = useMemo(() => {
    return claims.filter((c) => {
      const wt = c.workflow_type || "Claim_Division";
      if (activeStream === "GIO_Approval") return wt === "GIO_Approval";
      if (activeStream === "Claim_Division") return wt !== "GIO_Approval";
      return true;
    });
  }, [claims, activeStream]);

  const labels = isGio
    ? {
        col2: "In Progress",
        col3: "Completed",
        col4: "Returned",
        col5: "Total Claims",
        title: "GIO Cases Processing Summary",
      }
    : {
        col2: "In Progress",
        col3: "Completed",
        col4: "Escalated",
        col5: "Total Claims",
        title: "Claim Division Processing Summary",
      };

  const getPeriodStats = (period) => {
    const now = moment();
    const inPeriod = scopedClaims.filter((c) => {
      const d = getEventDate(c);
      return d && moment(d).isSame(now, period);
    });

    let inProgress = 0;
    let completed = 0;
    let third = 0; // escalated OR returned

    for (const c of inPeriod) {
      const bucket = classifyClaim(c, activeStream);
      if (bucket === "completed") completed += 1;
      else if (bucket === "escalated" || bucket === "returned") third += 1;
      else inProgress += 1;
    }

    return {
      inProgress,
      completed,
      third,
      total: inPeriod.length,
    };
  };

  const summary = [
    { period: "Daily (Today)", ...getPeriodStats("day") },
    { period: "Weekly (This Week)", ...getPeriodStats("week") },
    { period: "Monthly (This Month)", ...getPeriodStats("month") },
    { period: "Yearly (This Year)", ...getPeriodStats("year") },
  ];

  const dailyBreakdown = [];
  for (let i = 6; i >= 0; i--) {
    const day = moment().subtract(i, "days");
    const dayClaims = scopedClaims.filter((c) => {
      const d = getEventDate(c);
      return d && moment(d).isSame(day, "day");
    });
    dailyBreakdown.push({
      date: day.format("DD MMM"),
      count: dayClaims.length,
    });
  }

  const exportCSV = () => {
    const rows = [
      ["Period", labels.col2, labels.col3, labels.col4, labels.col5],
      ...summary.map((s) => [
        s.period,
        s.inProgress,
        s.completed,
        s.third,
        s.total,
      ]),
      [],
      ["Daily Breakdown (Last 7 Days)"],
      ["Date", "Total Claims"],
      ...dailyBreakdown.map((d) => [d.date, d.count]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claims-processing-${activeStream}-${moment().format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(labels.title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${moment().format("DD MMM YYYY, HH:mm")}`, 14, 28);

    let y = 42;
    doc.setFontSize(9);
    doc.text("Period", 14, y);
    doc.text(labels.col2, 60, y);
    doc.text(labels.col3, 95, y);
    doc.text(labels.col4, 130, y);
    doc.text(labels.col5, 165, y);
    y += 3;
    doc.line(14, y, 200, y);
    y += 7;

    summary.forEach((s) => {
      doc.text(s.period, 14, y);
      doc.text(String(s.inProgress), 60, y);
      doc.text(String(s.completed), 95, y);
      doc.text(String(s.third), 130, y);
      doc.text(String(s.total), 165, y);
      y += 7;
    });

    doc.save(
      `claims-processing-${activeStream}-${moment().format("YYYY-MM-DD")}.pdf`,
    );
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2 flex-wrap">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          {labels.title}
        </CardTitle>
        <div className="flex gap-2 items-center flex-wrap">
          {scope === "all" && (
            <div className="flex gap-1 mr-2">
              <Button
                size="sm"
                variant={stream === "Claim_Division" ? "default" : "outline"}
                className="text-xs h-8"
                onClick={() => setStream("Claim_Division")}
              >
                Claim Division
              </Button>
              <Button
                size="sm"
                variant={stream === "GIO_Approval" ? "default" : "outline"}
                className="text-xs h-8"
                onClick={() => setStream("GIO_Approval")}
              >
                GIO
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={exportCSV}
            className="text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportPDF}
            className="text-xs gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Period</TableHead>
              <TableHead className="text-xs text-center">
                {labels.col2}
              </TableHead>
              <TableHead className="text-xs text-center">
                {labels.col3}
              </TableHead>
              <TableHead className="text-xs text-center">
                {labels.col4}
              </TableHead>
              <TableHead className="text-xs text-right">
                {labels.col5}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((s) => (
              <TableRow key={s.period}>
                <TableCell className="text-sm font-medium">
                  {s.period}
                </TableCell>
                <TableCell className="text-sm text-center text-blue-600">
                  {s.inProgress}
                </TableCell>
                <TableCell className="text-sm text-center text-emerald-600">
                  {s.completed}
                </TableCell>
                <TableCell
                  className={`text-sm text-center ${
                    isGio ? "text-orange-600" : "text-purple-600"
                  }`}
                >
                  {s.third}
                </TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {s.total}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Daily Breakdown (Last 7 Days)
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-right">
                  Total Claims
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyBreakdown.map((d) => (
                <TableRow key={d.date}>
                  <TableCell className="text-sm">{d.date}</TableCell>
                  <TableCell className="text-sm text-right">
                    {d.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
