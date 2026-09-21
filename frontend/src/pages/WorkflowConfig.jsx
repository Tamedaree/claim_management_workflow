import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  ROLE_LABELS,
  DEPARTMENT_OPTIONS,
  INSURANCE_TYPES,
  WORKFLOW_STAGES,
  CLAIM_APPROVAL_STAGES,
} from "@/lib/roleConfig";

const STREAMS = {
  New_Claim: {
    key: "New_Claim",
    label: "New Claim Notification",
    shortLabel: "New Claim",
    description:
      "Kefla Ager / branch new claim flow — registration through closure.",
    note: "Operation 1 (New Claim Notification). Used when the claim is a new-claim case.",
    template: WORKFLOW_STAGES,
    templateLabel: "Kefla Ager (New Claim)",
    defaultRole: "secretary",
    defaultOfficeTypes: ["Kefla_Ager_Branch"],
  },
  Claim_Approval: {
    key: "Claim_Approval",
    label: "Claim for Approval",
    shortLabel: "Claim for Approval",
    description:
      "District / Branch files sent to Head Office for approval only.",
    note: "Operation 2 (Claim for Approval). “Approval Review” escalates Director → Senior Director → CEO.",
    template: CLAIM_APPROVAL_STAGES,
    templateLabel: "District Approval",
    defaultRole: "secretary",
    defaultOfficeTypes: ["District_Office"],
  },
};

function mapDepartment(dept) {
  if (!dept || dept === "Claim Division") return "Claim_Division";
  return dept;
}

function filterByStream(list, streamKey) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => (s.workflow_stream || "") === streamKey)
    .sort((a, b) => a.stage_order - b.stage_order);
}

function buildEmptyForm(streamKey, order = 1) {
  const meta = STREAMS[streamKey];
  return {
    stage_name: "",
    description: "",
    stage_order: order,
    sla_days: "",
    responsible_role: meta.defaultRole,
    department: "Claim_Division",
    workflow_type: "Claim_Division",
    workflow_stream: streamKey,
    applicable_office_types: [...meta.defaultOfficeTypes],
    applicable_insurance_types: [],
    is_active: true,
    is_configurable: true,
  };
}

function toApiPayload(form, streamKey) {
  const meta = STREAMS[streamKey];
  return {
    stage_name: form.stage_name,
    description: form.description || null,
    stage_order: Number(form.stage_order) || 1,
    sla_days:
      form.sla_days === "" || form.sla_days == null
        ? null
        : Number(form.sla_days),
    responsible_role: form.responsible_role,
    department: mapDepartment(form.department),
    workflow_type: "Claim_Division",
    workflow_stream: streamKey,
    applicable_office_types: [...meta.defaultOfficeTypes],
    applicable_insurance_types: form.applicable_insurance_types || [],
    is_active: form.is_active ?? true,
    is_configurable: form.is_configurable ?? true,
  };
}

function templatePayload(stage, streamKey) {
  const meta = STREAMS[streamKey];
  return {
    stage_name: stage.stage_name,
    description: stage.description || "",
    stage_order: stage.stage_order,
    responsible_role: stage.responsible_role,
    department: mapDepartment(stage.department),
    workflow_type: "Claim_Division",
    workflow_stream: streamKey,
    applicable_insurance_types: stage.applicable_insurance_types || [],
    applicable_office_types: [...meta.defaultOfficeTypes],
    is_active: true,
    is_configurable: true,
    sla_days: stage.sla_days ?? null,
  };
}

