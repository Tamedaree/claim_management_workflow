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
import { useToast } from "@/components/ui/use-toast";
import { Save, UserPlus, Search } from "lucide-react";
import { INSURANCE_TYPES, FORWARDING_OFFICES } from "@/lib/roleConfig";
import {
  NEW_CLAIM_OFFICE_TYPES,
  fetchExistingClaimants,
  registerClaim,
} from "@/lib/claimRegistration";
import { useExistingClaimCheck } from "@/hooks/useExistingClaimCheck";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";

export default function NewClaimNotificationForm({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [claimantMode, setClaimantMode] = useState("new");
  const [existingClaimants, setExistingClaimants] = useState([]);
  const { existingClaim, check } = useExistingClaimCheck();

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

  const handleChange = (field, value) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleOfficeTypeChange = (value) =>
    setForm((f) => ({
      ...f,
      originating_office_type: value,
      originating_office: "",
    }));

  const officeOptions = form.originating_office_type
    ? FORWARDING_OFFICES[form.originating_office_type] || []
    : [];

  const handleSubmit = async (asDraft) => {
    if (
      !form.claim_reference ||
      !form.claimant_name ||
      !form.insurance_type ||
      !form.originating_office_type ||
      !form.originating_office ||
      (form.insurance_type === "Motor" && !form.plate_number)
    ) {
      toast({
        title: "Missing fields",
        description:
          "Reference, insured, type, forwarding office" +
          (form.insurance_type === "Motor" ? ", plate number" : "") +
          " are required.",
        variant: "destructive",
      });
      return;
    }

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

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Claim Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {existingClaim && (
            <ExistingClaimAlert
              claim={existingClaim}
              onView={() => navigate(`/claims/${existingClaim.id}`)}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Claim Reference *</Label>
              <Input
                value={form.claim_reference}
                onChange={(e) =>
                  handleChange("claim_reference", e.target.value)
                }
                onBlur={(e) => check(e.target.value)}
                placeholder="e.g. CLM-2026-001234"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Insured Name *</Label>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setClaimantMode("existing");
                      handleChange("claimant_name", "");
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
                      handleChange("claimant_name", "");
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
                  value={form.claimant_name}
                  onValueChange={(v) => handleChange("claimant_name", v)}
                >
                  <SelectTrigger>
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
                  value={form.claimant_name}
                  onChange={(e) =>
                    handleChange("claimant_name", e.target.value)
                  }
                  placeholder="Enter insured name"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Insurance Type *</Label>
              <Select
                value={form.insurance_type}
                onValueChange={(v) => handleChange("insurance_type", v)}
              >
                <SelectTrigger>
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
            </div>

            {form.insurance_type === "Motor" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Plate Number *</Label>
                <Input
                  value={form.plate_number}
                  onChange={(e) => handleChange("plate_number", e.target.value)}
                  placeholder="e.g. AA-123456"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger>
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

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Forwarding Office</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Forwarding Office Type *
              </Label>
              <Select
                value={form.originating_office_type}
                onValueChange={handleOfficeTypeChange}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Forwarding Office *</Label>
              <Select
                value={form.originating_office}
                onValueChange={(v) => handleChange("originating_office", v)}
                disabled={!form.originating_office_type}
              >
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Received Reference Number
              </Label>
              <Input
                value={form.received_reference_number}
                onChange={(e) =>
                  handleChange("received_reference_number", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date Received</Label>
              <Input
                type="date"
                value={form.date_received}
                onChange={(e) => handleChange("date_received", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Remarks</Label>
            <Textarea
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={submitting || !!existingClaim}
        >
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          disabled={submitting || !!existingClaim}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {submitting ? "Registering..." : "Register Claim"}
        </Button>
      </div>
    </>
  );
}
