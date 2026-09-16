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
  ShieldAlert,
  Sparkles,
  Info,
} from "lucide-react";
import {
  GIO_CASE_REASONS,
  INSURANCE_TYPES,
  ORIGINATING_OFFICE_TYPE_OPTIONS,
  SERVICE_CENTERS,
  DISTRICT_OFFICES,
  KEFLA_AGER_BRANCHES,
  MOTOR_VEHICLE_TYPES,
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

/** Small inline error message shown beneath an input */
function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-500 mt-1">{message}</p>;
}

/** Returns an object of { fieldKey: errorMessage } for every invalid field */
function validateForm(form) {
  const errors = {};
  const e = {};

  if (!form.claim_reference?.trim())
    errors.claim_reference = "Case reference is required";
  if (!form.claim_number?.trim()) e.claim_number = "Required";
  else if (form.claim_number.trim().length < 2) {
    e.claim_number = "Enter a valid claim number";
  }
  if (!form.claimant_name?.trim()) {
    errors.claimant_name = "Claimant name is required";
  } else if (form.claimant_name.trim().length < 3) {
    errors.claimant_name = "Claimant name must contain at least 3 characters";
  } else if (form.claimant_name.trim().length > 150) {
    errors.claimant_name = "Claimant name must not exceed 150 characters";
  } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/.test(form.claimant_name.trim())) {
    errors.claimant_name =
      "Claimant name may contain only letters, spaces, hyphens, and apostrophes";
  }
  if (!form.insurance_type)
    errors.insurance_type = "Insurance type is required";
  if (!form.incident_date) errors.incident_date = "Incident date is required";

  if (form.claim_amount === "" || Number.isNaN(Number(form.claim_amount))) {
    errors.claim_amount = "Valid claim amount is required";
  } else if (Number(form.claim_amount) < 0) {
    errors.claim_amount = "Claim amount cannot be negative";
  }

  if (!form.gio_case_reason) errors.gio_case_reason = "Case reason is required";

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
  if (form.is_rebid === "yes" && !form.rebid_winner_garage?.trim()) {
    errors.rebid_winner_garage = "Winner garage is required when rebid is Yes";
  }
  if (
    form.has_independent_assessor === "yes" &&
    !form.independent_assessor_name?.trim()
  ) {
    errors.independent_assessor_name = "Independent assessor name is required";
  }

  return errors;
}

