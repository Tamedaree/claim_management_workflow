import { useState } from "react";
import api from "@/api/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  INSURANCE_TYPES,
  DEPARTMENTS,
  FORWARDING_OFFICE_TYPES,
  FORWARDING_OFFICES,
} from "@/lib/roleConfig";

/**
 * @typedef {Object} EditableClaim
 * @property {string} id
 * @property {string} [claim_reference]
 * @property {string} [policy_number]
 * @property {string} [claimant_name]
 * @property {string} [insurance_type]
 * @property {string} [plate_number]
 * @property {number | string} [claim_amount]
 * @property {string} [incident_date]
 * @property {string} [incident_description]
 * @property {string} [forwarding_office_type]
 * @property {string} [originating_office]
 * @property {string} [current_department]
 * @property {string} [workflow_type]
 * @property {"Low" | "Medium" | "High" | "Urgent"} [priority]
 * @property {string} [remarks]
 */

/**
 * @typedef {Object} ClaimEditForm
 * @property {string} claim_reference
 * @property {string} policy_number
 * @property {string} claimant_name
 * @property {string} insurance_type
 * @property {string} plate_number
 * @property {string | number} claim_amount
 * @property {string} incident_date
 * @property {string} incident_description
 * @property {string} forwarding_office_type
 * @property {string} originating_office
 * @property {string} current_department
 * @property {string} workflow_type
 * @property {"Low" | "Medium" | "High" | "Urgent"} priority
 * @property {string} remarks
 */

/**
 * @param {EditableClaim} claim
 * @returns {ClaimEditForm}
 */
function buildFormFromClaim(claim) {
  return {
    claim_reference: claim.claim_reference || "",
    policy_number: claim.policy_number || "",
    claimant_name: claim.claimant_name || "",
    insurance_type: claim.insurance_type || "",
    plate_number: claim.plate_number || "",
    claim_amount: claim.claim_amount || "",
    incident_date: claim.incident_date ? String(claim.incident_date).slice(0, 10) : "",
    incident_description: claim.incident_description || "",
    forwarding_office_type: claim.forwarding_office_type || "",
    originating_office: claim.originating_office || "",
    current_department: claim.current_department || "Claim_Division",
    workflow_type: claim.workflow_type || "Claim_Division",
    priority: claim.priority || "Medium",
    remarks: claim.remarks || "",
  };
}

/**
 * @typedef {Object} EditClaimFormProps
 * @property {EditableClaim} claim
 * @property {(open: boolean) => void} onOpenChange
 * @property {() => void} [onSaved]
 */

/**
 * @param {EditClaimFormProps} props
 */
function EditClaimForm({ claim, onOpenChange, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => buildFormFromClaim(claim));
  const [saving, setSaving] = useState(false);

  /**
   * @param {keyof ClaimEditForm} field
   * @param {string} value
   */
  const handleChange = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Reset office name when type changes
      if (field === "forwarding_office_type") {
        next.originating_office = "";
      }
      return next;
    });
  };

  const officeList =
    form.forwarding_office_type && FORWARDING_OFFICES?.[form.forwarding_office_type]
      ? FORWARDING_OFFICES[form.forwarding_office_type]
      : [];

  const handleSave = async () => {
    if (
      !form.claim_reference ||
      !form.claimant_name ||
      !form.insurance_type ||
      !form.claim_amount ||
      !form.incident_date
    ) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await api.put(`/claims/${claim.id}`, {
        claim_reference: form.claim_reference,
        policy_number: form.policy_number || null,
        claimant_name: form.claimant_name,
        insurance_type: form.insurance_type,
        plate_number: form.insurance_type === "Motor" ? form.plate_number || null : null,
        claim_amount: parseFloat(String(form.claim_amount)),
        incident_date: form.incident_date,
        incident_description: form.incident_description || null,
        forwarding_office_type: form.forwarding_office_type || null,
        originating_office: form.originating_office || null,
        current_department: form.current_department || null,
        workflow_type: form.workflow_type || null,
        priority: form.priority || "Medium",
        remarks: form.remarks || null,
      });

      toast({ title: "Claim updated" });
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (/** @type {any} */ err) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to update claim.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Claim — {claim.claim_reference}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">INSIS Claim Reference *</Label>
            <Input
              value={form.claim_reference}
              onChange={(e) => handleChange("claim_reference", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Policy Number</Label>
            <Input
              value={form.policy_number}
              onChange={(e) => handleChange("policy_number", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Claimant Name *</Label>
            <Input
              value={form.claimant_name}
              onChange={(e) => handleChange("claimant_name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Insurance Type *</Label>
            <Select value={form.insurance_type} onValueChange={(v) => handleChange("insurance_type", v)}>
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
            <Label className="text-xs font-medium">Claim Amount (ETB) *</Label>
            <Input
              type="number"
              value={form.claim_amount}
              onChange={(e) => handleChange("claim_amount", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Incident Date *</Label>
            <Input
              type="date"
              value={form.incident_date}
              onChange={(e) => handleChange("incident_date", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Select value={form.priority} onValueChange={(v) => handleChange("priority", v)}>
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

          {/* Forwarding Office Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Forwarding Office Type</Label>
            <Select
              value={form.forwarding_office_type}
              onValueChange={(v) => handleChange("forwarding_office_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FORWARDING_OFFICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Forwarding Office Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Forwarding Office</Label>
            {officeList.length > 0 ? (
              <Select
                value={form.originating_office}
                onValueChange={(v) => handleChange("originating_office", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {officeList.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.originating_office}
                onChange={(e) => handleChange("originating_office", e.target.value)}
                placeholder="Enter forwarding office name"
              />
            )}
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Department</Label>
            <Select
              value={form.current_department}
              onValueChange={(v) => handleChange("current_department", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Workflow Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Workflow Type</Label>
            <Select value={form.workflow_type} onValueChange={(v) => handleChange("workflow_type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Claim_Division">Claim Division</SelectItem>
                <SelectItem value="GIO_Approval">GIO Approval</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Incident Description</Label>
          <Textarea
            value={form.incident_description}
            onChange={(e) => handleChange("incident_description", e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Remarks</Label>
          <Textarea value={form.remarks} onChange={(e) => handleChange("remarks", e.target.value)} rows={2} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * @typedef {Object} EditClaimDialogProps
 * @property {EditableClaim | null} claim
 * @property {boolean} open
 * @property {(open: boolean) => void} onOpenChange
 * @property {() => void} [onSaved]
 */

/**
 * @param {EditClaimDialogProps} props
 */
export default function EditClaimDialog({ claim, open, onOpenChange, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && claim && (
          <EditClaimForm key={claim.id} claim={claim} onOpenChange={onOpenChange} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}