export default function WorkflowConfig() {
  const { toast } = useToast();
  const [activeStream, setActiveStream] = useState("New_Claim");
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => buildEmptyForm("New_Claim"));
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const meta = STREAMS[activeStream];

  const loadStages = useCallback(
    async (streamKey = activeStream) => {
      setLoading(true);
      try {
        const res = await api.get("/workflow-stages");
        const raw = res.data?.data ?? res.data ?? [];
        setStages(filterByStream(Array.isArray(raw) ? raw : [], streamKey));
      } catch {
        toast({
          title: "Error",
          description: "Failed to load workflow stages.",
          variant: "destructive",
        });
        setStages([]);
      } finally {
        setLoading(false);
      }
    },
    [activeStream, toast],
  );

  // Load when tab changes — setState only after await (no sync setState at effect start)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/workflow-stages");
        if (cancelled) return;
        const raw = res.data?.data ?? res.data ?? [];
        setStages(filterByStream(Array.isArray(raw) ? raw : [], activeStream));
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load workflow stages.",
            variant: "destructive",
          });
          setStages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeStream, toast]);

  const switchTab = (key) => {
    if (key === activeStream) return;
    setLoading(true);
    setActiveStream(key);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(buildEmptyForm(activeStream, stages.length + 1));
    setDialogOpen(true);
  };

  const openEdit = (stage) => {
    setEditing(stage);
    setForm({
      stage_name: stage.stage_name || "",
      description: stage.description || "",
      stage_order: stage.stage_order || 1,
      sla_days: stage.sla_days != null ? String(stage.sla_days) : "",
      responsible_role: stage.responsible_role || meta.defaultRole,
      department: stage.department || "Claim_Division",
      workflow_type: stage.workflow_type || "Claim_Division",
      workflow_stream: stage.workflow_stream || activeStream,
      applicable_office_types: stage.applicable_office_types || [
        ...meta.defaultOfficeTypes,
      ],
      applicable_insurance_types: stage.applicable_insurance_types || [],
      is_active: stage.is_active ?? true,
      is_configurable: stage.is_configurable ?? true,
    });
    setDialogOpen(true);
  };

  const saveStage = async () => {
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
      const payload = toApiPayload(form, activeStream);
      if (editing) {
        await api.put(`/workflow-stages/${editing.id}`, payload);
        toast({ title: "Stage updated", description: form.stage_name });
      } else {
        await api.post("/workflow-stages", payload);
        toast({ title: "Stage added", description: form.stage_name });
      }
      setDialogOpen(false);
      setEditing(null);
      await loadStages();
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

  const deleteStage = async (stage) => {
    if (!confirm(`Delete "${stage.stage_name}"?`)) return;
    try {
      await api.delete(`/workflow-stages/${stage.id}`);
      toast({ title: "Stage deleted", description: stage.stage_name });
      await loadStages();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete stage.",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (stage) => {
    try {
      await api.put(`/workflow-stages/${stage.id}`, {
        is_active: !stage.is_active,
      });
      await loadStages();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const moveStage = async (stage, direction) => {
    const idx = stages.findIndex((s) => s.id === stage.id);
    const swap = stages[idx + direction];
    if (!swap) return;
    try {
      await Promise.all([
        api.put(`/workflow-stages/${stage.id}`, {
          stage_order: swap.stage_order,
        }),
        api.put(`/workflow-stages/${swap.id}`, {
          stage_order: stage.stage_order,
        }),
      ]);
      await loadStages();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const loadTemplate = async () => {
    if (
      !confirm(
        `Load ${meta.templateLabel} stages? Existing names will be skipped.`,
      )
    ) {
      return;
    }

    setSeeding(true);
    try {
      const existing = new Set(stages.map((s) => s.stage_name));
      let created = 0;
      let skipped = 0;

      for (const s of meta.template) {
        if (existing.has(s.stage_name)) {
          skipped++;
          continue;
        }
        await api.post("/workflow-stages", templatePayload(s, activeStream));
        created++;
      }

      toast({
        title: "Stages loaded",
        description: `Created ${created}, skipped ${skipped}.`,
      });
      await loadStages();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.message || "Failed to load stages.",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  const roleOptions = useMemo(() => Object.entries(ROLE_LABELS), []);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Workflow className="w-6 h-6 text-primary" />
          Workflow Configuration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure monitoring stages by operation type
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {Object.values(STREAMS).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeStream === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.shortLabel}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{meta.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {meta.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={seeding || loading}
            onClick={loadTemplate}
          >
            {seeding ? "Loading..." : `Load ${meta.templateLabel} stages`}
          </Button>
          <Button onClick={openAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Stage
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm bg-amber-50 border-l-4 border-l-amber-400">
        <CardContent className="p-4">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> {meta.note} SLA (days) drives overdue /
            escalation alerts.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : stages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No stages yet. Use{" "}
              <strong>Load {meta.templateLabel} stages</strong> or{" "}
              <strong>Add Stage</strong>.
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
                      type="button"
                      onClick={() => moveStage(stage, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {stage.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
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
                      {stage.sla_days != null && stage.sla_days !== "" && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700 font-medium">
                            SLA: {stage.sla_days}d
                          </span>
                        </>
                      )}
                      {stage.applicable_insurance_types?.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-blue-600 font-medium">
                            {stage.applicable_insurance_types.join(", ")} only
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!stage.is_active}
                      onCheckedChange={() => toggleActive(stage)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEdit(stage)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteStage(stage)}
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
              {editing ? "Edit Stage" : "Add Stage"} — {meta.shortLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Stage Name</Label>
              <Input
                value={form.stage_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stage_name: e.target.value }))
                }
                placeholder="e.g. Approval Review"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Order</Label>
                <Input
                  type="number"
                  value={form.stage_order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      stage_order: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Target SLA (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.sla_days}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sla_days: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select
                value={form.department}
                onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}
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
            <div className="space-y-1.5">
              <Label className="text-xs">Responsible Role</Label>
              <Select
                value={form.responsible_role}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, responsible_role: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Insurance Types</Label>
                <button
                  type="button"
                  className="text-[10px] text-primary hover:underline"
                  onClick={() =>
                    setForm((f) => ({ ...f, applicable_insurance_types: [] }))
                  }
                >
                  {form.applicable_insurance_types.length === 0
                    ? "(all types)"
                    : "Clear → all"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-2 border rounded-md max-h-40 overflow-y-auto">
                {INSURANCE_TYPES.map((t) => {
                  const checked = form.applicable_insurance_types.includes(t);
                  return (
                    <label
                      key={t}
                      className="flex items-center gap-1.5 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            applicable_insurance_types: checked
                              ? f.applicable_insurance_types.filter(
                                  (x) => x !== t,
                                )
                              : [...f.applicable_insurance_types, t],
                          }))
                        }
                      />
                      {t}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveStage} disabled={saving}>
              {saving ? "Saving..." : "Save Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
