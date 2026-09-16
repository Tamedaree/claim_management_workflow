import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Settings,
  ShieldCheck,
  Info,
  FileText,
  Lock,
  Save,
  Building2,
  Globe,
  Clock,
  CircleDollarSign,
  Image as ImageIcon,
  Activity,
  History,
  KeyRound,
  UserCog,
  ShieldAlert,
  BellRing,
  ChevronRight,
} from "lucide-react";

const DOC_TYPE_OPTIONS = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx"];

const NAV_ITEMS = [
  {
    id: "audit",
    label: "Audit Configuration",
    icon: ShieldCheck,
    color: "text-blue-600 bg-blue-50",
  },
  {
    id: "system",
    label: "System Information",
    icon: Info,
    color: "text-violet-600 bg-violet-50",
  },
  {
    id: "documents",
    label: "Document Settings",
    icon: FileText,
    color: "text-amber-600 bg-amber-50",
  },
  {
    id: "security",
    label: "Security",
    icon: Lock,
    color: "text-red-600 bg-red-50",
  },
];

export default function SystemSettings() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("audit");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/settings");
        if (!cancelled) setSettings(res.data.data);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load settings.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const toggleDocType = (type) => {
    setSettings((s) => {
      const has = s.doc_allowed_types.includes(type);
      return {
        ...s,
        doc_allowed_types: has
          ? s.doc_allowed_types.filter((t) => t !== type)
          : [...s.doc_allowed_types, type],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put("/settings", settings);
      setSettings(res.data.data);
      toast({ title: "Settings saved", duration: 3000 });
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-0 shadow-lg max-w-md w-full mx-4">
          <CardContent className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-medium">Restricted area</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Only System Administrators can access System Settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find((n) => n.id === activeTab);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-3 backdrop-blur-sm bg-background/85">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm shrink-0">
              <Settings className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-tight">
                System Settings
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit, system, document &amp; security configuration
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Mobile pill nav */}
      <div className="lg:hidden -mx-1 px-1 overflow-x-auto">
        <div className="flex gap-2 w-max">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === item.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Desktop sidebar nav */}
        <div className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  activeTab === item.id
                    ? "bg-white shadow-sm border border-border/60 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    activeTab === item.id
                      ? item.color
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-opacity ${
                    activeTab === item.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-40"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 space-y-6">
          {/* ================= AUDIT ================= */}
          {activeTab === "audit" && (
            <>
              <SectionHeader
                icon={activeItem.icon}
                color={activeItem.color}
                title="Audit Configuration"
                desc="Control what's recorded in the system's audit trail"
              />

              <SettingsCard>
                <ToggleRow
                  icon={Activity}
                  label="Enable audit logging"
                  desc="Master switch for all audit trail recording"
                  checked={settings.audit_enabled}
                  onChange={(v) => set("audit_enabled", v)}
                  highlight
                />
                <Divider />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    icon={History}
                    label="Retention Period"
                    suffix="days"
                    value={settings.audit_retention_days}
                    onChange={(v) => set("audit_retention_days", v)}
                  />
                </div>
              </SettingsCard>

              <SettingsCard title="Events Logged">
                <ToggleRow
                  label="Login / logout tracking"
                  checked={settings.audit_track_login_logout}
                  onChange={(v) => set("audit_track_login_logout", v)}
                />
                <ToggleRow
                  label="Claim workflow action tracking"
                  checked={settings.audit_track_claim_actions}
                  onChange={(v) => set("audit_track_claim_actions", v)}
                />
                <ToggleRow
                  label="GIO workflow action tracking"
                  checked={settings.audit_track_gio_actions}
                  onChange={(v) => set("audit_track_gio_actions", v)}
                />
                <ToggleRow
                  label="User / account action tracking"
                  checked={settings.audit_track_user_actions}
                  onChange={(v) => set("audit_track_user_actions", v)}
                />
                <ToggleRow
                  label="Document action tracking"
                  checked={settings.audit_track_document_actions}
                  onChange={(v) => set("audit_track_document_actions", v)}
                />
                <ToggleRow
                  label="System settings change tracking"
                  checked={settings.audit_track_settings_changes}
                  onChange={(v) => set("audit_track_settings_changes", v)}
                  last
                />
              </SettingsCard>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900">
                    Append-only by design
                  </p>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    Audit logs are read-only. There is no option to clear,
                    delete, or edit recorded events — this is intentional and
                    cannot be changed here. Export is currently limited to Admin
                    accounts.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ================= SYSTEM INFO ================= */}
          {activeTab === "system" && (
            <>
              <SectionHeader
                icon={activeItem.icon}
                color={activeItem.color}
                title="System Information"
                desc="Organization identity, locale, and application metadata"
              />

              <SettingsCard title="Identity">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    icon={Settings}
                    label="System Name"
                    value={settings.system_name}
                    onChange={(v) => set("system_name", v)}
                  />
                  <TextField
                    icon={Building2}
                    label="Organization Name"
                    value={settings.organization_name}
                    onChange={(v) => set("organization_name", v)}
                  />
                  <TextField
                    icon={ImageIcon}
                    label="System Version"
                    value={settings.system_version}
                    onChange={(v) => set("system_version", v)}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                      Environment
                    </Label>
                    <Select
                      value={settings.environment}
                      onValueChange={(v) => set("environment", v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Development">Development</SelectItem>
                        <SelectItem value="Production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title="Locale & Format">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    icon={Clock}
                    label="Time Zone"
                    value={settings.timezone}
                    onChange={(v) => set("timezone", v)}
                  />
                  <TextField
                    icon={CircleDollarSign}
                    label="Default Currency"
                    value={settings.default_currency}
                    onChange={(v) => set("default_currency", v)}
                  />
                  <TextField
                    label="Date Format"
                    value={settings.date_format}
                    onChange={(v) => set("date_format", v)}
                  />
                  <TextField
                    label="Time Format"
                    value={settings.time_format}
                    onChange={(v) => set("time_format", v)}
                  />
                </div>
              </SettingsCard>

              <SettingsCard title="Status">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Application Status
                    </Label>
                    <Select
                      value={settings.application_status}
                      onValueChange={(v) => set("application_status", v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground h-10">
                    <History className="w-3.5 h-3.5 shrink-0" />
                    Last update:{" "}
                    <span className="font-medium text-foreground">
                      {settings.last_system_update
                        ? new Date(settings.last_system_update).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                </div>
              </SettingsCard>
            </>
          )}

          {/* ================= DOCUMENTS ================= */}
          {activeTab === "documents" && (
            <>
              <SectionHeader
                icon={activeItem.icon}
                color={activeItem.color}
                title="Document Settings"
                desc="Upload limits, allowed formats, and document permissions"
              />

              <SettingsCard title="Upload Limits">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Maximum Upload Size"
                    suffix="MB"
                    value={settings.doc_max_upload_mb}
                    onChange={(v) => set("doc_max_upload_mb", v)}
                  />
                  <NumberField
                    label="Max Files Per Submission"
                    value={settings.doc_max_files_per_submission}
                    onChange={(v) => set("doc_max_files_per_submission", v)}
                  />
                </div>
              </SettingsCard>

              <SettingsCard title="Allowed File Types">
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPE_OPTIONS.map((t) => {
                    const active = settings.doc_allowed_types.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleDocType(t)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-white text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        .{t}
                      </button>
                    );
                  })}
                </div>
                <Divider />
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Document Categories
                  </Label>
                  <Input
                    className="h-10"
                    value={settings.doc_categories.join(", ")}
                    onChange={(e) =>
                      set(
                        "doc_categories",
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Comma-separated list
                  </p>
                </div>
              </SettingsCard>

              <SettingsCard title="Permissions">
                <ToggleRow
                  label="Enable document replacement"
                  checked={settings.doc_allow_replace}
                  onChange={(v) => set("doc_allow_replace", v)}
                />
                <ToggleRow
                  label="Enable document download"
                  checked={settings.doc_allow_download}
                  onChange={(v) => set("doc_allow_download", v)}
                />
                <ToggleRow
                  label="Enable document deletion"
                  checked={settings.doc_allow_delete}
                  onChange={(v) => set("doc_allow_delete", v)}
                />
                <ToggleRow
                  label="Require remarks when replacing/deleting documents"
                  checked={settings.doc_require_remarks_on_change}
                  onChange={(v) => set("doc_require_remarks_on_change", v)}
                  last
                />
              </SettingsCard>
            </>
          )}

          {/* ================= SECURITY ================= */}
          {activeTab === "security" && (
            <>
              <SectionHeader
                icon={activeItem.icon}
                color={activeItem.color}
                title="Security"
                desc="Authentication policy, lockout rules, and session behavior"
              />

              <SettingsCard title="Password Policy">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    icon={KeyRound}
                    label="Minimum Password Length"
                    value={settings.sec_min_password_length}
                    onChange={(v) => set("sec_min_password_length", v)}
                  />
                  <NumberField
                    icon={History}
                    label="Prevent Reuse of Last N Passwords"
                    value={settings.sec_prevent_password_reuse_count}
                    onChange={(v) => set("sec_prevent_password_reuse_count", v)}
                  />
                </div>
                <Divider />
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Complexity requirements
                </p>
                <ToggleRow
                  label="Require uppercase letter"
                  checked={settings.sec_require_uppercase}
                  onChange={(v) => set("sec_require_uppercase", v)}
                />
                <ToggleRow
                  label="Require number"
                  checked={settings.sec_require_number}
                  onChange={(v) => set("sec_require_number", v)}
                />
                <ToggleRow
                  label="Require special character"
                  checked={settings.sec_require_special_char}
                  onChange={(v) => set("sec_require_special_char", v)}
                  last
                />
              </SettingsCard>

              <SettingsCard title="Login & Lockout">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    icon={ShieldAlert}
                    label="Max Failed Login Attempts"
                    value={settings.sec_max_failed_attempts}
                    onChange={(v) => set("sec_max_failed_attempts", v)}
                  />
                  <NumberField
                    icon={Lock}
                    label="Account Lockout Duration"
                    suffix="min"
                    value={settings.sec_lockout_minutes}
                    onChange={(v) => set("sec_lockout_minutes", v)}
                  />
                </div>
              </SettingsCard>

              <SettingsCard title="Sessions">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    icon={KeyRound}
                    label="Access Token Expiration"
                    suffix="min"
                    value={settings.sec_jwt_expiry_minutes}
                    onChange={(v) => set("sec_jwt_expiry_minutes", v)}
                  />
                  <NumberField
                    icon={Clock}
                    label="Session Expiration"
                    suffix="hrs"
                    value={settings.sec_session_expiry_hours}
                    onChange={(v) => set("sec_session_expiry_hours", v)}
                  />
                  <NumberField
                    icon={Clock}
                    label="Auto-Logout After Inactivity"
                    suffix="min"
                    value={settings.sec_auto_logout_minutes}
                    onChange={(v) => set("sec_auto_logout_minutes", v)}
                  />
                </div>
              </SettingsCard>

              <SettingsCard title="Account Policy">
                <ToggleRow
                  icon={UserCog}
                  label="Require password change for newly created accounts"
                  checked={settings.sec_require_password_change_new_account}
                  onChange={(v) =>
                    set("sec_require_password_change_new_account", v)
                  }
                />
                <ToggleRow
                  icon={BellRing}
                  label="Enable security notifications"
                  checked={settings.sec_enable_security_notifications}
                  onChange={(v) => set("sec_enable_security_notifications", v)}
                  last
                />
              </SettingsCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- presentational helpers (no logic, layout only) ---------- */

function SectionHeader({ icon: Icon, color, title, desc }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function SettingsCard({ title, children }) {
  return (
    <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {title && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function Divider() {
  return <div className="h-px bg-border/60 -mx-5" />;
}

function ToggleRow({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
  highlight,
  last,
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-2.5 ${
        !last ? "border-b border-border/50" : ""
      } ${highlight ? "-mx-1 px-1" : ""}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {desc && (
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="shrink-0"
      />
    </div>
  );
}

function TextField({ icon: Icon, label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        {label}
      </Label>
      <Input
        className="h-10"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberField({ icon: Icon, label, suffix, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          className="h-10"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
