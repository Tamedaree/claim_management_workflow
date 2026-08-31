import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";

const ACTION_ICONS = {
  Submitted: Clock,
  Approved: CheckCircle2,
  Rejected: XCircle,
  Returned: RotateCcw,
  Escalated: ArrowUpRight,
  Resubmitted: Clock,
  "Additional Info Requested": Clock,
  Comment: Clock,
};

const ACTION_COLORS = {
  Submitted: "bg-blue-100 text-blue-600",
  Approved: "bg-emerald-100 text-emerald-600",
  Rejected: "bg-red-100 text-red-600",
  Returned: "bg-orange-100 text-orange-600",
  Escalated: "bg-purple-100 text-purple-600",
  Resubmitted: "bg-cyan-100 text-cyan-600",
  "Additional Info Requested": "bg-amber-100 text-amber-600",
  Comment: "bg-gray-100 text-gray-600",
};

export default function AuditTrail() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const loadActions = async () => {
      setLoading(true);

      try {
        const res = await api.get("/claim-actions");
        setActions(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadActions();
  }, []);

  const filtered = actions.filter((a) => {
    const matchSearch =
      !search ||
      a.action_by_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.claim_reference?.includes(search);
    const matchType = typeFilter === "all" || a.action_type === typeFilter;
    return matchSearch && matchType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete history of all workflow actions
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by user or claim..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {[
              "Submitted",
              "Approved",
              "Rejected",
              "Returned",
              "Escalated",
              "Resubmitted",
              "Additional Info Requested",
            ].map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Shield className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No audit records found
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const Icon = ACTION_ICONS[a.action_type] || Clock;
            const colorClass =
              ACTION_COLORS[a.action_type] || ACTION_COLORS.Comment;
            return (
              <Card key={a.id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-start gap-4">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${colorClass}`}
                      >
                        {a.action_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">by</span>
                      <span className="text-xs font-semibold">
                        {a.action_by_name}
                      </span>
                      {a.action_by_role && (
                        <span className="text-[10px] text-muted-foreground">
                          ({a.action_by_role})
                        </span>
                      )}
                    </div>
                    {a.comments && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.comments}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {a.createdAt
                          ? format(
                              new Date(a.createdAt),
                              "DD MMM YYYY, HH:mm:ss",
                            )
                          : "—"}
                      </span>
                      {a.claim_id && (
                        <Link
                          to={`/claims/${a.claim_id}`}
                          className="text-[10px] text-primary hover:underline font-medium"
                        >
                          View Claim →
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
