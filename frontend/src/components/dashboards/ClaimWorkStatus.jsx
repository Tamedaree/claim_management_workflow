import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  User,
  Wrench,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  ROLE_LABELS,
  ROLE_HIERARCHY,
  STATUS_COLORS,
  ACTIVITY_STATUS_COLORS,
  formatCurrency,
} from "@/lib/roleConfig";
import moment from "moment";

const ACTION_ICONS = {
  Submitted: ArrowRight,
  Approved: CheckCircle2,
  Rejected: XCircle,
  Returned: RotateCcw,
  Escalated: ArrowRight,
  Additional_Info_Requested: Clock,
  "Additional Info Requested": Clock,
  Resubmitted: ArrowRight,
  Comment: User,
};

const toDisplayStatus = (s) => {
  if (s === "In_Progress") return "In Progress";
  if (s === "On_Hold") return "On Hold";
  return s;
};

/**
 * ClaimWorkStatus — shows the chain of work done on each claim, organized by role level.
 */
export default function ClaimWorkStatus({
  claims,
  userRole,
  title = "Claim Work Status — Who Did What",
  maxDisplay = 8,
}) {
  const [activities, setActivities] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(!!(claims && claims.length > 0));
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!claims || claims.length === 0) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [activitiesRes, actionsRes] = await Promise.all([
          api.get("/claim-activities"),
          api.get("/claim-actions"),
        ]);
        if (cancelled) return;
        setActivities(activitiesRes.data.data || []);
        setActions(actionsRes.data.data || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [claims]);

  const workChainByClaim = useMemo(() => {
    const claimIds = new Set((claims || []).map((c) => c.id));
    const map = {};

    activities.forEach((a) => {
      if (!claimIds.has(a.claim_id)) return;
      if (!map[a.claim_id]) map[a.claim_id] = [];
      map[a.claim_id].push({
        type: "activity",
        role: a.responsible_role,
        roleLabel: ROLE_LABELS[a.responsible_role] || a.responsible_role,
        person: a.responsible_user_name,
        label: a.stage_name,
        status: toDisplayStatus(a.status),
        date: a.completed_at || a.started_at || a.createdAt || a.created_date,
        comments: a.comments,
        department: a.department,
        order: a.stage_order || 0,
      });
    });

    actions.forEach((a) => {
      if (!claimIds.has(a.claim_id)) return;
      if (!map[a.claim_id]) map[a.claim_id] = [];
      map[a.claim_id].push({
        type: "action",
        role: a.action_by_role,
        roleLabel: ROLE_LABELS[a.action_by_role] || a.action_by_role,
        person: a.action_by_name,
        label: a.action_type,
        status:
          a.action_type === "Approved"
            ? "Completed"
            : a.action_type === "Rejected"
              ? "Skipped"
              : "Completed",
        date: a.createdAt || a.created_date,
        comments: a.comments,
        department: null,
        order: 999,
      });
    });

    Object.keys(map).forEach((cid) => {
      map[cid].sort((a, b) => {
        const ha = ROLE_HIERARCHY.indexOf(a.role);
        const hb = ROLE_HIERARCHY.indexOf(b.role);
        if (ha !== hb) return ha - hb;
        return new Date(a.date || 0) - new Date(b.date || 0);
      });
    });

    return map;
  }, [activities, actions, claims]);

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!claims || claims.length === 0) {
    return null;
  }

  const sortedClaims = [...claims].sort((a, b) => {
    const aDate =
      (workChainByClaim[a.id] || []).slice(-1)[0]?.date ||
      a.updatedAt ||
      a.updated_date;
    const bDate =
      (workChainByClaim[b.id] || []).slice(-1)[0]?.date ||
      b.updatedAt ||
      b.updated_date;
    return new Date(bDate || 0) - new Date(aDate || 0);
  });

  const displayClaims = sortedClaims.slice(0, maxDisplay);

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const getRoleLevel = (role) => ROLE_HIERARCHY.indexOf(role);

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-indigo-400">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-indigo-500" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Track who worked on each claim and at which role level — from field
          work to final approval
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayClaims.map((claim) => {
          const chain = workChainByClaim[claim.id] || [];
          const isExpanded = expanded[claim.id];
          const completedCount = chain.filter(
            (w) => w.status === "Completed",
          ).length;
          const myLevel = getRoleLevel(userRole);
          const workBelowMe = chain.filter(
            (w) => getRoleLevel(w.role) < myLevel,
          );

          return (
            <div
              key={claim.id}
              className="rounded-lg border border-slate-100 overflow-hidden"
            >
              <button
                onClick={() => toggle(claim.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {claim.claim_reference}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {claim.claimant_name} · {claim.insurance_type} ·{" "}
                      {formatCurrency(claim.claim_amount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        STATUS_COLORS[claim.status] || ""
                      }`}
                    >
                      {claim.status?.replace(/_/g, " ")}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {completedCount} steps done
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 bg-slate-50/50">
                  {chain.length > 0 ? (
                    <div className="space-y-0">
                      {chain.map((work, idx) => {
                        const Icon =
                          work.type === "action"
                            ? ACTION_ICONS[work.label] || User
                            : Wrench;
                        const isMyLevel = work.role === userRole;
                        const isBelow = getRoleLevel(work.role) < myLevel;

                        return (
                          <div key={idx} className="flex gap-3 relative">
                            {idx < chain.length - 1 && (
                              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />
                            )}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                work.status === "Completed"
                                  ? "bg-emerald-100 text-emerald-600"
                                  : work.status === "In Progress"
                                    ? "bg-blue-100 text-blue-600"
                                    : work.status === "Pending"
                                      ? "bg-gray-100 text-gray-400"
                                      : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium">
                                  {work.label}
                                </span>
                                {work.type === "action" ? (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] ${
                                      STATUS_COLORS[work.label] || ""
                                    }`}
                                  >
                                    {String(work.label).replace(/_/g, " ")}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] ${
                                      ACTIVITY_STATUS_COLORS[work.status] ||
                                      ACTIVITY_STATUS_COLORS[
                                        work.status?.replace(" ", "_")
                                      ] ||
                                      ""
                                    }`}
                                  >
                                    {work.status}
                                  </Badge>
                                )}
                                {isMyLevel && (
                                  <Badge className="text-[9px] bg-indigo-500">
                                    You
                                  </Badge>
                                )}
                                {isBelow && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] text-indigo-600 border-indigo-200"
                                  >
                                    Below you
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {work.roleLabel}
                                {work.person ? ` · ${work.person}` : ""}
                                {work.date
                                  ? ` · ${moment(work.date).format(
                                      "DD MMM, HH:mm",
                                    )}`
                                  : ""}
                              </p>
                              {work.comments && (
                                <p className="text-[11px] text-slate-500 mt-0.5 italic bg-white rounded px-2 py-1 border border-slate-100">
                                  "{work.comments}"
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {workBelowMe.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <Link
                            to={`/claims/${claim.id}`}
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            View full claim details{" "}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">
                      No work recorded yet — claim is at{" "}
                      {claim.status?.replace(/_/g, " ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sortedClaims.length > maxDisplay && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Showing {maxDisplay} of {sortedClaims.length} claims with work
            activity
          </p>
        )}
      </CardContent>
    </Card>
  );
}
