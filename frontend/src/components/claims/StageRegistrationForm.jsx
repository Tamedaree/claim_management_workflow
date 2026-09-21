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
import { getStageFields } from "@/lib/stageFieldConfig";

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
            {Array.isArray(entry.value)
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