function buildPayload(form) {
  const yes = (v) => v === "yes";
  return {
    ...form,
    garage_name: form.garage_name?.trim() || null,
    is_recovery: yes(form.is_recovery),
    is_subrogation: yes(form.is_subrogation),
    is_reinsurance: yes(form.is_reinsurance),
    is_rebid: yes(form.is_rebid),
    has_independent_assessor: yes(form.has_independent_assessor),
    final_approval_amount:
      form.final_approval_amount !== ""
        ? Number(form.final_approval_amount)
        : null,
    rebid_participating_garages: yes(form.is_rebid)
      ? form.rebid_participating_garages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    rebid_winner_garage: yes(form.is_rebid)
      ? form.rebid_winner_garage || null
      : null,
    independent_assessor_name: yes(form.has_independent_assessor)
      ? form.independent_assessor_name || null
      : null,
    motor_vehicle_type:
      form.insurance_type === "Motor" ? form.motor_vehicle_type || null : null,
    registration_data: {
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
  claim_reference: generateGioReference(),
  claim_number: "",
  policy_number: "",
  claimant_name: "",
  injured_name: "",
  insurance_type: "Motor",
  cover_type: "",
  plate_number: "",
  motor_vehicle_type: "",
  claim_amount: "",
  final_approval_amount: "",
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
  garage_name: "",
  is_recovery: "no",
  is_subrogation: "no",
  is_reinsurance: "no",
  is_rebid: "no",
  has_independent_assessor: "no",
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
  rebid_participating_garages: "",
  rebid_winner_garage: "",
  independent_assessor_name: "",
});

export default function NewGioCaseForm({ user }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [adjusters, setAdjusters] = useState([]);
  const [claimantMode, setClaimantMode] = useState("new");
  const [existingClaimants, setExistingClaimants] = useState([]);
  const [checkingClaimNo, setCheckingClaimNo] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupClaim, setLookupClaim] = useState(null);
  const [lookupMode, setLookupMode] = useState(null);
  const [garageMode, setGarageMode] = useState("new");
  const [garages, setGarages] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});

  const { existingClaim, checking, check, clear } =
    useExistingClaimCheck("GIO_Approval");

  const set = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    // Clear this field's error as soon as the user changes it
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
    form.is_rebid,
    form.has_independent_assessor,
  ].filter((v) => v === "yes").length;

  useEffect(() => {
    api
      .get("/users?role=director")
      .then((res) => {
        const list = res.data.data || res.data || [];
        setAdjusters(Array.isArray(list) ? list : []);
      })
      .catch(() => setAdjusters([]));

    api
      .get("/garages")
      .then((res) => setGarages(res.data.data || []))
      .catch(() => setGarages([]));

    fetchExistingClaimants("GIO_Approval")
      .then(setExistingClaimants)
      .catch(() => setExistingClaimants([]));
  }, []);

  const handlePerformer = (id) => {
    const u = adjusters.find((a) => a.id === id);
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
    if (["Closed", "Rejected", "Approved", "Completed"].includes(c.status))
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
        : p.claim_reference || generateGioReference(),
      policy_number: latest.policy_number || "",
      claimant_name: latest.claimant_name || "",
      injured_name: latest.injured_name || "",
      insurance_type: latest.insurance_type || "Motor",
      cover_type: latest.cover_type || "",
      plate_number: latest.plate_number || "",
      motor_vehicle_type: latest.motor_vehicle_type || "",
      claim_amount:
        latest.claim_amount != null ? String(latest.claim_amount) : "",
      final_approval_amount:
        latest.final_approval_amount != null
          ? String(latest.final_approval_amount)
          : "",
      incident_date: latest.incident_date
        ? String(latest.incident_date).slice(0, 10)
        : "",
      incident_description: latest.incident_description || "",
      originating_office_type:
        latest.originating_office_type || "Service_Center",
      originating_office: latest.originating_office || "",
      date_received: latest.date_received
        ? String(latest.date_received).slice(0, 10)
        : "",
      received_reference_number: latest.received_reference_number || "",
      gio_case_reason: open ? latest.gio_case_reason || "" : "",
      priority: latest.priority || "Medium",
      remarks: latest.remarks || "",
      garage_name: latest.garage_name || "",
      is_recovery: latest.is_recovery ? "yes" : "no",
      is_subrogation: latest.is_subrogation ? "yes" : "no",
      is_reinsurance: latest.is_reinsurance ? "yes" : "no",
      is_rebid: latest.is_rebid ? "yes" : "no",
      has_independent_assessor: latest.has_independent_assessor ? "yes" : "no",
      independent_assessor_name: latest.independent_assessor_name || "",
      rebid_winner_garage: latest.rebid_winner_garage || "",
      rebid_participating_garages: Array.isArray(
        latest.rebid_participating_garages,
      )
        ? latest.rebid_participating_garages.join(", ")
        : "",
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
    }));
    if (latest.garage_name) setGarageMode("existing");
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

    const dup = await check(form.claim_reference);
    if (dup) {
      toast.error(`Case reference already exists: ${dup.claim_reference}`);
      return;
    }
    setSaving(true);
    try {
      const created = await registerGioCase(buildPayload(form), user, {
        asDraft: false,
      });
      if (form.garage_name?.trim()) {
        api
          .get("/garages")
          .then((r) => setGarages(r.data.data || []))
          .catch(() => {});
      }
      toast.success("GIO case registered successfully");
      navigate(`/claims/${created.id}`);
    } catch (e) {
      toast.error(
        e.response?.data?.message || e.message || "Registration failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    register();
  };

  const handleContinueFromLookup = async () => {
    if (!form.gio_case_reason) {
      setErrors((p) => ({ ...p, gio_case_reason: "Case reason is required" }));
      toast.error("Case reason is required");
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
          garage_name: form.garage_name?.trim() || null,
          claim_amount: Number(form.claim_amount) || 0,
          incident_description: form.incident_description || null,
          remarks: form.remarks || null,
          priority: form.priority,
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
      {/* Sticky header strip — reference + live status, purely presentational */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-sm bg-background/80 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4.5 h-4.5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">New GIO Case</p>
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
                clear();
              }}
              onBlur={(e) => check(e.target.value)}
              className={`font-mono h-11 ${errors.claim_reference ? "border-red-500 focus-visible:ring-red-500" : ""}`}
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
              className={`font-mono h-11 ${errors.claim_number ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            <FieldError name="claim_number" />
            {checkingClaimNo && (
              <p className="text-[11px] text-muted-foreground">Looking up…</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Case reason <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.gio_case_reason || undefined}
              onValueChange={(v) => set("gio_case_reason", v)}
            >
              <SelectTrigger
                className={`h-11 ${errors.gio_case_reason ? "border-red-500 ring-1 ring-red-500" : ""}`}
              >
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {GIO_CASE_REASONS.map((r) => (
                  <SelectItem key={r.value || r} value={r.value || r}>
                    {r.label || String(r).replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.gio_case_reason} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                Insured name <span className="text-red-500">*</span>
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
            {claimantMode === "existing" ? (
              <Select
                value={form.claimant_name || undefined}
                onValueChange={(v) => set("claimant_name", v)}
              >
                <SelectTrigger
                  className={`h-11 ${errors.claimant_name ? "border-red-500 ring-1 ring-red-500" : ""}`}
                >
                  <SelectValue placeholder="Select insured" />
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
                className={`h-11 ${errors.claimant_name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                value={form.claimant_name}
                onChange={(e) => set("claimant_name", e.target.value)}
              />
            )}
            <FieldError message={errors.claimant_name} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Injured / beneficiary</Label>
            <Input
              value={form.injured_name}
              onChange={(e) => set("injured_name", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Insurance type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.insurance_type}
              onValueChange={(v) => set("insurance_type", v)}
            >
              <SelectTrigger className="h-11">
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
            <Label className="text-xs font-medium">Policy number</Label>
            <Input
              value={form.policy_number}
              onChange={(e) => set("policy_number", e.target.value)}
              className="h-11"
            />
          </div>
          {form.insurance_type === "Motor" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Plate number</Label>
              <Input
                value={form.plate_number}
                onChange={(e) => set("plate_number", e.target.value)}
                placeholder="e.g. AA-12345"
                className="h-11 font-mono"
              />
            </div>
          )}

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Reserved Claim amount (ETB){" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                className={`h-11 ${errors.claim_amount ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                value={form.claim_amount}
                onChange={(e) => set("claim_amount", e.target.value)}
              />
              <FieldError message={errors.claim_amount} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Final approval amount (ETB)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.final_approval_amount}
                onChange={(e) => set("final_approval_amount", e.target.value)}
                className="h-11 bg-white"
              />
            </div>
          </div>

          {form.insurance_type === "Motor" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle type</Label>
              <Select
                value={form.motor_vehicle_type || undefined}
                onValueChange={(v) => set("motor_vehicle_type", v)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select vehicle type" />
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Incident date <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              className={`h-11 ${errors.incident_date ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              value={form.incident_date}
              onChange={(e) => set("incident_date", e.target.value)}
            />
            <FieldError message={errors.incident_date} />
          </div>

          {/* Garage name — New / Existing (Motor only) */}
          {form.insurance_type === "Motor" && (
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-xs font-medium">Garage name</Label>
                <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/40">
                  <Button
                    type="button"
                    size="sm"
                    variant={garageMode === "new" ? "default" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setGarageMode("new")}
                  >
                    New
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={garageMode === "existing" ? "default" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setGarageMode("existing")}
                  >
                    Existing
                  </Button>
                </div>
              </div>

              {garageMode === "existing" ? (
                <Select
                  value={form.garage_name || undefined}
                  onValueChange={(v) => set("garage_name", v)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select garage" />
                  </SelectTrigger>
                  <SelectContent>
                    {garages.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No garages yet. Use New when registering.
                      </div>
                    ) : (
                      garages.map((g) => (
                        <SelectItem key={g.id} value={g.name}>
                          {g.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-11"
                  value={form.garage_name}
                  onChange={(e) => set("garage_name", e.target.value)}
                  placeholder="Enter garage name"
                />
              )}
            </div>
          )}
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
              placeholder="What happened, when, and where…"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm border-l-4 border-l-amber-500 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2.5">
            <StepBadge n="2" color="bg-amber-100 text-amber-700" />
            <MapPin className="w-4 h-4 text-amber-600" />
            Routing information
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
                {ORIGINATING_OFFICE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Originating office</Label>
            <Select
              value={form.originating_office || undefined}
              onValueChange={(v) => set("originating_office", v)}
            >
              <SelectTrigger className="h-11">
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
            <Label className="text-xs font-medium">Date received</Label>
            <Input
              type="date"
              value={form.date_received}
              onChange={(e) => set("date_received", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Received reference number
            </Label>
            <Input
              value={form.received_reference_number}
              onChange={(e) => set("received_reference_number", e.target.value)}
              className="h-11"
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
                <SelectValue placeholder="Select Director for first assignment stage" />
              </SelectTrigger>
              <SelectContent>
                {adjusters.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No Director users found. Create one in Admin → Users (role:
                    Director).
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
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Remarks</Label>
            <Textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Additional notes for reviewers…"
            />
          </div>
        </CardContent>
      </Card>

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
                        errors.third_party_name
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
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
                      className={
                        errors.recovery_amount
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }
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
                        errors.subrogation_against
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
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
                        errors.amount_to_recover
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
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
                      className={
                        errors.reinsurer_name
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }
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
                        errors.recoverable_amount
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
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
            {
              key: "is_rebid",
              label: "Rebid?",
              body: form.is_rebid === "yes" && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Garages (comma-separated)</Label>
                    <Input
                      value={form.rebid_participating_garages}
                      onChange={(e) =>
                        set("rebid_participating_garages", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Winner <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      className={
                        errors.rebid_winner_garage
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }
                      value={form.rebid_winner_garage}
                      onChange={(e) =>
                        set("rebid_winner_garage", e.target.value)
                      }
                    />
                    <FieldError message={errors.rebid_winner_garage} />
                  </div>
                </div>
              ),
            },
            {
              key: "has_independent_assessor",
              label: "Independent assessor?",
              body: form.has_independent_assessor === "yes" && (
                <div className="p-3">
                  <Label className="text-xs">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    className={
                      errors.independent_assessor_name
                        ? "border-red-500 focus-visible:ring-red-500"
                        : ""
                    }
                    value={form.independent_assessor_name}
                    onChange={(e) =>
                      set("independent_assessor_name", e.target.value)
                    }
                  />
                  <FieldError message={errors.independent_assessor_name} />
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
          Check amount and case reason before registering.
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
              <Save className="w-4 h-4" /> Register GIO case
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
              <Label className="text-xs">Case reason *</Label>
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
                  {GIO_CASE_REASONS.map((r) => (
                    <SelectItem key={r.value || r} value={r.value || r}>
                      {r.label || String(r).replace(/_/g, " ")}
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
                  : "Register new GIO case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
