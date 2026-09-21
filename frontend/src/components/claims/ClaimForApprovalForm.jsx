import { useState } from "react";
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
import { Save, FileText, Building2 } from "lucide-react";
import { INSURANCE_TYPES, FORWARDING_OFFICES } from "@/lib/roleConfig";
import { registerApprovalCase } from "@/lib/claimRegistration";
import { useExistingClaimCheck } from "@/hooks/useExistingClaimCheck";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";

const fieldClass = "space-y-1.5";
const labelClass = "text-xs font-medium text-muted-foreground";

export default function ClaimForApprovalForm({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const { existingClaim, check } = useExistingClaimCheck();

  const [form, setForm] = useState({
    claim_reference: "",
    insured_name: "",
    insurance_type: "",
    plate_number: "",
    originating_office: "",
    notification_received_date: new Date().toISOString().slice(0, 10),
    subrogation_recovery_reinsurance: "No",
    remarks: "",
  });

  const districtOffices = FORWARDING_OFFICES["District Office"] || [];

  const handleChange = (field, value) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (
      !form.claim_reference ||
      !form.insured_name ||
      !form.insurance_type ||
      !form.originating_office ||
      (form.insurance_type === "Motor" && !form.plate_number)
    ) {
      toast({
        title: "Missing fields",
        description:
          "Claim number, insured name, class of business, district/branch" +
          (form.insurance_type === "Motor" ? ", plate number" : "") +
          " are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await registerApprovalCase(form, user);
      toast({
        title: "Approval case registered",
        description: "Forwarded to Director for review.",
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
    <div className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-r from-primary/5 via-background to-background p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Claim for Approval
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Register a claim received from a District/Branch office for
              approval. Forwarded to the Director for review.
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

      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Claim information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={fieldClass}>
              <Label className={labelClass}>Claim number *</Label>
              <Input
                className="h-10"
                value={form.claim_reference}
                onChange={(e) =>
                  handleChange("claim_reference", e.target.value)
                }
                onBlur={(e) => check(e.target.value)}
              />
            </div>
            <div className={fieldClass}>
              <Label className={labelClass}>Insured name *</Label>
              <Input
                className="h-10"
                value={form.insured_name}
                onChange={(e) => handleChange("insured_name", e.target.value)}
              />
            </div>
            <div className={fieldClass}>
              <Label className={labelClass}>Class of business *</Label>
              <Select
                value={form.insurance_type}
                onValueChange={(v) => handleChange("insurance_type", v)}
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
            </div>
            {form.insurance_type === "Motor" && (
              <div className={fieldClass}>
                <Label className={labelClass}>Plate number *</Label>
                <Input
                  className="h-10 font-mono"
                  value={form.plate_number}
                  onChange={(e) => handleChange("plate_number", e.target.value)}
                />
              </div>
            )}
            <div className={fieldClass}>
              <Label className={labelClass}>Notification received date</Label>
              <Input
                className="h-10"
                type="date"
                value={form.notification_received_date}
                onChange={(e) =>
                  handleChange("notification_received_date", e.target.value)
                }
              />
            </div>
            <div className={fieldClass}>
              <Label className={labelClass}>
                Subrogation / Recovery / Reinsurance
              </Label>
              <Select
                value={form.subrogation_recovery_reinsurance}
                onValueChange={(v) =>
                  handleChange("subrogation_recovery_reinsurance", v)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Yes">
                    Yes — link to Third-Party Recovery record
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> District / Branch
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className={fieldClass}>
            <Label className={labelClass}>District / Branch *</Label>
            <Select
              value={form.originating_office}
              onValueChange={(v) => handleChange("originating_office", v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select office" />
              </SelectTrigger>
              <SelectContent>
                {districtOffices.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={fieldClass}>
            <Label className={labelClass}>Remarks</Label>
            <Textarea
              className="min-h-[72px] resize-y"
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !!existingClaim}
          className="gap-2 min-w-[140px]"
        >
          <Save className="w-4 h-4" />
          {submitting ? "Registering…" : "Register & Forward to Director"}
        </Button>
      </div>
    </div>
  );
}
