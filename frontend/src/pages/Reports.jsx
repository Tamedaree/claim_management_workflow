import { useEffect, useState } from "react";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency, INSURANCE_TYPES } from "@/lib/roleConfig";
import { BarChart3, TrendingUp, Clock, DollarSign } from "lucide-react";
import moment from "moment";

const COLORS = [
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#84cc16",
];

export default function Reports() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  // Declare first (optional here since not reused)
  // eslint-disable-next-line no-unused-vars
  const loadClaims = async () => {
    setLoading(true);
    try {
      const res = await api.get("/claims");
      setClaims(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Then effect
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/claims");
        if (!cancelled) setClaims(res.data.data || []);
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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const getDate = (c) => c.createdAt || c.created_date || c.submission_date;

  const filteredClaims = claims.filter((c) => {
    if (period === "all") return true;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const d = getDate(c);
    if (!d) return false;
    return moment().diff(moment(d), "days") <= days;
  });

  const totalClaims = filteredClaims.length;
  const totalAmount = filteredClaims.reduce(
    (s, c) => s + (c.claim_amount || 0),
    0,
  );

  const approvedClaims = filteredClaims.filter((c) => c.status === "Approved");

  const avgProcessingDays =
    approvedClaims.length > 0
      ? (
          approvedClaims.reduce((s, c) => {
            if (c.approval_date && c.submission_date) {
              return (
                s +
                moment(c.approval_date).diff(moment(c.submission_date), "days")
              );
            }
            return s;
          }, 0) / approvedClaims.length
        ).toFixed(1)
      : "—";

  const approvalRate =
    totalClaims > 0
      ? ((approvedClaims.length / totalClaims) * 100).toFixed(1)
      : "0";

  const statusDist = [
    "Submitted",
    "Under_Review",
    "Approved",
    "Rejected",
    "Returned",
    "Escalated",
    "Additional_Info_Requested",
  ]
    .map((s) => ({
      name: s.replace(/_/g, " "),
      value: filteredClaims.filter((c) => c.status === s).length,
    }))
    .filter((d) => d.value > 0);

  const typeAmount = INSURANCE_TYPES.map((t) => ({
    name: t,
    amount: filteredClaims
      .filter((c) => c.insurance_type === t)
      .reduce((s, c) => s + (c.claim_amount || 0), 0),
    count: filteredClaims.filter((c) => c.insurance_type === t).length,
  })).filter((d) => d.count > 0);

  // Monthly trend
  const months = {};
  filteredClaims.forEach((c) => {
    const d = getDate(c);
    if (!d) return;
    const m = moment(d).format("MMM YY");
    if (!months[m]) months[m] = { month: m, count: 0, amount: 0 };
    months[m].count++;
    months[m].amount += c.claim_amount || 0;
  });
  const monthlyTrend = Object.values(months).reverse();

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claim workflow performance insights
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
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
              <DollarSign className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Total Value</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">
                Avg. Processing (days)
              </span>
            </div>
            <p className="text-2xl font-bold">{avgProcessingDays}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">
                Approval Rate
              </span>
            </div>
            <p className="text-2xl font-bold">{approvalRate}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusDist.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No data
              </p>
            )}
          </CardContent>
        </Card>

        {/* Amount by Type */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Claim Amount by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {typeAmount.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={typeAmount}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No data
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      {monthlyTrend.length > 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Claims Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
