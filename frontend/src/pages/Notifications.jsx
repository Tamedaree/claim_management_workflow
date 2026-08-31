import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ClipboardCheck,
  Info,
  Check,
  Trash2,
  ArrowRight,
} from "lucide-react";
import moment from "moment";

const TYPE_ICONS = {
  approval_required: ClipboardCheck,
  claim_approved: CheckCircle2,
  claim_rejected: XCircle,
  claim_returned: RotateCcw,
  claim_escalated: Info,
  info_requested: Info,
  general: Bell,
};

const TYPE_COLORS = {
  approval_required: "bg-amber-50 text-amber-600",
  claim_approved: "bg-emerald-50 text-emerald-600",
  claim_rejected: "bg-red-50 text-red-600",
  claim_returned: "bg-orange-50 text-orange-600",
  claim_escalated: "bg-purple-50 text-purple-600",
  info_requested: "bg-cyan-50 text-cyan-600",
  general: "bg-blue-50 text-blue-600",
};

const isStageNotification = (n) =>
  n.title?.startsWith("New Task:") ||
  n.title?.startsWith("Stage") ||
  n.message?.includes("progressed to");

export default function Notifications() {
  const { user } = useOutletContext();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Declare first
  // eslint-disable-next-line no-unused-vars
  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Then effect
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/notifications");
        if (!cancelled) setNotifications(res.data.data || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const markAsRead = async (notif) => {
    if (notif.is_read) return;
    try {
      await api.patch(`/notifications/${notif.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
      );
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silent
    }
  };

  const deleteNotif = async (notif) => {
    try {
      await api.delete(`/notifications/${notif.id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    } catch {
      // silent
    }
  };

  const removeCompletedStageNotifs = async () => {
    const toRemove = notifications.filter(
      (n) => isStageNotification(n) && n.is_read,
    );
    try {
      await Promise.all(
        toRemove.map((n) => api.delete(`/notifications/${n.id}`)),
      );
      setNotifications((prev) =>
        prev.filter((n) => !(isStageNotification(n) && n.is_read)),
      );
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const hasCompletedStage = notifications.some(
    (n) => isStageNotification(n) && n.is_read,
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount} unread notification(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasCompletedStage && (
            <Button
              variant="outline"
              size="sm"
              onClick={removeCompletedStageNotifs}
              className="gap-1.5 text-orange-600 hover:text-orange-700"
            >
              <Trash2 className="w-4 h-4" /> Clear worked stages
            </Button>
          )}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="gap-1.5"
            >
              <Check className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No notifications yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.general;
            const stage = isStageNotification(n);

            return (
              <Card
                key={n.id}
                className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                  !n.is_read ? "bg-blue-50/30" : ""
                } ${stage ? "border-l-2 border-l-purple-300" : ""}`}
                onClick={() => markAsRead(n)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm ${
                          !n.is_read ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                      {stage && (
                        <Badge
                          variant="outline"
                          className="text-[9px] text-purple-600 border-purple-200"
                        >
                          Workflow
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {moment(n.createdAt || n.created_date).fromNow()}
                      </span>
                      {n.claim_id && (
                        <Link
                          to={`/claims/${n.claim_id}`}
                          className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Claim <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    title="Remove notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotif(n);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
