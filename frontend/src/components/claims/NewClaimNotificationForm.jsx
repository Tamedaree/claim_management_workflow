import { useState, useEffect, useMemo } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import {
  Save,
  UserPlus,
  Search,
  FileText,
  Building2,
  ClipboardList,
} from "lucide-react";
import { INSURANCE_TYPES, FORWARDING_OFFICES } from "@/lib/roleConfig";
import {
  NEW_CLAIM_OFFICE_TYPES,
  fetchExistingClaimants,
  registerClaim,
} from "@/lib/claimRegistration";
import { useExistingClaimCheck } from "@/hooks/useExistingClaimCheck";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";

const fieldClass = "space-y-1.5";
const labelClass = "text-xs font-medium text-muted-foreground";

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-500 mt-1">{message}</p>;
}

function validateNotificationForm(form) {
  const errors = {};

  const ref = (form.claim_reference || "").trim();
  if (!ref) {
    errors.claim_reference = "Claim reference is required";
  } else if (ref.length < 3) {
    errors.claim_reference = "Reference must be at least 3 characters";
  }

  if (!form.claimant_name?.trim()) {
    errors.claimant_name = "Insured name is required";
  } else if (form.claimant_name.trim().length < 3) {
    errors.claimant_name = "At least 3 characters";
  } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/.test(form.claimant_name.trim())) {
    errors.claimant_name = "Letters, spaces, hyphens, and apostrophes only";
  }

  if (!form.insurance_type) {
    errors.insurance_type = "Insurance type is required";
  }

  if (form.insurance_type === "Motor") {
    if (!(form.plate_number || "").trim()) {
      errors.plate_number = "Plate number is required for Motor";
    }
  }

  if (!form.originating_office_type) {
    errors.originating_office_type = "Office type is required";
  }
  if (!(form.originating_office || "").trim()) {
    errors.originating_office = "Office is required";
  }

  if (form.date_received) {
    const d = new Date(form.date_received);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (Number.isNaN(d.getTime())) {
      errors.date_received = "Enter a valid date";
    } else if (d > today) {
      errors.date_received = "Date received cannot be in the future";
    }
  }

  return errors;
}

