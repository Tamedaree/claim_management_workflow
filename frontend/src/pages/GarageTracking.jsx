import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/components/ui/use-toast";
import {
  Wrench,
  Plus,
  Search,
  Building2,
  DollarSign,
  Calendar,
  FileText,
} from "lucide-react";
import {
  GARAGE_STATUS_COLORS,
  formatCurrency,
  canManageGarages,
} from "@/lib/roleConfig";
import moment from "moment";

const GARAGE_STATUSES = [
  "Proforma_Requested",
  "Proforma_Received",
  "Tender_Under_Review",
  "Work_Order_Issued",
  "Repair_In_Progress",
  "Repair_Completed",
  "Survey_After_Repair",
  "Invoice_Settled",
];

const STATUS_LABELS = {
  Proforma_Requested: "Proforma Requested",
  Proforma_Received: "Proforma Received",
  Tender_Under_Review: "Tender Under Review",
  Work_Order_Issued: "Work Order Issued",
  Repair_In_Progress: "Repair In Progress",
  Repair_Completed: "Repair Completed",
  Survey_After_Repair: "Survey After Repair",
  Invoice_Settled: "Invoice Settled",
};

export default function GarageTracking() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const canEdit = canManageGarages(user?.role);

  const [garages, setGarages] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    claim_id: "",
    garage_name: "",
    garage_location: "",
    work_order_number: "",
    work_order_date: "",
    estimated_amount: 0,
    final_amount: 0,
    repair_description: "",
    status: "Proforma_Requested",
    start_date: "",
    completion_date: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [garagesRes, claimsRes] = await Promise.all([
          api.get("/claim-garages"),
          api.get("/claims?workflow_type=Claim_Division"),
        ]);
        if (cancelled) return;

        const divisionClaims = (claimsRes.data.data || []).filter(
          (c) => c.workflow_type !== "GIO_Approval",
        );
        const claimIds = new Set(divisionClaims.map((c) => c.id));
        const divisionGarages = (garagesRes.data.data || []).filter((g) =>
          claimIds.has(g.claim_id),
        );

        setClaims(divisionClaims);
        setGarages(divisionGarages);
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load garage records.",
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [garagesRes, claimsRes] = await Promise.all([
        api.get("/claim-garages"),
        api.get("/claims?workflow_type=Claim_Division"),
      ]);
      const divisionClaims = (claimsRes.data.data || []).filter(
        (c) => c.workflow_type !== "GIO_Approval",
      );
      const claimIds = new Set(divisionClaims.map((c) => c.id));
      setClaims(divisionClaims);
      setGarages(
        (garagesRes.data.data || []).filter((g) => claimIds.has(g.claim_id)),
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to load garage records.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getClaim = (claimId) => claims.find((c) => c.id === claimId);

  const filtered = garages.filter((g) => {
    const claim = getClaim(g.claim_id);
    const matchesSearch =
      !search ||
      g.garage_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.work_order_number?.toLowerCase().includes(search.toLowerCase()) ||
      claim?.claim_reference?.toLowerCase().includes(search.toLowerCase()) ||
      claim?.claimant_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    if (!canEdit) return;
    setEditing(null);
    setForm({
      claim_id: "",
      garage_name: "",
      garage_location: "",
      work_order_number: "",
      work_order_date: "",
      estimated_amount: 0,
      final_amount: 0,
      repair_description: "",
      status: "Proforma_Requested",
      start_date: "",
      completion_date: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (g) => {
    if (!canEdit) {
      // view-only: still open dialog but disable save
      setEditing(g);
      setForm({
        ...g,
        work_order_date: g.work_order_date
          ? moment(g.work_order_date).format("YYYY-MM-DD")
          : "",
        start_date: g.start_date
          ? moment(g.start_date).format("YYYY-MM-DD")
          : "",
        completion_date: g.completion_date
          ? moment(g.completion_date).format("YYYY-MM-DD")
          : "",
        estimated_amount: g.estimated_amount || 0,
        final_amount: g.final_amount || 0,
        notes: g.notes || "",
      });
      setDialogOpen(true);
      return;
    }
    setEditing(g);
    setForm({
      ...g,
      work_order_date: g.work_order_date
        ? moment(g.work_order_date).format("YYYY-MM-DD")
        : "",
      start_date: g.start_date ? moment(g.start_date).format("YYYY-MM-DD") : "",
      completion_date: g.completion_date
        ? moment(g.completion_date).format("YYYY-MM-DD")
        : "",
      estimated_amount: g.estimated_amount || 0,
      final_amount: g.final_amount || 0,
      notes: g.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (!form.claim_id || !form.garage_name.trim()) {
      toast({
        title: "Error",
        description: "Claim and garage name are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const claim = getClaim(form.claim_id);
      if (claim?.workflow_type === "GIO_Approval") {
        toast({
          title: "Not allowed",
          description: "Garage tracking is only for Claim Division claims.",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        claim_id: form.claim_id,
        claim_reference: claim?.claim_reference || "",
        garage_name: form.garage_name,
        garage_location: form.garage_location || null,
        work_order_number: form.work_order_number || null,
        work_order_date: form.work_order_date || null,
        estimated_amount: parseFloat(form.estimated_amount) || 0,
        final_amount: parseFloat(form.final_amount) || 0,
        repair_description: form.repair_description || null,
        status: form.status,
        start_date: form.start_date || null,
        completion_date: form.completion_date || null,
        notes: form.notes || null,
      };

      if (editing) {
        await api.put(`/claim-garages/${editing.id}`, payload);
        toast({ title: "Updated", description: "Garage record updated." });
      } else {
        await api.post("/claim-garages", payload);
        toast({ title: "Created", description: "Garage record added." });
      }

      setDialogOpen(false);
      loadData();
    } catch (e) {
      toast({
        title: "Error",
        description:
          e.response?.data?.message || "Failed to save garage record.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            Garage & Repair Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claim Division only — work orders, proformas, and repair progress
            {!canEdit && " (view only)"}
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleOpenAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Garage Record
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by garage, work order, claim..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {GARAGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s] || s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Wrench className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No garage records for Claim Division claims.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((g) => {
            const claim = getClaim(g.claim_id);
            return (
              <Card
                key={g.id}
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEdit(g)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{g.garage_name}</p>
                      {g.garage_location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {g.garage_location}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        GARAGE_STATUS_COLORS?.[STATUS_LABELS[g.status]] ||
                        GARAGE_STATUS_COLORS?.[g.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[g.status] || g.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {claim && (
                    <Link
                      to={`/claims/${claim.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {claim.claim_reference} — {claim.claimant_name}
                    </Link>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    {g.work_order_number && (
                      <div>
                        <span className="text-muted-foreground">WO#:</span>{" "}
                        {g.work_order_number}
                      </div>
                    )}
                    {g.work_order_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {moment(g.work_order_date).format("DD MMM YYYY")}
                      </div>
                    )}
                    {g.estimated_amount > 0 && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-muted-foreground" />
                        {formatCurrency(g.estimated_amount)}
                      </div>
                    )}
                    {g.final_amount > 0 && (
                      <div className="flex items-center gap-1 font-medium">
                        <DollarSign className="w-3 h-3" />
                        {formatCurrency(g.final_amount)}
                      </div>
                    )}
                  </div>

                  {g.repair_description && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      {g.repair_description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? canEdit
                  ? "Edit Garage Record"
                  : "Garage Record (view)"
                : "Add Garage Record"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs">Claim *</Label>
              <Select
                value={form.claim_id}
                onValueChange={(v) => setForm({ ...form, claim_id: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Claim Division claim..." />
                </SelectTrigger>
                <SelectContent>
                  {claims.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.claim_reference} — {c.claimant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Garage Name *</Label>
                <Input
                  value={form.garage_name}
                  onChange={(e) =>
                    setForm({ ...form, garage_name: e.target.value })
                  }
                  disabled={!canEdit}
                  placeholder="e.g. Belay Garage"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input
                  value={form.garage_location}
                  onChange={(e) =>
                    setForm({ ...form, garage_location: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Work Order #</Label>
                <Input
                  value={form.work_order_number}
                  onChange={(e) =>
                    setForm({ ...form, work_order_number: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WO Date</Label>
                <Input
                  type="date"
                  value={form.work_order_date}
                  onChange={(e) =>
                    setForm({ ...form, work_order_date: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Amount (ETB)</Label>
                <Input
                  type="number"
                  value={form.estimated_amount}
                  onChange={(e) =>
                    setForm({ ...form, estimated_amount: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Final Amount (ETB)</Label>
                <Input
                  type="number"
                  value={form.final_amount}
                  onChange={(e) =>
                    setForm({ ...form, final_amount: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Repair Description</Label>
              <Input
                value={form.repair_description}
                onChange={(e) =>
                  setForm({ ...form, repair_description: e.target.value })
                }
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GARAGE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s] || s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Completion Date</Label>
                <Input
                  type="date"
                  value={form.completion_date}
                  onChange={(e) =>
                    setForm({ ...form, completion_date: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                disabled={!canEdit}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
