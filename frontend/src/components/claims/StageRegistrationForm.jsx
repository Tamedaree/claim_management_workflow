import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStageFields } from "@/lib/stageFieldConfig";

const PARTICIPANT_TYPES = ["Garage", "Dealer", "Supplier"];

const emptyParticipant = () => ({
  participant_type: "Garage",
  name: "",
  contact_person: "",
  phone: "",
  bid_amount: "",
  remarks: "",
});

const participantNameLabel = (type) => {
  if (type === "Dealer") return "Dealer Name";
  if (type === "Supplier") return "Supplier Name";
  return "Garage Name";
};

function FieldInput({ field, value, onChange }) {
  switch (field.type) {
    case "date":
      return (
        <Input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "currency":
      return (
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          rows={2}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );

    case "select":
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>

          <SelectContent>
            {(field.options || []).map((o) => (
              <SelectItem key={o} value={o}>
                {String(o).replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "yesno":
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="Yes">Yes</SelectItem>
            <SelectItem value="No">No</SelectItem>
          </SelectContent>
        </Select>
      );

    case "multitext":
      return (
        <Textarea
          rows={3}
          value={Array.isArray(value) ? value.join("\n") : value || ""}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder={field.placeholder}
        />
      );

    case "participant_list": {
      const list = Array.isArray(value) ? value : [];

      const setList = (next) => onChange(next);

      const updateRow = (idx, patch) => {
        const next = list.map((row, i) =>
          i === idx ? { ...row, ...patch } : row,
        );
        setList(next);
      };

      return (
        <div className="space-y-3">
          {list.map((row, idx) => (
            <div
              key={idx}
              className="space-y-2 p-3 rounded-lg border border-border bg-background"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  Participant {idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-600"
                  onClick={() => setList(list.filter((_, i) => i !== idx))}
                >
                  Remove
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Participant Type</Label>
                <Select
                  value={row.participant_type || "Garage"}
                  onValueChange={(v) => updateRow(idx, { participant_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTICIPANT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  {participantNameLabel(row.participant_type)}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={row.name || ""}
                  onChange={(e) => updateRow(idx, { name: e.target.value })}
                  placeholder={participantNameLabel(row.participant_type)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Contact Person</Label>
                  <Input
                    value={row.contact_person || ""}
                    onChange={(e) =>
                      updateRow(idx, { contact_person: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone Number</Label>
                  <Input
                    value={row.phone || ""}
                    onChange={(e) => updateRow(idx, { phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Bid Amount (ETB)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.bid_amount ?? ""}
                  onChange={(e) =>
                    updateRow(idx, { bid_amount: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Remarks</Label>
                <Textarea
                  rows={2}
                  value={row.remarks || ""}
                  onChange={(e) => updateRow(idx, { remarks: e.target.value })}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setList([...list, emptyParticipant()])}
          >
            + Add participant
          </Button>
        </div>
      );
    }

    case "checklist": {
      const selected = Array.isArray(value) ? value : [];

      return (
        <div className="space-y-1.5">
          {(field.options || []).map((o) => (
            <label
              key={o}
              className="flex items-center gap-2 text-xs cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={() =>
                  onChange(
                    selected.includes(o)
                      ? selected.filter((x) => x !== o)
                      : [...selected, o],
                  )
                }
              />

              {o}
            </label>
          ))}
        </div>
      );
    }

    default:
      return (
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

export default function StageRegistrationForm({
  stageName,
  value = {},
  onChange,
}) {
  const fields = getStageFields(stageName).filter((field) => {
    if (!field.showWhen) return true;

    return value?.[field.showWhen.key] === field.showWhen.value;
  });

  if (fields.length === 0) return null;

  const setField = (key, v) => {
    onChange({
      ...value,
      [key]: v,
    });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <p className="text-xs font-medium text-muted-foreground">Stage details</p>

      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs">{field.label}</Label>

          <FieldInput
            field={field}
            value={value[field.key]}
            onChange={(v) => setField(field.key, v)}
          />
        </div>
      ))}
    </div>
  );
}

export function StageDataSummary({ stageName, data }) {
  const fields = getStageFields(stageName).filter((field) => {
    if (!field.showWhen) return true;

    return data?.[field.showWhen.key] === field.showWhen.value;
  });

  const entries = fields
    .map((field) => ({
      label: field.label,
      value: data?.[field.key],
      type: field.type,
    }))
    .filter(
      (entry) =>
        entry.value !== undefined &&
        entry.value !== null &&
        entry.value !== "" &&
        !(Array.isArray(entry.value) && entry.value.length === 0),
    );

  if (entries.length === 0) return null;

  return (
    <div className="mt-2 p-2 bg-muted/40 rounded-md text-[10px] space-y-0.5">
      {entries.map((entry) => (
        <div key={entry.label}>
          <span className="text-muted-foreground">{entry.label}: </span>
          <span className="font-medium">
            {entry.type === "participant_list" && Array.isArray(entry.value)
              ? entry.value
                  .map((p) => {
                    const type = p.participant_type || "Garage";
                    const name = p.name || "—";
                    const amt =
                      p.bid_amount !== undefined &&
                      p.bid_amount !== null &&
                      p.bid_amount !== ""
                        ? ` · Bid: ${Number(p.bid_amount).toLocaleString()} ETB`
                        : "";
                    return `${type} — ${name}${amt}`;
                  })
                  .join("; ")
              : Array.isArray(entry.value)
                ? entry.value.join(", ")
                : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StageApprovalHistory({ approvals }) {
  if (!Array.isArray(approvals) || approvals.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 p-2 bg-blue-50/50 rounded-md text-[10px] space-y-1 border border-blue-100">
      <p className="font-medium text-blue-800">Approval trail</p>

      {approvals.map((approval, index) => (
        <div key={index} className="text-blue-700">
          {approval.role_label || approval.role} — {approval.name} ·{" "}
          {approval.at ? new Date(approval.at).toLocaleString() : ""}
          {approval.comments ? ` — "${approval.comments}"` : ""}
        </div>
      ))}
    </div>
  );
}
