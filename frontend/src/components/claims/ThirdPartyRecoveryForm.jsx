import  { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Save, UserPlus, Search } from "lucide-react";
import { MOTOR_COVER_TYPES, FORWARDING_OFFICES } from "@/lib/roleConfig";
import { FORWARDED_CLAIM_OFFICE_TYPES, fetchExistingClaimants, registerClaim } from "@/lib/claimRegistration";
import FileUploadSection from "@/components/claims/FileUploadSection";
import { useExistingClaimCheck } from "@/hooks/useExistingClaimCheck";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";

export default function ThirdPartyRecoveryForm({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);
  const [claimantMode, setClaimantMode] = useState("new");
  const [existingClaimants, setExistingClaimants] = useState([]);
  const { existingClaim, check } = useExistingClaimCheck();
  const [form, setForm] = useState({
    claim_reference: "", policy_number: "", claimant_name: "", insurance_type: "Motor",
    cover_type: "", plate_number: "", claim_amount: "", incident_date: "", incident_description: "",
    originating_office_type: "", originating_office: "", received_reference_number: "", date_received: "",
    remarks: "", priority: "Medium", status: "Submitted",
    third_party_name: "", third_party_plate_number: "", recovery_amount: "", responsible_party_details: "",
  });

  useEffect(() => { fetchExistingClaimants().then(setExistingClaimants).catch(() => {}); }, []);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const handleOfficeTypeChange = (value) => setForm((f) => ({ ...f, originating_office_type: value, originating_office: "" }));
  const officeOptions = form.originating_office_type ? FORWARDING_OFFICES[form.originating_office_type] || [] : [];

  const handleSubmit = async (asDraft) => {
    if (!form.claim_reference || !form.claimant_name || !form.insurance_type || !form.claim_amount || !form.incident_date || !form.originating_office_type || !form.originating_office || !form.third_party_name || !form.recovery_amount) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await registerClaim({
        ...form,
        documents: files.map((f) => f.url),
        registration_type: "Third Party Recovery",
        is_recovery: true,
        registration_data: {
          third_party_name: form.third_party_name,
          third_party_plate_number: form.third_party_plate_number,
          recovery_amount: parseFloat(form.recovery_amount) || 0,
          responsible_party_details: form.responsible_party_details,
        },
      }, user, { asDraft });
      toast({ title: asDraft ? "Draft saved" : "Third-party recovery registered", description: asDraft ? "You can register it later." : "Third-party recovery (TL) claim has been registered." });
      navigate("/");
    } catch {
      toast({ title: "Error", description: "Failed to register claim.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Claim Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {existingClaim && <ExistingClaimAlert claim={existingClaim} onView={() => navigate(`/claims/${existingClaim.id}`)} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Claim Reference *</Label>
              <Input value={form.claim_reference} onChange={(e) => handleChange("claim_reference", e.target.value)} onBlur={(e) => check(e.target.value)} placeholder="e.g. CLM-2024-001234" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Policy Number</Label>
              <Input value={form.policy_number} onChange={(e) => handleChange("policy_number", e.target.value)} placeholder="e.g. POL-2024-005678" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Insured Name *</Label>
                <div className="flex items-center gap-1 text-xs">
                  <button type="button" onClick={() => { setClaimantMode("existing"); handleChange("claimant_name", ""); }} className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${claimantMode === "existing" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                    <Search className="w-3 h-3" /> Existing
                  </button>
                  <button type="button" onClick={() => { setClaimantMode("new"); handleChange("claimant_name", ""); }} className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${claimantMode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                    <UserPlus className="w-3 h-3" /> New
                  </button>
                </div>
              </div>
              {claimantMode === "existing" ? (
                <Select value={form.claimant_name} onValueChange={(v) => handleChange("claimant_name", v)}>
                  <SelectTrigger><SelectValue placeholder="Select existing insured" /></SelectTrigger>
                  <SelectContent>{existingClaimants.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={form.claimant_name} onChange={(e) => handleChange("claimant_name", e.target.value)} placeholder="Enter insured name" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Insurance Type</Label>
              <Input value="Motor" disabled className="bg-muted/50 font-medium" />
            </div>
            {form.insurance_type === "Motor" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Type of Cover *</Label>
                  <Select value={form.cover_type} onValueChange={(v) => handleChange("cover_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select cover type" /></SelectTrigger>
                    <SelectContent>{MOTOR_COVER_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Insured Vehicle Plate Number *</Label>
                  <Input value={form.plate_number} onChange={(e) => handleChange("plate_number", e.target.value)} placeholder="e.g. AA-123456" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Total Loss Amount (ETB) *</Label>
              <Input type="number" value={form.claim_amount} onChange={(e) => handleChange("claim_amount", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date of Loss *</Label>
              <Input type="date" value={form.incident_date} onChange={(e) => handleChange("incident_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => handleChange("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Low", "Medium", "High", "Urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Incident Description</Label>
            <Textarea value={form.incident_description} onChange={(e) => handleChange("incident_description", e.target.value)} rows={3} placeholder="Describe the accident / total loss incident..." />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Third-Party Recovery (TL) Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Third Party Name *</Label>
              <Input value={form.third_party_name} onChange={(e) => handleChange("third_party_name", e.target.value)} placeholder="Responsible third party / insurer" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Third Party Plate Number</Label>
              <Input value={form.third_party_plate_number} onChange={(e) => handleChange("third_party_plate_number", e.target.value)} placeholder="e.g. AA-654321" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Recovery Amount (ETB) *</Label>
              <Input type="number" value={form.recovery_amount} onChange={(e) => handleChange("recovery_amount", e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Responsible Party Details</Label>
            <Textarea value={form.responsible_party_details} onChange={(e) => handleChange("responsible_party_details", e.target.value)} rows={2} placeholder="Contact, insurer, legal status of responsible party..." />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Forwarding Office</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Forwarding Office Type *</Label>
              <Select value={form.originating_office_type} onValueChange={handleOfficeTypeChange}>
                <SelectTrigger><SelectValue placeholder="Select office type" /></SelectTrigger>
                <SelectContent>{FORWARDED_CLAIM_OFFICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Forwarding Office *</Label>
              <Select value={form.originating_office} onValueChange={(v) => handleChange("originating_office", v)} disabled={!form.originating_office_type}>
                <SelectTrigger><SelectValue placeholder={form.originating_office_type ? "Select office" : "Select type first"} /></SelectTrigger>
                <SelectContent>{officeOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Received Reference Number</Label>
              <Input value={form.received_reference_number} onChange={(e) => handleChange("received_reference_number", e.target.value)} placeholder="Reference from forwarding office" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date Received</Label>
              <Input type="date" value={form.date_received} onChange={(e) => handleChange("date_received", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => handleChange("remarks", e.target.value)} rows={2} placeholder="Any additional notes..." />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Supporting Documents</CardTitle></CardHeader>
        <CardContent><FileUploadSection files={files} setFiles={setFiles} /></CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Button variant="outline" onClick={() => handleSubmit(true)} disabled={submitting || !!existingClaim}>Save as Draft</Button>
        <Button onClick={() => handleSubmit(false)} disabled={submitting || !!existingClaim} className="gap-2">
          <Save className="w-4 h-4" /> {submitting ? "Registering..." : "Register Recovery Claim"}
        </Button>
      </div>
    </>
  );
}