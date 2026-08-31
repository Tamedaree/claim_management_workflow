import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Save, UserPlus, Search } from "lucide-react";
import { INSURANCE_TYPES, FORWARDING_OFFICES } from "@/lib/roleConfig";
import { FORWARDED_CLAIM_OFFICE_TYPES, fetchExistingClaimants, registerClaim } from "@/lib/claimRegistration";
import FileUploadSection from "@/components/claims/FileUploadSection";
import { useExistingClaimCheck } from "@/hooks/useExistingClaimCheck";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";

export default function ReinsuranceForm({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);
  const [claimantMode, setClaimantMode] = useState("new");
  const [existingClaimants, setExistingClaimants] = useState([]);
  const { existingClaim, check } = useExistingClaimCheck();
  const [form, setForm] = useState({
    claim_reference: "", policy_number: "", claimant_name: "", insurance_type: "",
    claim_amount: "", incident_date: "", incident_description: "",
    originating_office_type: "", originating_office: "", received_reference_number: "", date_received: "",
    remarks: "", priority: "Medium", status: "Submitted",
    reinsurer_name: "", treaty_reference: "", reinsurance_type: "Treaty",
    cedent_share: "", reinsurer_share: "", recoverable_amount: "",
  });

  useEffect(() => { fetchExistingClaimants().then(setExistingClaimants).catch(() => {}); }, []);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const handleOfficeTypeChange = (value) => setForm((f) => ({ ...f, originating_office_type: value, originating_office: "" }));
  const officeOptions = form.originating_office_type ? FORWARDING_OFFICES[form.originating_office_type] || [] : [];

  const handleSubmit = async (asDraft) => {
    if (!form.claim_reference || !form.claimant_name || !form.insurance_type || !form.claim_amount || !form.incident_date || !form.originating_office_type || !form.originating_office || !form.reinsurer_name || !form.recoverable_amount) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await registerClaim({
        ...form,
        documents: files.map((f) => f.url),
        registration_type: "Reinsurance",
        is_reinsurance: true,
        registration_data: {
          reinsurer_name: form.reinsurer_name,
          treaty_reference: form.treaty_reference,
          reinsurance_type: form.reinsurance_type,
          cedent_share: parseFloat(form.cedent_share) || 0,
          reinsurer_share: parseFloat(form.reinsurer_share) || 0,
          recoverable_amount: parseFloat(form.recoverable_amount) || 0,
        },
      }, user, { asDraft });
      toast({ title: asDraft ? "Draft saved" : "Reinsurance claim registered", description: asDraft ? "You can register it later." : "Reinsurance claim has been registered." });
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
              <Label className="text-xs font-medium">Insurance Type *</Label>
              <Select value={form.insurance_type} onValueChange={(v) => handleChange("insurance_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{INSURANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Total Claim Amount (ETB) *</Label>
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
            <Textarea value={form.incident_description} onChange={(e) => handleChange("incident_description", e.target.value)} rows={3} placeholder="Describe the incident..." />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Reinsurance Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reinsurer Name *</Label>
              <Input value={form.reinsurer_name} onChange={(e) => handleChange("reinsurer_name", e.target.value)} placeholder="e.g. Munich Re, Swiss Re" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Treaty / Contract Reference</Label>
              <Input value={form.treaty_reference} onChange={(e) => handleChange("treaty_reference", e.target.value)} placeholder="e.g. TREATY-2024-MOTOR-01" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reinsurance Type</Label>
              <Select value={form.reinsurance_type} onValueChange={(v) => handleChange("reinsurance_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Treaty">Treaty</SelectItem>
                  <SelectItem value="Facultative">Facultative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Recoverable Amount (ETB) *</Label>
              <Input type="number" value={form.recoverable_amount} onChange={(e) => handleChange("recoverable_amount", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">EIC (Cedent) Share %</Label>
              <Input type="number" value={form.cedent_share} onChange={(e) => handleChange("cedent_share", e.target.value)} placeholder="e.g. 40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reinsurer Share %</Label>
              <Input type="number" value={form.reinsurer_share} onChange={(e) => handleChange("reinsurer_share", e.target.value)} placeholder="e.g. 60" />
            </div>
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
          <Save className="w-4 h-4" /> {submitting ? "Registering..." : "Register Reinsurance Claim"}
        </Button>
      </div>
    </>
  );
}