export default function NewClaimNotificationForm({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [claimantMode, setClaimantMode] = useState("new");
  const [existingClaimants, setExistingClaimants] = useState([]);
  const { existingClaim, check } = useExistingClaimCheck();
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    claim_reference: "",
    claimant_name: "",
    insurance_type: "",
    plate_number: "",
    status: "Notification_Received",
    originating_office_type: "",
    originating_office: "",
    received_reference_number: "",
    date_received: "",
    remarks: "",
  });

  useEffect(() => {
    fetchExistingClaimants()
      .then(setExistingClaimants)
      .catch(() => {});
  }, []);

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const handleOfficeTypeChange = (value) => {
    setForm((f) => ({
      ...f,
      originating_office_type: value,
      originating_office: "",
    }));
    setErrors((e) => {
      const next = { ...e };
      delete next.originating_office_type;
      delete next.originating_office;
      return next;
    });
  };

  const officeOptions = useMemo(
    () =>
      form.originating_office_type
        ? FORWARDING_OFFICES[form.originating_office_type] || []
        : [],
    [form.originating_office_type],
  );

  const setClaimantModeAndClear = (mode) => {
    setClaimantMode(mode);
    handleChange("claimant_name", "");
  };

  const handleSubmit = async (asDraft) => {
    const fieldErrors = validateNotificationForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast({
        title: "Missing or invalid fields",
        description: "Please fix the highlighted fields.",
        variant: "destructive",
      });
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      await registerClaim(
        {
          ...form,
          status: asDraft ? "Draft" : form.status || "Notification_Received",
          registration_type: "New Claim Notification",
        },
        user,
        { asDraft },
      );
      toast({
        title: asDraft ? "Draft saved" : "Claim notification registered",
        description: asDraft
          ? "You can finish later."
          : "Claim Adjuster will complete full registration.",
      });
      navigate("/");
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || e.message || "Failed",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const blocked = submitting || !!existingClaim;

  return (
    <div className="space-y-5">
      {/* Intro strip */}
      <div className="rounded-2xl border bg-gradient-to-r from-primary/5 via-background to-background p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              New claim notification
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Register a notification from a forwarding office. A claim adjuster
              will complete full details later.
            </p>
          </div>
        </div>
      </div>

      {existingClaim && (
        <ExistingClaimAlert
          claim={existingClaim}
          onView={() => navigate(`/claims/${existingClaim.id}`)}
        />
      )}

      {/* Claim information */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Claim information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={fieldClass}>
              <Label className={labelClass}>Claim reference *</Label>
              <Input
                className={`h-10 ${errors.claim_reference ? "border-red-500" : ""}`}
                value={form.claim_reference}
                onChange={(e) =>
                  handleChange("claim_reference", e.target.value)
                }
                onBlur={(e) => check(e.target.value)}
                placeholder="e.g. CLM-2026-001234"
              />
              <FieldError message={errors.claim_reference} />
            </div>

            <div className={fieldClass}>
              <div className="flex items-center justify-between gap-2">
                <Label className={labelClass}>Insured name *</Label>
                <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setClaimantModeAndClear("existing")}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      claimantMode === "existing"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Search className="w-3 h-3" /> Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimantModeAndClear("new")}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      claimantMode === "new"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UserPlus className="w-3 h-3" /> New
                  </button>
                </div>
              </div>
              {claimantMode === "existing" ? (
                <Select
                  value={form.claimant_name}
                  onValueChange={(v) => handleChange("claimant_name", v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select existing insured" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingClaimants.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-10"
                  value={form.claimant_name}
                  onChange={(e) =>
                    handleChange("claimant_name", e.target.value)
                  }
                  className={`h-10 ${errors.claimant_name ? "border-red-500" : ""}`}
                  placeholder="Enter insured name"
                />
              )}
              <FieldError message={errors.claimant_name} />
            </div>

            <div className={fieldClass}>
              <Label className={labelClass}>Insurance type *</Label>
              <Select
                value={form.insurance_type}
                onValueChange={(v) => handleChange("insurance_type", v)}
                className={`h-10 ${errors.insurance_type ? "border-red-500" : ""}`}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {INSURANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.insurance_type} />
            </div>

            {form.insurance_type === "Motor" && (
              <div className={fieldClass}>
                <Label className={labelClass}>Plate number *</Label>
                <Input
                  className={`h-10 font-mono ${errors.plate_number ? "border-red-500" : ""}`}
                  value={form.plate_number}
                  onChange={(e) => handleChange("plate_number", e.target.value)}
                  placeholder="e.g. AA-123456"
                />
                <FieldError message={errors.plate_number} />
              </div>
            )}

            <div className={fieldClass}>
              <Label className={labelClass}>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Notification_Received">
                    Notification Received
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forwarding office */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Forwarding office
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={fieldClass}>
              <Label className={labelClass}>Office type *</Label>
              <Select
                value={form.originating_office_type}
                onValueChange={handleOfficeTypeChange}
                className={`h-10 ${errors.originating_office_type ? "border-red-500" : ""}`}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select office type" />
                </SelectTrigger>
                <SelectContent>
                  {NEW_CLAIM_OFFICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.originating_office_type} />
            </div>

            <div className={fieldClass}>
              <Label className={labelClass}>Office *</Label>
              <Select
                value={form.originating_office}
                onValueChange={(v) => handleChange("originating_office", v)}
                disabled={!form.originating_office_type}
                className={`h-10 ${errors.originating_office ? "border-red-500" : ""}`}
              >
                <SelectTrigger className="h-10">
                  <SelectValue
                    placeholder={
                      form.originating_office_type
                        ? "Select office"
                        : "Select type first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {officeOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={fieldClass}>
              <Label className={labelClass}>Received reference number</Label>
              <Input
                className="h-10"
                value={form.received_reference_number}
                onChange={(e) =>
                  handleChange("received_reference_number", e.target.value)
                }
              />
            </div>

            <div className={fieldClass}>
              <Label className={labelClass}>Date received</Label>
              <Input
                className={`h-10 ${errors.date_received ? "border-red-500" : ""}`}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.date_received}
                onChange={(e) => handleChange("date_received", e.target.value)}
              />
              <FieldError message={errors.date_received} />
            </div>
          </div>

          <div className={fieldClass}>
            <Label className={labelClass}>Remarks</Label>
            <Textarea
              className="min-h-[72px] resize-y"
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              rows={2}
              placeholder="Optional notes for the adjuster…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={blocked}
        >
          Save as draft
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          disabled={blocked}
          className="gap-2 min-w-[140px]"
        >
          <Save className="w-4 h-4" />
          {submitting ? "Registering…" : "Register claim"}
        </Button>
      </div>
    </div>
  );
}
