import { useState, useEffect } from "react";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Workflow,
} from "lucide-react";
import { ROLE_LABELS, DEPARTMENT_OPTIONS } from "@/lib/roleConfig";

export default function WorkflowConfig() {
  const { toast } = useToast();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    stage_name: "",
    description: "",
    stage_order: 1,
    responsible_role: "claim_adjuster",
    department: "Claim_Division",
    workflow_type: "Claim_Division",
    is_active: true,
    is_configurable: true,
  });
  const [saving, setSaving] = useState(false);

  // Declare first
  const loadStages = async () => {
    setLoading(true);
    try {
      const res = await api.get("/workflow-stages");
      const data = res.data.data || [];
      data.sort((a, b) => a.stage_order - b.stage_order);
      setStages(data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load workflow stages.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Then effect
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/workflow-stages");
        if (cancelled) return;
        const data = res.data.data || [];
        data.sort((a, b) => a.stage_order - b.stage_order);
        setStages(data);
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load workflow stages.",
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

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({
      stage_name: "",
      description: "",
      stage_order: stages.length + 1,
      responsible_role: "claim_adjuster",
      department: "Claim_Division",
      workflow_type: "Claim_Division",
      is_active: true,
      is_configurable: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (stage) => {
    setEditing(stage);
    setForm({
      stage_name: stage.stage_name || "",
      description: stage.description || "",
      stage_order: stage.stage_order || 1,
      responsible_role: stage.responsible_role || "claim_adjuster",
      department: stage.department || "Claim_Division",
      workflow_type: stage.workflow_type || "Claim_Division",
      is_active: stage.is_active ?? true,
      is_configurable: stage.is_configurable ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.stage_name.trim()) {
      toast({
        title: "Error",
        description: "Stage name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/workflow-stages/${editing.id}`, form);
        toast({
          title: "Stage updated",
          description: `${form.stage_name} has been updated.`,
        });
      } else {
        await api.post("/workflow-stages", form);
        toast({
          title: "Stage added",
          description: `${form.stage_name} has been added to the workflow.`,
        });
      }
      setDialogOpen(false);
      setEditing(null);
      loadStages();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to save stage.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stage) => {
    if (!confirm(`Delete "${stage.stage_name}"? This cannot be undone.`))
      return;
    try {
      await api.delete(`/workflow-stages/${stage.id}`);
      toast({
        title: "Stage deleted",
        description: `${stage.stage_name} has been removed.`,
      });
      loadStages();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete stage.",
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (stage) => {
    try {
      await api.put(`/workflow-stages/${stage.id}`, {
        is_active: !stage.is_active,
      });
      loadStages();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const moveStage = async (stage, direction) => {
    const idx = stages.findIndex((s) => s.id === stage.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= stages.length) return;

    const swapStage = stages[swapIdx];
    try {
      await Promise.all([
        api.put(`/workflow-stages/${stage.id}`, {
          stage_order: swapStage.stage_order,
        }),
        api.put(`/workflow-stages/${swapStage.id}`, {
          stage_order: stage.stage_order,
        }),
      ]);
      loadStages();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="w-6 h-6 text-primary" />
            Workflow Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the claim monitoring stages tracked alongside INSIS Fadata
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Stage
        </Button>
      </div>

      <Card className="border-0 shadow-sm bg-amber-50 border-l-4 border-l-amber-400">
        <CardContent className="p-4">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> These stages are for monitoring and
            visibility only. The system tracks claim progression through these
            stages but does not execute the actual business operations, which
            remain in INSIS Fadata.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No workflow stages configured yet.
            </p>
          ) : (
            <div className="divide-y">
              {stages.map((stage, i) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveStage(stage, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveStage(stage, 1)}
                      disabled={i === stages.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {stage.stage_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {stage.stage_name}
                      </span>
                      {!stage.is_active && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {stage.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stage.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>
                        {ROLE_LABELS[stage.responsible_role] ||
                          stage.responsible_role}
                      </span>
                      <span>·</span>
                      <span>
                        {stage.department
                          ? stage.department.replace(/_/g, " ")
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={stage.is_active}
                      onCheckedChange={() => handleToggle(stage)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleEdit(stage)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(stage)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Stage" : "Add Workflow Stage"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Stage Name</Label>
              <Input
                value={form.stage_name}
                onChange={(e) =>
                  setForm({ ...form, stage_name: e.target.value })
                }
                placeholder="e.g. Survey Assigned"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                placeholder="What this stage represents..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Order</Label>
                <Input
                  type="number"
                  value={form.stage_order}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stage_order: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) => setForm({ ...form, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Responsible Role</Label>
              <Select
                value={form.responsible_role}
                onValueChange={(v) => setForm({ ...form, responsible_role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
