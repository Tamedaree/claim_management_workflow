import { useState, useEffect, useCallback } from "react";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import {
  fetchDataAuditLogs,
  fetchAccessLogs,
  fetchClaimTimeline,
} from "../api/auditApi";

const TABS = [
  { id: "changes", label: "Data Changes" },
  { id: "access", label: "Access Logs" },
  { id: "timeline", label: "Claim Timeline" },
];

export default function AuditTrail() {
  const [activeTab, setActiveTab] = useState("changes");

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Audit Trail</h1>
      <p className="text-sm text-gray-500 mb-6">
        Field-level data changes, access logs, and per-claim history.
      </p>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "changes" && <DataChangesTab />}
      {activeTab === "access" && <AccessLogsTab />}
      {activeTab === "timeline" && <ClaimTimelineTab />}
    </div>
  );
}

// ---------------------------------------------------------------------
// Data Changes tab
// ---------------------------------------------------------------------

function DataChangesTab() {
  const [filters, setFilters] = useState({
    entityType: "",
    entityId: "",
    actorId: "",
    from: "",
    to: "",
  });
  const [logs, setLogs] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const { loading, error, run } = useAsync();

  const load = useCallback(() => {
    run(() => fetchDataAuditLogs(filters).then(setLogs));
  }, [filters, run]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <FilterBar>
        <select
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          value={filters.entityType}
          onChange={(e) =>
            setFilters((f) => ({ ...f, entityType: e.target.value }))
          }
        >
          <option value="">All entity types</option>
          <option value="Claim">Claim</option>
          <option value="StaffMember">StaffMember</option>
          <option value="ApprovalThreshold">ApprovalThreshold</option>
          <option value="WorkflowStage">WorkflowStage</option>
          <option value="User">User</option>
        </select>
        <TextInput
          placeholder="Entity ID"
          value={filters.entityId}
          onChange={(v) => setFilters((f) => ({ ...f, entityId: v }))}
        />
        <TextInput
          placeholder="Actor (user) ID"
          value={filters.actorId}
          onChange={(v) => setFilters((f) => ({ ...f, actorId: v }))}
        />
        <DateInput
          value={filters.from}
          onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
          placeholder="From"
        />
        <DateInput
          value={filters.to}
          onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
          placeholder="To"
        />
        <ApplyButton onClick={load} />
      </FilterBar>

      {error && <ErrorBox message={error} />}
      {loading && <LoadingBox />}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto px-4 sm:px-6">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-3 pr-4">When</th>
                  <th className="py-3 pr-4">Entity</th>
                  <th className="py-3 pr-4">Action</th>
                  <th className="py-3 pr-4">Actor</th>
                  <th className="py-3 pr-4">Changed fields</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      No data changes found for these filters.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40"
                      onClick={() =>
                        setExpandedId(expandedId === log.id ? null : log.id)
                      }
                    >
                      <td className="py-3 pr-4 whitespace-nowrap text-gray-600">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-gray-800">
                        {log.entityType}{" "}
                        <span className="text-gray-400">#{log.entityId}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="py-3 pr-4">
                        {log.actorName || log.actorId || "—"}
                        {log.actorRole && (
                          <span className="text-gray-400">
                            {" "}
                            ({log.actorRole})
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {log.changes
                          ? Object.keys(log.changes).join(", ")
                          : "—"}
                      </td>
                    </tr>
                    {expandedId === log.id && log.changes && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="p-4">
                          <ChangesTable changes={log.changes} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Access Logs tab
// ---------------------------------------------------------------------

function AccessLogsTab() {
  const [filters, setFilters] = useState({
    actorId: "",
    path: "",
    action: "",
    from: "",
    to: "",
  });
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const { loading, error, run } = useAsync();

  const load = useCallback(() => {
    run(() => fetchAccessLogs(filters).then(setLogs));
  }, [filters, run]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-2 sm:px-4">
      <FilterBar>
        <TextInput
          placeholder="Actor (user) ID"
          value={filters.actorId}
          onChange={(v) => setFilters((f) => ({ ...f, actorId: v }))}
        />
        <TextInput
          placeholder="Path (e.g. /api/claims/123)"
          value={filters.path}
          onChange={(v) => setFilters((f) => ({ ...f, path: v }))}
        />
        <select
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          value={filters.action}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value }))
          }
        >
          <option value="">All actions</option>
          <option value="LOGIN_SUCCESS">Login success</option>
          <option value="LOGIN_FAILED">Login failed</option>
          <option value="LOGOUT">Logout</option>
          <option value="VIEW_CLAIM">View claim</option>
          <option value="EXPORT">Export</option>
        </select>
        <DateInput
          value={filters.from}
          onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
          placeholder="From"
        />
        <DateInput
          value={filters.to}
          onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
          placeholder="To"
        />
        <ApplyButton onClick={load} />
      </FilterBar>

      {error && <ErrorBox message={error} />}
      {loading && <LoadingBox />}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto px-4 sm:px-6">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Path</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-3 pr-5 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-400">
                      No access logs found for these filters.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="group transition-colors hover:bg-blue-50/40"
                  >
                    <td className="py-3 pr-4 whitespace-nowrap text-gray-600">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-gray-800">
                      {log.actorId || "—"}
                      {log.actorRole && (
                        <span className="text-gray-400">
                          {" "}
                          ({log.actorRole})
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-600">
                      {log.method}
                    </td>
                    <td
                      className="max-w-[280px] truncate py-3 pr-4 font-mono text-xs text-gray-500"
                      title={log.path}
                    >
                      {log.path}
                    </td>
                    <td className="py-3 pr-4">
                      {log.action ? <ActionBadge action={log.action} /> : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          log.statusCode >= 400
                            ? "text-red-600"
                            : "text-gray-600"
                        }
                      >
                        {log.statusCode ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                      {log.ip || "—"}
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-blue-700 opacity-80 transition-colors hover:bg-blue-100 hover:text-blue-800 group-hover:opacity-100"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AccessLogDetailDialog
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}

function AccessLogDetailDialog({ log, onClose }) {
  return (
    <Dialog open={Boolean(log)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-blue-100 bg-blue-50/70 px-6 py-5 pr-14">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Audit event
          </p>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Access log details
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Review the request context and response metadata for this event.
          </p>
        </DialogHeader>
        {log && (
          <dl className="grid grid-cols-1 gap-3 px-6 py-5 text-sm sm:grid-cols-2">
            <DetailItem label="When" value={formatDate(log.createdAt)} />
            <DetailItem label="Actor" value={log.actorId} />
            <DetailItem label="Role" value={log.actorRole} />
            <DetailItem
              label="Action"
              value={log.action}
              valueClassName="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700"
            />
            <DetailItem label="Method" value={log.method} />
            <DetailItem
              label="Status"
              value={log.statusCode}
              valueClassName={
                log.statusCode >= 400
                  ? "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"
                  : "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
              }
            />
            <DetailItem label="IP address" value={log.ip} />
            <DetailItem
              label="Duration"
              value={log.durationMs != null ? `${log.durationMs} ms` : null}
            />
            <DetailItem label="Claim ID" value={log.claimId} />
            <DetailItem label="Request ID" value={log.requestId} />
            <DetailItem label="Path" value={log.path} wide />
            <DetailItem label="User agent" value={log.userAgent} wide />
          </dl>
        )}
        <DialogFooter className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">
          <Button type="button" className="rounded-lg px-5" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value, wide, valueClassName }) {
  return (
    <div
      className={`rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-3 ${wide ? "sm:col-span-2" : ""}`}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
        {label}
      </dt>
      <dd className={`mt-1 break-words text-gray-800 ${valueClassName || ""}`}>
        {formatValue(value)}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------
// Claim Timeline tab
// ---------------------------------------------------------------------

function ClaimTimelineTab() {
  const [claimId, setClaimId] = useState("");
  const [timeline, setTimeline] = useState(null);
  const { loading, error, run } = useAsync();

  const load = () => {
    if (!claimId.trim()) return;
    run(() =>
      fetchClaimTimeline(claimId.trim()).then((data) =>
        setTimeline(data.timeline),
      ),
    );
  };

  return (
    <div>
      <FilterBar>
        <TextInput
          placeholder="Claim ID"
          value={claimId}
          onChange={setClaimId}
        />
        <ApplyButton label="Load timeline" onClick={load} />
      </FilterBar>

      {error && <ErrorBox message={error} />}
      {loading && <LoadingBox />}

      {!loading && !error && timeline && (
        <ol className="relative border-l border-gray-200 ml-2">
          {timeline.length === 0 && (
            <p className="text-gray-400 text-sm py-4">
              No activity recorded for this claim yet.
            </p>
          )}
          {timeline.map((event, i) => (
            <li key={i} className="mb-6 ml-4">
              <span
                className={`absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white ${
                  event.kind === "action"
                    ? "bg-blue-500"
                    : event.kind === "change"
                      ? "bg-amber-500"
                      : "bg-gray-400"
                }`}
              />
              <time className="text-xs text-gray-400">
                {formatDate(event.at)}
              </time>
              <p className="text-sm text-gray-800">
                <span className="font-medium">
                  {event.actorName || event.actorRole || "System"}
                </span>{" "}
                — {event.summary}
              </p>
              {event.kind === "change" && event.raw?.changes && (
                <div className="mt-1">
                  <ChangesTable changes={event.raw.changes} compact />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------
function useAsync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const message =
        err.response?.data?.error || err.message || "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, run };
}

function FilterBar({ children }) {
  return <div className="flex flex-wrap gap-2 mb-4">{children}</div>;
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      className="border border-gray-300 rounded px-3 py-1.5 text-sm w-40"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function DateInput({ value, onChange, placeholder }) {
  return (
    <input
      type="date"
      className="border border-gray-300 rounded px-3 py-1.5 text-sm"
      title={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ApplyButton({ onClick, label = "Apply" }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      {label}
    </button>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded mb-4 border border-red-200">
      {message}
    </div>
  );
}

function LoadingBox() {
  return <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>;
}

function ActionBadge({ action }) {
  const colors = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    LOGIN_SUCCESS: "bg-green-100 text-green-700",
    LOGIN_FAILED: "bg-red-100 text-red-700",
    LOGOUT: "bg-gray-100 text-gray-700",
    VIEW_CLAIM: "bg-purple-100 text-purple-700",
    EXPORT: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${colors[action] || "bg-gray-100 text-gray-700"}`}
    >
      {action}
    </span>
  );
}

function ChangesTable({ changes, compact }) {
  return (
    <table
      className={`border-collapse ${compact ? "text-xs" : "text-sm"} w-full max-w-xl`}
    >
      <thead>
        <tr className="text-left text-gray-400">
          <th className="pr-4 py-1">Field</th>
          <th className="pr-4 py-1">Old</th>
          <th className="pr-4 py-1">New</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(changes).map(
          ([field, { old: oldVal, new: newVal }]) => (
            <tr key={field} className="border-t border-gray-100">
              <td className="pr-4 py-1 font-medium text-gray-700">{field}</td>
              <td className="pr-4 py-1 text-red-600">{formatValue(oldVal)}</td>
              <td className="pr-4 py-1 text-green-600">
                {formatValue(newVal)}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function formatValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}
