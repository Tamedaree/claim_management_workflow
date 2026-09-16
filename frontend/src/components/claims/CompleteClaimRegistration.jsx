import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import api from "@/api/api";
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
import { Save, ArrowLeft } from "lucide-react";
import { MOTOR_COVER_TYPES } from "@/lib/roleConfig";
import FileUploadSection from "@/components/claims/FileUploadSection";
import ExistingClaimAlert from "@/components/claims/ExistingClaimAlert";

export default function CompleteClaimRegistration() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState(null);
  const [claimNumberConflict, setClaimNumberConflict] = useState(null);
  const [checkingClaimNo, setCheckingClaimNo] = useState(false);

  const checkClaimNumber = async (value) => {
    const v = String(value || "").trim();
    if (!v) {
      setClaimNumberConflict(null);
      return null;
    }

    setCheckingClaimNo(true);
    try {
      const res = await api.get(
        `/claims?claim_number=${encodeURIComponent(v)}&limit=5`,
      );
      const list = res.data?.data || [];
      const other = list.find((c) => c.id !== id);
      setClaimNumberConflict(other || null);
      return other || null;
    } catch {
      setClaimNumberConflict(null);
      return null;
    } finally {
      setCheckingClaimNo(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/claims/${id}`);
        const c = res.data.data || res.data;
        setForm({
          claim_reference: c.claim_reference || "",
          claim_number: c.claim_number || "",
          claimant_name: c.claimant_name || "",
          insurance_type: c.insurance_type || "",
          plate_number: c.plate_number || "",
          status: c.status || "",
          originating_office_type: c.originating_office_type || "",
          originating_office: c.originating_office || "",
          received_reference_number: c.received_reference_number || "",
          date_received: c.date_received
            ? String(c.date_received).slice(0, 10)
            : "",
          remarks: c.remarks || "",
          // adjuster fields
          policy_number: c.policy_number || "",
          cover_type: c.cover_type || "",
          claim_amount: c.claim_amount ?? "",
          incident_date: c.incident_date
            ? String(c.incident_date).slice(0, 10)
            : "",
          priority: c.priority || "Medium",
          incident_description: c.incident_description || "",
          registration_complete: c.registration_complete,
        });
        if (c.documents?.length) {
          setFiles(
            c.documents.map((url, i) => ({ name: `Doc ${i + 1}`, url })),
          );
        }
      } catch {
        toast({ title: "Claim not found", variant: "destructive" });
        navigate("/claims");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate, toast]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (
      !form.policy_number ||
      !form.claim_amount ||
      !form.incident_date ||
      (form.insurance_type === "Motor" && !form.cover_type)
    ) {
      toast({
        title: "Missing fields",
        description:
          "Policy number, claim number, amount, date of loss" +
          (form.insurance_type === "Motor" ? ", cover type" : "") +
          " are required.",
        variant: "destructive",
      });
      return;
    }
    const conflict =
      claimNumberConflict || (await checkClaimNumber(form.claim_number));
    if (conflict) {
      toast({
        title: "Duplicate claim number",
        description: `Already used on ${conflict.claim_reference}. Open that claim or use another number.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await api.put(`/claims/${id}`, {
        policy_number: form.policy_number,
        claim_number: form.claim_number || null,
        cover_type: form.insurance_type === "Motor" ? form.cover_type : null,
        plate_number: form.plate_number || null,
        claim_amount: parseFloat(form.claim_amount) || 0,
        incident_date: form.incident_date,
        incident_description: form.incident_description || null,
        priority: form.priority || "Medium",
        remarks: form.remarks || null,
        documents: files.map((f) => f.url).filter(Boolean),
        registration_complete: true,
        registration_completed_by_id: user?.id,
        registration_completed_by_name: user?.full_name || user?.email,
        registration_completed_at: new Date().toISOString(),
        status: "Claim_Registered",
      });

      toast({
        title: "Registration completed",
        description: "Full claim details saved.",
      });
      navigate(`/claims/${id}`);
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (form.registration_complete) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          This claim is already fully registered.
        </p>
        <Button variant="outline" onClick={() => navigate(`/claims/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to claim
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Complete claim registration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {form.claim_reference} — fill remaining fields (secretary data
          pre-filled)
        </p>
      </div>

      {/* From secretary — read-only style */}
      <Card className="border-0 shadow-sm bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">From secretary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Reference</p>
            <p className="font-medium">{form.claim_reference}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Insured</p>
            <p className="font-medium">{form.claimant_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium">{form.insurance_type}</p>
          </div>
          {form.insurance_type === "Motor" && (
            <div>
              <p className="text-xs text-muted-foreground">Plate</p>
              <p className="font-medium font-mono">
                {form.plate_number || "—"}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Forwarding office</p>
            <p className="font-medium">
              {form.originating_office_type?.replace(/_/g, " ")} —{" "}
              {form.originating_office || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Received ref / date</p>
            <p className="font-medium">
              {form.received_reference_number || "—"} /{" "}
              {form.date_received || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {claimNumberConflict && (
        <ExistingClaimAlert
          claim={claimNumberConflict}
          onView={() => navigate(`/claims/${claimNumberConflict.id}`)}
          title="Claim number already exists"
        />
      )}

      {/* Adjuster completes */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Complete details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Policy Number *</Label>
              <Input
                value={form.policy_number}
                onChange={(e) => set("policy_number", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Claim number *</Label>
              <Input
                value={form.claim_number}
                onChange={(e) => {
                  set("claim_number", e.target.value);
                  if (claimNumberConflict) setClaimNumberConflict(null);
                }}
                onBlur={(e) => checkClaimNumber(e.target.value)}
                placeholder="e.g. INSIS / internal claim no."
              />
              {checkingClaimNo && (
                <p className="text-[11px] text-muted-foreground">
                  Checking claim number…
                </p>
              )}
            </div>
            {form.insurance_type === "Motor" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Type of Cover *</Label>
                <Select
                  value={form.cover_type}
                  onValueChange={(v) => set("cover_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cover" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTOR_COVER_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Claim Amount (ETB) *</Label>
              <Input
                type="number"
                value={form.claim_amount}
                onChange={(e) => set("claim_amount", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date of Loss *</Label>
              <Input
                type="date"
                value={form.incident_date}
                onChange={(e) => set("incident_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
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
            {form.insurance_type === "Motor" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Plate Number</Label>
                <Input
                  value={form.plate_number}
                  onChange={(e) => set("plate_number", e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Incident Description</Label>
            <Textarea
              rows={3}
              value={form.incident_description}
              onChange={(e) => set("incident_description", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Remarks</Label>
            <Textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Supporting Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUploadSection files={files} setFiles={setFiles} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(`/claims/${id}`)}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !!claimNumberConflict || checkingClaimNo}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save full registration"}
        </Button>
      </div>
    </div>
  );
}
