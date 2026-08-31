import React, { useState, useEffect } from "react";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Settings, ArrowRight } from "lucide-react";
import { INSURANCE_TYPES, formatCurrency } from "@/lib/roleConfig";

const APPROVER_ROLES = [
  "Principal_of_Claim",
  "Claim_Manager",
  "GIO_Claim_Manager",
  "Director",
  "Chief_of_GIO",
  "CEO",
];

const ROLE_LABELS_LOCAL = {
  Principal_of_Claim: "Principal of Claim",
  Claim_Manager: "Claim Manager",
  GIO_Claim_Manager: "GIO Claim Manager",
  Director: "Director",
  Chief_of_GIO: "Chief of GIO",
  CEO: "CEO",
};

export default function AdminThresholds() {
  const { toast } = useToast();
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    insurance_type: "All",
    min_amount: "",
    max_amount: "",
    required_approver_role: "",
    approval_chain: [],
    is_active: true,
  });

  const loadThresholds = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approval-thresholds");
      setThresholds(res.data.data || []);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load thresholds.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/approval-thresholds");
        if (!cancelled) setThresholds(res.data.data || []);
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load thresholds.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSave = async () => {
    if (
      !form.min_amount ||
      !form.max_amount ||
      !form.required_approver_role ||
      form.approval_chain.length === 0
    ) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }

    try {
      await api.post("/approval-thresholds", {
        ...form,
        min_amount: parseFloat(form.min_amount),
        max_amount: parseFloat(form.max_amount),
      });
      toast({ title: "Threshold created" });
      setShowDialog(false);
      setForm({
        insurance_type: "All",
        min_amount: "",
        max_amount: "",
        required_approver_role: "",
        approval_chain: [],
        is_active: true,
      });
      await loadThresholds();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err.response?.data?.message || "Failed to create threshold",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (t) => {
    try {
      await api.put(`/approval-thresholds/${t.id}`, {
        is_active: !t.is_active,
      });
      await loadThresholds();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update status.",
        variant: "destructive",
      });
    }
  };

  const deleteThreshold = async (t) => {
    try {
      await api.delete(`/approval-thresholds/${t.id}`);
      await loadThresholds();
      toast({ title: "Threshold deleted" });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete threshold.",
        variant: "destructive",
      });
    }
  };

  const addToChain = (role) => {
    if (!form.approval_chain.includes(role)) {
      setForm((f) => ({ ...f, approval_chain: [...f.approval_chain, role] }));
    }
  };

  const removeFromChain = (idx) => {
    setForm((f) => ({
      ...f,
      approval_chain: f.approval_chain.filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Workflow Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure approval thresholds and routing rules
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Threshold
        </Button>
      </div>

      {thresholds.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Settings className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No approval thresholds configured
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setShowDialog(true)}
            >
              Create First Threshold
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {thresholds.map((t) => (
            <Card
              key={t.id}
              className={`border-0 shadow-sm ${
                !t.is_active ? "opacity-50" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                      {t.insurance_type?.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(t.min_amount)} —{" "}
                      {formatCurrency(t.max_amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={() => toggleActive(t)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteThreshold(t)}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Chain:</span>
                  {t.approval_chain?.map((role, i) => (
                    <React.Fragment key={`${role}-${i}`}>
                      <span className="text-xs bg-muted px-2 py-1 rounded font-medium">
                        {ROLE_LABELS_LOCAL[role] || role.replace(/_/g, " ")}
                      </span>
                      {i < t.approval_chain.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Approval Threshold</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Insurance Type</Label>
              <Select
                value={form.insurance_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, insurance_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  {INSURANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Min Amount (ETB)</Label>
                <Input
                  type="number"
                  value={form.min_amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_amount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Amount (ETB)</Label>
                <Input
                  type="number"
                  value={form.max_amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, max_amount: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Final Approver Role</Label>
              <Select
                value={form.required_approver_role}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, required_approver_role: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS_LOCAL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Approval Chain (in order)</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {form.approval_chain.map((role, i) => (
                  <React.Fragment key={`${role}-${i}`}>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                      {ROLE_LABELS_LOCAL[role] || role.replace(/_/g, " ")}
                      <button
                        onClick={() => removeFromChain(i)}
                        className="ml-1 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                    {i < form.approval_chain.length - 1 && (
                      <span className="text-muted-foreground text-xs">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <Select onValueChange={addToChain}>
                <SelectTrigger>
                  <SelectValue placeholder="Add approver to chain" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVER_ROLES.filter(
                    (r) => !form.approval_chain.includes(r),
                  ).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS_LOCAL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Create Threshold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
