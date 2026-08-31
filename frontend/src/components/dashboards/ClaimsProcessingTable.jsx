import { useState, useEffect } from "react";
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
import { formatCurrency } from "@/lib/roleConfig";
import moment from "moment";

export default function ClaimsProcessingTable() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/claims");
        if (cancelled) return;
        setClaims(res.data.data || []);
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

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const processed = claims.filter((c) => c.approval_date || c.rejection_date);
  const now = moment();

  const getPeriodStats = (period) => {
    const filtered = processed.filter((c) => {
      const d = moment(c.approval_date || c.rejection_date);
      return d.isSame(now, period);
    });
    return {
      count: filtered.length,
      amount: filtered.reduce((s, c) => s + (c.claim_amount || 0), 0),
      approved: filtered.filter((c) => c.status === "Approved").length,
      rejected: filtered.filter((c) => c.status === "Rejected").length,
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
    const dayClaims = processed.filter((c) =>
      moment(c.approval_date || c.rejection_date).isSame(day, "day"),
    );
    dailyBreakdown.push({
      date: day.format("DD MMM"),
      count: dayClaims.length,
      amount: dayClaims.reduce((s, c) => s + (c.claim_amount || 0), 0),
    });
  }

  const exportCSV = () => {
    const rows = [
      [
        "Period",
        "Claims Processed",
        "Approved",
        "Rejected",
        "Total Amount (ETB)",
      ],
      ...summary.map((s) => [
        s.period,
        s.count,
        s.approved,
        s.rejected,
        s.amount,
      ]),
      [],
      ["Daily Breakdown (Last 7 Days)"],
      ["Date", "Claims Processed", "Total Amount (ETB)"],
      ...dailyBreakdown.map((d) => [d.date, d.count, d.amount]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claims-processing-report-${moment().format(
      "YYYY-MM-DD",
    )}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Claims Processing Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${moment().format("DD MMM YYYY, HH:mm")}`, 14, 28);

    let y = 42;
    doc.setFontSize(12);
    doc.text("Summary", 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.text("Period", 14, y);
    doc.text("Processed", 80, y);
    doc.text("Approved", 110, y);
    doc.text("Rejected", 140, y);
    doc.text("Amount (ETB)", 170, y);
    y += 3;
    doc.line(14, y, 200, y);
    y += 7;

    summary.forEach((s) => {
      doc.text(s.period, 14, y);
      doc.text(String(s.count), 80, y);
      doc.text(String(s.approved), 110, y);
      doc.text(String(s.rejected), 140, y);
      doc.text(s.amount.toLocaleString(), 170, y);
      y += 7;
    });

    y += 8;
    doc.setFontSize(12);
    doc.text("Daily Breakdown (Last 7 Days)", 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.text("Date", 14, y);
    doc.text("Claims Processed", 80, y);
    doc.text("Amount (ETB)", 140, y);
    y += 3;
    doc.line(14, y, 200, y);
    y += 7;

    dailyBreakdown.forEach((d) => {
      doc.text(d.date, 14, y);
      doc.text(String(d.count), 80, y);
      doc.text(d.amount.toLocaleString(), 140, y);
      y += 7;
    });

    doc.save(`claims-processing-report-${moment().format("YYYY-MM-DD")}.pdf`);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          Claims Processing Summary
        </CardTitle>
        <div className="flex gap-2">
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
              <TableHead className="text-xs text-center">Processed</TableHead>
              <TableHead className="text-xs text-center">Approved</TableHead>
              <TableHead className="text-xs text-center">Rejected</TableHead>
              <TableHead className="text-xs text-right">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((s) => (
              <TableRow key={s.period}>
                <TableCell className="text-sm font-medium">
                  {s.period}
                </TableCell>
                <TableCell className="text-sm text-center">{s.count}</TableCell>
                <TableCell className="text-sm text-center text-emerald-600">
                  {s.approved}
                </TableCell>
                <TableCell className="text-sm text-center text-red-600">
                  {s.rejected}
                </TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {formatCurrency(s.amount)}
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
                <TableHead className="text-xs text-center">Processed</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyBreakdown.map((d) => (
                <TableRow key={d.date}>
                  <TableCell className="text-sm">{d.date}</TableCell>
                  <TableCell className="text-sm text-center">
                    {d.count}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {formatCurrency(d.amount)}
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
