import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  FileText,
  MapPin,
  ClipboardCheck,
  Sparkles,
  Info,
} from "lucide-react";
import {
  GIO_CASE_REASONS,
  INSURANCE_TYPES,
  APPROVAL_ORIGINATING_OFFICE_TYPE_OPTIONS,
  DISTRICT_OFFICES,
  MOTOR_VEHICLE_TYPES,
} from "@/lib/roleConfig";
import {
  registerApprovalCase,
  generateApprovalReference,
  fetchExistingClaimants,
} from "@/lib/claimRegistration";
import { useExistingClaimCheck } from "@/hooks/useExistingClaimCheck";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";
import api from "@/api/api";

const REASON_OPTIONS = GIO_CASE_REASONS || [];

function officeListForType(type) {
  const key = (type || "").replace(/\s+/g, "_");
  switch (key) {
    case "District_Office":
      return DISTRICT_OFFICES || [];
    case "Head_Office":
      return ["Head Office"];
    default:
      return [];
  }
}

function StepBadge({ n, color }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}
    >
      {n}
    </div>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-500 mt-1">{message}</p>;
}

function formatReason(r) {
  if (!r) return "";
  if (typeof r === "object")
    return r.label || String(r.value || "").replace(/_/g, " ");
  return String(r).replace(/_/g, " ");
}

function reasonValue(r) {
  if (typeof r === "object") return r.value || r;
  return r;
}

function validateForm(form) {
  const errors = {};

  if (!form.claim_reference?.trim())
    errors.claim_reference = "Case reference is required";

  if (!form.claim_number?.trim())
    errors.claim_number = "Claim number is required";
  else if (form.claim_number.trim().length < 2)
    errors.claim_number = "Enter a valid claim number";

  if (!form.claimant_name?.trim()) {
    errors.claimant_name = "Claimant name is required";
  } else if (form.claimant_name.trim().length < 3) {
    errors.claimant_name = "At least 3 characters";
  } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/.test(form.claimant_name.trim())) {
    errors.claimant_name = "Letters, spaces, hyphens, and apostrophes only";
  }

  if (!form.insurance_type)
    errors.insurance_type = "Insurance type is required";
  if (!form.incident_date) errors.incident_date = "Incident date is required";

  if (form.claim_amount === "" || Number.isNaN(Number(form.claim_amount))) {
    errors.claim_amount = "Valid claim amount is required";
  } else if (Number(form.claim_amount) < 0) {
    errors.claim_amount = "Cannot be negative";
  }

  if (!form.gio_case_reason)
    errors.gio_case_reason = "Approval reason is required";

  if (!form.originating_office?.trim())
    errors.originating_office = "Originating office is required";

  if (form.insurance_type === "Motor" && !form.plate_number?.trim()) {
    errors.plate_number = "Plate number is required for Motor";
  }

  if (form.is_recovery === "yes") {
    if (!form.third_party_name?.trim())
      errors.third_party_name = "Third party name is required";
    if (form.recovery_amount === "")
      errors.recovery_amount = "Recovery amount is required";
  }
  if (form.is_subrogation === "yes") {
    if (!form.subrogation_against?.trim())
      errors.subrogation_against = "Subrogation party is required";
    if (form.amount_to_recover === "")
      errors.amount_to_recover = "Amount to recover is required";
  }
  if (form.is_reinsurance === "yes") {
    if (!form.reinsurer_name?.trim())
      errors.reinsurer_name = "Reinsurer name is required";
    if (form.recoverable_amount === "")
      errors.recoverable_amount = "Recoverable amount is required";
  }

  return errors;
}

