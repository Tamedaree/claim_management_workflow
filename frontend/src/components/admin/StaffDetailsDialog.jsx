import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roleConfig";
import moment from "moment";

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-border/60 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className="text-sm font-medium text-right break-words">
      {value || "—"}
    </span>
  </div>
);

export default function StaffDetailsDialog({ staff, onClose }) {
  if (!staff) return null;
  const fullName = [staff.first_name, staff.middle_name, staff.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog open={!!staff} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-base font-semibold shrink-0">
            {(fullName || staff.email || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">{fullName || "Unnamed"}</p>
            <p className="text-xs text-muted-foreground">{staff.email}</p>
          </div>
          <Badge
            variant="secondary"
            className={`ml-auto text-[10px] ${staff.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}
          >
            {staff.status}
          </Badge>
        </div>
        <div className="space-y-0">
          <Row label="Role" value={ROLE_LABELS[staff.role] || staff.role} />
          <Row label="Work Location Type" value={staff.work_location_type} />
          <Row label="Employee ID" value={staff.employee_id} />
          <Row label="Gender" value={staff.gender} />
          <Row label="Phone" value={staff.phone} />
          <Row label="Department" value={staff.department} />
          <Row label="Work Location" value={staff.work_location} />
          <Row
            label="Joining Date"
            value={
              staff.joining_date
                ? moment(staff.joining_date).format("DD MMM YYYY")
                : null
            }
          />
          <Row
            label="Login Account"
            value={staff.invited ? "Provisioned" : "Not yet created"}
          />
          <Row label="Notes" value={staff.notes} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
