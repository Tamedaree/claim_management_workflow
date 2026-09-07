import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Search, UserPlus } from "lucide-react";
import {
  GIO_CASE_REASONS,
  INSURANCE_TYPES,
  ORIGINATING_OFFICE_TYPE_OPTIONS,
  SERVICE_CENTERS,
  DISTRICT_OFFICES,
  KEFLA_AGER_BRANCHES,
  BORDER_BRANCHES,
} from "@/lib/roleConfig";
import {
  registerGioCase,
  generateGioReference,
  fetchExistingClaimants,
} from "@/lib/claimRegistration";
import { useExistingClaimCheck } from "@/hooks/useExistingClaimCheck";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";
import api from "@/api/api";

function officeListForType(type) {
  const key = (type || "").replace(/\s+/g, "_");
  switch (key) {
    case "Service_Center":
      return SERVICE_CENTERS || [];
    case "District_Office":
      return DISTRICT_OFFICES || [];
    case "Kefla_Ager_Branch":
      return KEFLA_AGER_BRANCHES || [];
    case "Border_Branch":
      return BORDER_BRANCHES || [];
    case "Head_Office":
      return ["Head Office"];
    default:
      return [];
  }
}

export default function NewGioCaseForm({ user }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [adjusters, setAdjusters] = useState([]);
  const [claimantMode, setClaimantMode] = useState("new");
  const [existingClaimants, setExistingClaimants] = useState([]);

  // GIO-only duplicate reference check
  const { existingClaim, checking, check, clear } =
    useExistingClaimCheck("GIO_Approval");

  const [form, setForm] = useState({
    claim_reference: generateGioReference(),
    policy_number: "",
    claimant_name: "",
    injured_name: "",
    insurance_type: "Motor",
    cover_type: "",
    plate_number: "",
    claim_amount: "",
    incident_date: "",
    incident_description: "",
    originating_office_type: "Service_Center",
    originating_office: "",
    date_received: "",
    received_reference_number: "",
    assigned_performer_id: "",
    assigned_performer_name: "",
    gio_case_reason: "",
    priority: "Medium",
    due_date: "",
    remarks: "",
  });

  useEffect(() => {
    api
      .get("/users?role=chief_of_gio")
      .then((res) => {
        const list = res.data.data || res.data || [];
        setAdjusters(Array.isArray(list) ? list : []);
      })
      .catch(() => setAdjusters([]));

    fetchExistingClaimants("GIO_Approval")
      .then(setExistingClaimants)
      .catch(() => setExistingClaimants([]));
  }, []);

  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const offices = officeListForType(form.originating_office_type);

  const handlePerformer = (id) => {
    const u = adjusters.find((a) => a.id === id);
    const name =
      u?.full_name ||
      [u?.first_name, u?.middle_name, u?.last_name].filter(Boolean).join(" ") ||
      u?.position_title ||
      u?.email ||
      "";
    setForm((p) => ({
      ...p,
      assigned_performer_id: id,
      assigned_performer_name: name,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.claim_reference?.trim()) {
      toast.error("Case reference is required");
      return;
    }
    if (!form.claimant_name?.trim()) {
      toast.error("Insured name is required");
      return;
    }
    if (!form.insurance_type) {
      toast.error("Insurance type is required");
      return;
    }
    if (!form.incident_date) {
      toast.error("Incident date is required");
      return;
    }
    if (form.claim_amount === "" || Number(form.claim_amount) < 0) {
      toast.error("Valid claim amount is required");
      return;
    }
    if (!form.gio_case_reason) {
      toast.error("Case reason is required");
      return;
    }

    // Block duplicates (GIO only)
    const dup = await check(form.claim_reference);
    if (dup) {
      toast.error(
        `Case reference already exists: ${dup.claim_reference}. Choose another.`,
      );
      return;
    }

    setSaving(true);
    try {
      const created = await registerGioCase(form, user, { asDraft: false });
      toast.success("GIO case registered successfully");
      navigate(`/claims/${created.id}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Registration failed",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Claim identification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Case reference *</Label>
            <Input
              value={form.claim_reference}
              onChange={(e) => {
                set("claim_reference", e.target.value);
                clear();
              }}
              onBlur={(e) => check(e.target.value)}
              className="font-mono"
            />
            {checking && (
              <p className="text-[11px] text-muted-foreground">
                Checking reference…
              </p>
            )}
            {existingClaim && (
              <ExistingClaimAlert
                claim={existingClaim}
                onView={() => navigate(`/claims/${existingClaim.id}`)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Case reason *</Label>
            <Select
              value={form.gio_case_reason || undefined}
              onValueChange={(v) => set("gio_case_reason", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {GIO_CASE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Insured name *</Label>
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setClaimantMode("existing");
                    set("claimant_name", "");
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                    claimantMode === "existing"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Search className="w-3 h-3" /> Existing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClaimantMode("new");
                    set("claimant_name", "");
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                    claimantMode === "new"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <UserPlus className="w-3 h-3" /> New
                </button>
              </div>
            </div>
            {claimantMode === "existing" ? (
              <Select
                value={form.claimant_name || undefined}
                onValueChange={(v) => set("claimant_name", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select existing GIO insured" />
                </SelectTrigger>
                <SelectContent>
                  {existingClaimants.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No previous GIO insured names found
                    </div>
                  ) : (
                    existingClaimants.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.claimant_name}
                onChange={(e) => set("claimant_name", e.target.value)}
                placeholder="Enter insured name"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Injured / beneficiary</Label>
            <Input
              value={form.injured_name}
              onChange={(e) => set("injured_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Insurance type *</Label>
            <Select
              value={form.insurance_type}
              onValueChange={(v) => set("insurance_type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSURANCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Policy number</Label>
            <Input
              value={form.policy_number}
              onChange={(e) => set("policy_number", e.target.value)}
            />
          </div>
          {form.insurance_type === "Motor" && (
            <div className="space-y-1.5">
              <Label>Plate number</Label>
              <Input
                value={form.plate_number}
                onChange={(e) => set("plate_number", e.target.value)}
                placeholder="e.g. AA-12345"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Reserved Claim amount (ETB) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.claim_amount}
              onChange={(e) => set("claim_amount", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Incident date *</Label>
            <Input
              type="date"
              value={form.incident_date}
              onChange={(e) => set("incident_date", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => set("priority", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Low", "Medium", "High", "Urgent"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Incident description</Label>
            <Textarea
              rows={3}
              value={form.incident_description}
              onChange={(e) => set("incident_description", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Routing information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Originating office type</Label>
            <Select
              value={form.originating_office_type}
              onValueChange={(v) => {
                set("originating_office_type", v);
                set("originating_office", "");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGINATING_OFFICE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Originating office</Label>
            <Select
              value={form.originating_office || undefined}
              onValueChange={(v) => set("originating_office", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select office" />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date received</Label>
            <Input
              type="date"
              value={form.date_received}
              onChange={(e) => set("date_received", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Received reference number</Label>
            <Input
              value={form.received_reference_number}
              onChange={(e) => set("received_reference_number", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assigned performer</Label>
            <Select
              value={form.assigned_performer_id || undefined}
              onValueChange={handlePerformer}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Chief of GIO" />
              </SelectTrigger>
              <SelectContent>
                {adjusters.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No Chief of GIO users found. Create one in Admin → Users.
                  </div>
                ) : (
                  adjusters.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ||
                        [u.first_name, u.middle_name, u.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        u.position_title ||
                        u.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Remarks</Label>
            <Textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !!existingClaim || checking}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Register GIO case
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