function buildPayload(form) {
  const yes = (v) => v === "yes";
  return {
    claim_reference: form.claim_reference.trim(),
    claim_number: form.claim_number.trim(),
    policy_number: form.policy_number?.trim() || null,
    claimant_name: form.claimant_name.trim(),
    injured_name: form.injured_name?.trim() || null,
    insurance_type: form.insurance_type,
    cover_type: form.cover_type || null,
    plate_number:
      form.insurance_type === "Motor"
        ? form.plate_number?.trim() || null
        : null,
    motor_vehicle_type:
      form.insurance_type === "Motor" ? form.motor_vehicle_type || null : null,
    claim_amount: Number(form.claim_amount) || 0,
    incident_date: form.incident_date || null,
    incident_description: form.incident_description || null,
    originating_office_type: form.originating_office_type,
    originating_office: form.originating_office || null,
    date_received: form.notification_received_date || null,
    notification_received_date: form.notification_received_date || null,
    received_reference_number: form.received_reference_number || null,
    assigned_performer_id: form.assigned_performer_id || null,
    assigned_performer_name: form.assigned_performer_name || null,
    gio_case_reason: form.gio_case_reason,
    priority: form.priority || "Medium",
    remarks: form.remarks || null,
    registration_type: "Claim_for_Approval",
    workflow_type: "Claim_Division",
    is_recovery: yes(form.is_recovery),
    is_subrogation: yes(form.is_subrogation),
    is_reinsurance: yes(form.is_reinsurance),
    registration_data: {
      gio_case_reason: form.gio_case_reason,
      third_party_recovery: yes(form.is_recovery)
        ? {
            third_party_name: form.third_party_name,
            third_party_plate_number: form.third_party_plate_number,
            recovery_amount: parseFloat(form.recovery_amount) || 0,
            responsible_party_details: form.responsible_party_details,
          }
        : null,
      subrogation: yes(form.is_subrogation)
        ? {
            subrogation_against: form.subrogation_against,
            responsible_party_contact: form.responsible_party_contact,
            amount_to_recover: parseFloat(form.amount_to_recover) || 0,
            subrogation_description: form.subrogation_description,
          }
        : null,
      reinsurance: yes(form.is_reinsurance)
        ? {
            reinsurer_name: form.reinsurer_name,
            treaty_reference: form.treaty_reference,
            reinsurance_type: form.reinsurance_type,
            recoverable_amount: parseFloat(form.recoverable_amount) || 0,
          }
        : null,
    },
  };
}

const INITIAL = () => ({
  claim_reference:
    typeof generateApprovalReference === "function"
      ? generateApprovalReference()
      : `CAP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
  claim_number: "",
  policy_number: "",
  claimant_name: "",
  injured_name: "",
  insurance_type: "Motor",
  cover_type: "",
  plate_number: "",
  motor_vehicle_type: "",
  claim_amount: "",
  incident_date: "",
  incident_description: "",
  originating_office_type: "District_Office",
  originating_office: "",
  notification_received_date: new Date().toISOString().slice(0, 10),
  received_reference_number: "",
  assigned_performer_id: "",
  assigned_performer_name: "",
  gio_case_reason: "",
  priority: "Medium",
  remarks: "",
  is_recovery: "no",
  is_subrogation: "no",
  is_reinsurance: "no",
  third_party_name: "",
  third_party_plate_number: "",
  recovery_amount: "",
  responsible_party_details: "",
  subrogation_against: "",
  responsible_party_contact: "",
  amount_to_recover: "",
  subrogation_description: "",
  reinsurer_name: "",
  treaty_reference: "",
  reinsurance_type: "Treaty",
  recoverable_amount: "",
});

export default function ClaimForApprovalForm({ user }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [directors, setDirectors] = useState([]);
  const [claimantMode, setClaimantMode] = useState("new");
  const [existingClaimants, setExistingClaimants] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [checkingClaimNo, setCheckingClaimNo] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupClaim, setLookupClaim] = useState(null);
  const [lookupMode, setLookupMode] = useState(null);

  const { existingClaim, checking, check, clear } =
    useExistingClaimCheck("Claim_for_Approval");

  const set = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => {
      if (!p[key]) return p;
      const next = { ...p };
      delete next[key];
      return next;
    });
  };

  const offices = useMemo(
    () => officeListForType(form.originating_office_type),
    [form.originating_office_type],
  );

  const specialHandlingCount = [
    form.is_recovery,
    form.is_subrogation,
    form.is_reinsurance,
  ].filter((v) => v === "yes").length;

  useEffect(() => {
    api
      .get("/users?role=director")
      .then((res) => {
        const list = res.data?.data || res.data || [];
        setDirectors(Array.isArray(list) ? list : []);
      })
      .catch(() => setDirectors([]));

    fetchExistingClaimants?.("Claim_for_Approval")
      ?.then?.(setExistingClaimants)
      ?.catch?.(() => setExistingClaimants([]));
  }, []);

  const handlePerformer = (id) => {
    const u = directors.find((a) => a.id === id);
    const name =
      u?.full_name ||
      [u?.first_name, u?.middle_name, u?.last_name].filter(Boolean).join(" ") ||
      u?.email ||
      "";
    setForm((p) => ({
      ...p,
      assigned_performer_id: id,
      assigned_performer_name: name,
    }));
  };

  const isClaimOpen = (c) => {
    if (!c) return false;
    if (
      ["Closed", "Rejected", "Approved", "Completed", "Claim_Closed"].includes(
        c.status,
      )
    )
      return false;
    if (c.closure_date) return false;
    return true;
  };

  const applyClaimToForm = (latest, { open }) => {
    setForm((p) => ({
      ...p,
      claim_number: (latest.claim_number || p.claim_number || "").trim(),
      claim_reference: open
        ? latest.claim_reference
        : p.claim_reference ||
          (typeof generateApprovalReference === "function"
            ? generateApprovalReference()
            : p.claim_reference),
      policy_number: latest.policy_number || "",
      claimant_name: latest.claimant_name || "",
      injured_name: latest.injured_name || "",
      insurance_type: latest.insurance_type || "Motor",
      cover_type: latest.cover_type || "",
      plate_number: latest.plate_number || "",
      motor_vehicle_type: latest.motor_vehicle_type || "",
      claim_amount:
        latest.claim_amount != null ? String(latest.claim_amount) : "",
      incident_date: latest.incident_date
        ? String(latest.incident_date).slice(0, 10)
        : "",
      incident_description: latest.incident_description || "",
      originating_office_type:
        latest.originating_office_type || "District_Office",
      originating_office: latest.originating_office || "",
      notification_received_date: latest.date_received
        ? String(latest.date_received).slice(0, 10)
        : p.notification_received_date,
      received_reference_number: latest.received_reference_number || "",
      gio_case_reason: open ? latest.gio_case_reason || "" : "",
      priority: latest.priority || "Medium",
      remarks: latest.remarks || "",
      is_recovery: latest.is_recovery ? "yes" : "no",
      is_subrogation: latest.is_subrogation ? "yes" : "no",
      is_reinsurance: latest.is_reinsurance ? "yes" : "no",
      third_party_name:
        latest.registration_data?.third_party_recovery?.third_party_name || "",
      third_party_plate_number:
        latest.registration_data?.third_party_recovery
          ?.third_party_plate_number || "",
      recovery_amount:
        latest.registration_data?.third_party_recovery?.recovery_amount != null
          ? String(
              latest.registration_data.third_party_recovery.recovery_amount,
            )
          : "",
      responsible_party_details:
        latest.registration_data?.third_party_recovery
          ?.responsible_party_details || "",
      subrogation_against:
        latest.registration_data?.subrogation?.subrogation_against || "",
      amount_to_recover:
        latest.registration_data?.subrogation?.amount_to_recover != null
          ? String(latest.registration_data.subrogation.amount_to_recover)
          : "",
      subrogation_description:
        latest.registration_data?.subrogation?.subrogation_description || "",
      reinsurer_name:
        latest.registration_data?.reinsurance?.reinsurer_name || "",
      treaty_reference:
        latest.registration_data?.reinsurance?.treaty_reference || "",
      reinsurance_type:
        latest.registration_data?.reinsurance?.reinsurance_type || "Treaty",
      recoverable_amount:
        latest.registration_data?.reinsurance?.recoverable_amount != null
          ? String(latest.registration_data.reinsurance.recoverable_amount)
          : "",
    }));
  };

  const handleClaimNumberBlur = async () => {
    const n = form.claim_number?.trim();
    if (!n) {
      setLookupClaim(null);
      setLookupMode(null);
      return;
    }
    setCheckingClaimNo(true);
    try {
      const res = await api.get(
        `/claims?claim_number=${encodeURIComponent(n)}&limit=20`,
      );
      const list = res.data?.data || [];
      if (!list.length) {
        setLookupClaim(null);
        setLookupMode(null);
        return;
      }
      const latest = list[0];
      const open = list.some(isClaimOpen);
      applyClaimToForm(latest, { open });
      setLookupClaim(latest);
      setLookupMode(open ? "open" : "reuse");
      setLookupOpen(true);
    } catch {
      toast.error("Could not look up claim number");
    } finally {
      setCheckingClaimNo(false);
    }
  };

  const register = async () => {
    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});

    if (typeof check === "function") {
      const dup = await check(form.claim_reference);
      if (dup) {
        toast.error(`Case reference already exists: ${dup.claim_reference}`);
        return;
      }
    }

    setSaving(true);
    try {
      const created = await registerApprovalCase(buildPayload(form), user, {
        asDraft: false,
      });
      toast.success("Claim for Approval registered");
      navigate(`/claims/${created.id}`);
    } catch (e) {
      toast.error(
        e.response?.data?.message || e.message || "Registration failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleContinueFromLookup = async () => {
    if (!form.gio_case_reason) {
      setErrors((p) => ({
        ...p,
        gio_case_reason: "Approval reason is required",
      }));
      toast.error("Approval reason is required");
      return;
    }
    if (lookupMode === "open" && lookupClaim?.id) {
      setSaving(true);
      try {
        await api.put(`/claims/${lookupClaim.id}`, {
          claimant_name: form.claimant_name,
          injured_name: form.injured_name || null,
          policy_number: form.policy_number || null,
          plate_number: form.plate_number || null,
          claim_amount: Number(form.claim_amount) || 0,
          incident_description: form.incident_description || null,
          remarks: form.remarks || null,
          priority: form.priority,
          gio_case_reason: form.gio_case_reason || undefined,
        });
        setLookupOpen(false);
        toast.success("Updated existing case");
        navigate(`/claims/${lookupClaim.id}`);
      } catch (e) {
        toast.error(e.response?.data?.message || "Update failed");
      } finally {
        setSaving(false);
      }
      return;
    }
    setLookupOpen(false);
    await register();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    register();
  };

  const YesNo = ({ value, onChange }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-28 h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="no">No</SelectItem>
        <SelectItem value="yes">Yes</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-sm bg-background/80 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Claim for Approval
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {form.claim_reference || "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {form.priority && (
            <Badge
              variant="secondary"
              className={`text-[10px] ${
                form.priority === "Urgent"
                  ? "bg-red-100 text-red-700"
                  : form.priority === "High"
                    ? "bg-orange-100 text-orange-700"
                    : form.priority === "Medium"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
              }`}
            >
              {form.priority} priority
            </Badge>
          )}
          {specialHandlingCount > 0 && (
            <Badge className="text-[10px] bg-violet-100 text-violet-700">
              <Sparkles className="w-3 h-3 mr-1" />
              {specialHandlingCount} special condition
              {specialHandlingCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Step 1 */}
      <Card className="border-0 shadow-sm border-l-4 border-l-blue-500 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2.5">
            <StepBadge n="1" color="bg-blue-100 text-blue-700" />
            <FileText className="w-4 h-4 text-blue-600" />
            Claim identification
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-medium">
              Case reference <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.claim_reference}
              onChange={(e) => {
                set("claim_reference", e.target.value);
                clear?.();
              }}
              onBlur={(e) => check?.(e.target.value)}
              className={`font-mono h-11 ${
                errors.claim_reference
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }`}
            />
            <FieldError message={errors.claim_reference} />
            {checking && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking…
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
            <Label className="text-xs font-medium">
              Claim number <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.claim_number}
              onChange={(e) => set("claim_number", e.target.value)}
              onBlur={handleClaimNumberBlur}
              placeholder="Business claim number"
              className={`font-mono h-11 ${
                errors.claim_number
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }`}
            />
            <FieldError message={errors.claim_number} />
            {checkingClaimNo && (
              <p className="text-[11px] text-muted-foreground">Looking up…</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Approval reason <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.gio_case_reason || undefined}
              onValueChange={(v) => set("gio_case_reason", v)}
            >
              <SelectTrigger
                className={`h-11 ${
                  errors.gio_case_reason
                    ? "border-red-500 ring-1 ring-red-500"
                    : ""
                }`}
              >
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((r) => (
                  <SelectItem key={reasonValue(r)} value={reasonValue(r)}>
                    {formatReason(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.gio_case_reason} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                Insured / claimant name <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-1 border rounded-lg p-0.5">
                {["new", "existing"].map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={claimantMode === m ? "default" : "ghost"}
                    className="h-7 text-xs capitalize"
                    onClick={() => setClaimantMode(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
            {claimantMode === "existing" && existingClaimants?.length > 0 ? (
              <Select
                value={form.claimant_name || undefined}
                onValueChange={(v) => set("claimant_name", v)}
              >
                <SelectTrigger
                  className={`h-11 ${
                    errors.claimant_name ? "border-red-500" : ""
                  }`}
                >
                  <SelectValue placeholder="Select claimant" />
                </SelectTrigger>
                <SelectContent>
                  {existingClaimants.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className={`h-11 ${
                  errors.claimant_name
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
                value={form.claimant_name}
                onChange={(e) => set("claimant_name", e.target.value)}
              />
            )}
            <FieldError message={errors.claimant_name} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Policy number</Label>
            <Input
              className="h-11"
              value={form.policy_number}
              onChange={(e) => set("policy_number", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Class of business <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.insurance_type || undefined}
              onValueChange={(v) => set("insurance_type", v)}
            >
              <SelectTrigger
                className={`h-11 ${
                  errors.insurance_type ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {(INSURANCE_TYPES || []).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.insurance_type} />
          </div>

          {form.insurance_type === "Motor" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Plate number <span className="text-red-500">*</span>
                </Label>
                <Input
                  className={`h-11 font-mono ${
                    errors.plate_number ? "border-red-500" : ""
                  }`}
                  value={form.plate_number}
                  onChange={(e) => set("plate_number", e.target.value)}
                />
                <FieldError message={errors.plate_number} />
              </div>
              {(MOTOR_VEHICLE_TYPES || []).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Vehicle type</Label>
                  <Select
                    value={form.motor_vehicle_type || undefined}
                    onValueChange={(v) => set("motor_vehicle_type", v)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTOR_VEHICLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Claim amount (ETB) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              className={`h-11 ${errors.claim_amount ? "border-red-500" : ""}`}
              value={form.claim_amount}
              onChange={(e) => set("claim_amount", e.target.value)}
            />
            <FieldError message={errors.claim_amount} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Incident date <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              className={`h-11 ${errors.incident_date ? "border-red-500" : ""}`}
              value={form.incident_date}
              onChange={(e) => set("incident_date", e.target.value)}
            />
            <FieldError message={errors.incident_date} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => set("priority", v)}
            >
              <SelectTrigger className="h-11">
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
            <Label className="text-xs font-medium">Incident description</Label>
            <Textarea
              rows={3}
              value={form.incident_description}
              onChange={(e) => set("incident_description", e.target.value)}
              placeholder="What happened…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card className="border-0 shadow-sm border-l-4 border-l-amber-500 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2.5">
            <StepBadge n="2" color="bg-amber-100 text-amber-700" />
            <MapPin className="w-4 h-4 text-amber-600" />
            Routing (District / Branch)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Originating office type
            </Label>
            <Select
              value={form.originating_office_type}
              onValueChange={(v) => {
                set("originating_office_type", v);
                set("originating_office", "");
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(APPROVAL_ORIGINATING_OFFICE_TYPE_OPTIONS || []).map((o) => (
                  <SelectItem key={o.value || o} value={o.value || o}>
                    {o.label || String(o).replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Originating office <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.originating_office || undefined}
              onValueChange={(v) => set("originating_office", v)}
            >
              <SelectTrigger
                className={`h-11 ${
                  errors.originating_office ? "border-red-500" : ""
                }`}
              >
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
            <FieldError message={errors.originating_office} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Notification received date
            </Label>
            <Input
              type="date"
              className="h-11"
              value={form.notification_received_date}
              onChange={(e) =>
                set("notification_received_date", e.target.value)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Received reference number
            </Label>
            <Input
              className="h-11"
              value={form.received_reference_number}
              onChange={(e) => set("received_reference_number", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-medium">
              Assign Director (optional)
            </Label>
            <Select
              value={form.assigned_performer_id || undefined}
              onValueChange={handlePerformer}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select Director for next stage" />
              </SelectTrigger>
              <SelectContent>
                {directors.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No Director users found.
                  </div>
                ) : (
                  directors.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ||
                        [u.first_name, u.middle_name, u.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        u.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Remarks</Label>
            <Textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card className="border-0 shadow-sm border-l-4 border-l-violet-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2.5">
            <StepBadge n="3" color="bg-violet-100 text-violet-700" />
            <Sparkles className="w-4 h-4 text-violet-600" />
            Recovery / special handling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              key: "is_recovery",
              label: "Third party recovery?",
              body: form.is_recovery === "yes" && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Third party name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      className={
                        errors.third_party_name ? "border-red-500" : ""
                      }
                      value={form.third_party_name}
                      onChange={(e) => set("third_party_name", e.target.value)}
                    />
                    <FieldError message={errors.third_party_name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Plate</Label>
                    <Input
                      value={form.third_party_plate_number}
                      onChange={(e) =>
                        set("third_party_plate_number", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Recovery amount <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      className={errors.recovery_amount ? "border-red-500" : ""}
                      value={form.recovery_amount}
                      onChange={(e) => set("recovery_amount", e.target.value)}
                    />
                    <FieldError message={errors.recovery_amount} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Details</Label>
                    <Textarea
                      rows={2}
                      value={form.responsible_party_details}
                      onChange={(e) =>
                        set("responsible_party_details", e.target.value)
                      }
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "is_subrogation",
              label: "Subrogation?",
              body: form.is_subrogation === "yes" && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Against <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      className={
                        errors.subrogation_against ? "border-red-500" : ""
                      }
                      value={form.subrogation_against}
                      onChange={(e) =>
                        set("subrogation_against", e.target.value)
                      }
                    />
                    <FieldError message={errors.subrogation_against} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contact</Label>
                    <Input
                      value={form.responsible_party_contact}
                      onChange={(e) =>
                        set("responsible_party_contact", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Amount <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      className={
                        errors.amount_to_recover ? "border-red-500" : ""
                      }
                      value={form.amount_to_recover}
                      onChange={(e) => set("amount_to_recover", e.target.value)}
                    />
                    <FieldError message={errors.amount_to_recover} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      rows={2}
                      value={form.subrogation_description}
                      onChange={(e) =>
                        set("subrogation_description", e.target.value)
                      }
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "is_reinsurance",
              label: "Reinsurance?",
              body: form.is_reinsurance === "yes" && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Reinsurer <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      className={errors.reinsurer_name ? "border-red-500" : ""}
                      value={form.reinsurer_name}
                      onChange={(e) => set("reinsurer_name", e.target.value)}
                    />
                    <FieldError message={errors.reinsurer_name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Treaty ref</Label>
                    <Input
                      value={form.treaty_reference}
                      onChange={(e) => set("treaty_reference", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={form.reinsurance_type}
                      onValueChange={(v) => set("reinsurance_type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Treaty">Treaty</SelectItem>
                        <SelectItem value="Facultative">Facultative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Recoverable <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      className={
                        errors.recoverable_amount ? "border-red-500" : ""
                      }
                      value={form.recoverable_amount}
                      onChange={(e) =>
                        set("recoverable_amount", e.target.value)
                      }
                    />
                    <FieldError message={errors.recoverable_amount} />
                  </div>
                </div>
              ),
            },
          ].map((block) => (
            <div
              key={block.key}
              className="rounded-lg border border-border/70 overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 bg-muted/30">
                <Label className="text-sm font-medium">{block.label}</Label>
                <YesNo
                  value={form[block.key]}
                  onChange={(v) => set(block.key, v)}
                />
              </div>
              {block.body}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-xl bg-muted/40 border">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Registers under Claim Approval workflow → Director Assignment next.
        </p>
        <Button
          type="submit"
          disabled={saving || !!existingClaim || checking}
          className="gap-2 h-11 px-6"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Registering…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Register & forward
            </>
          )}
        </Button>
      </div>

      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {lookupMode === "open"
                ? "Existing open case"
                : "Previous case — register new"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            From{" "}
            <span className="font-mono">{lookupClaim?.claim_reference}</span>
            {lookupClaim?.workflow_type === "GIO_Approval" && " (GIO)"}
            {lookupClaim?.registration_type === "Claim_for_Approval" &&
              " (Claim for Approval)"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Insured</Label>
              <Input
                value={form.claimant_name}
                onChange={(e) => set("claimant_name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Approval reason *</Label>
              <Select
                value={form.gio_case_reason || undefined}
                onValueChange={(v) => set("gio_case_reason", v)}
              >
                <SelectTrigger
                  className={
                    errors.gio_case_reason
                      ? "border-red-500 ring-1 ring-red-500"
                      : ""
                  }
                >
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((r) => (
                    <SelectItem key={reasonValue(r)} value={reasonValue(r)}>
                      {formatReason(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.gio_case_reason} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Policy</Label>
              <Input
                value={form.policy_number}
                onChange={(e) => set("policy_number", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                value={form.claim_amount}
                onChange={(e) => set("claim_amount", e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Remarks</Label>
              <Textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLookupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleContinueFromLookup} disabled={saving}>
              {saving
                ? "Saving…"
                : lookupMode === "open"
                  ? "Save & open"
                  : "Register new approval case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
