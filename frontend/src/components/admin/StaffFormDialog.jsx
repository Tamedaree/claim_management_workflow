import { useState } from "react";
import api from "@/api/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { KeyRound, RefreshCw } from "lucide-react";
import { ROLE_LABELS, DEPARTMENT_OPTIONS } from "@/lib/roleConfig";

const ROLES = Object.entries(ROLE_LABELS);

const EMPTY = {
  email: "",
  password: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  phone: "",
  role: "claim_adjuster",
  work_location: "Head Office",
  department: "",
  joining_date: "",
  employee_id: "",
  notes: "",
  status: "Active",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;
const NAME_RE = /^[A-Za-z\s.'-]{2,}$/;

// eslint-disable-next-line react-refresh/only-export-components
export function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

async function validate(form, isEdit, initialId) {
  const e = {};

  if (!form.first_name?.trim()) e.first_name = "First name is required";
  else if (!NAME_RE.test(form.first_name.trim()))
    e.first_name = "Letters only, min 2 characters";

  if (!form.last_name?.trim()) e.last_name = "Last name is required";
  else if (!NAME_RE.test(form.last_name.trim()))
    e.last_name = "Letters only, min 2 characters";

  if (
    form.middle_name &&
    form.middle_name.trim() &&
    !NAME_RE.test(form.middle_name.trim())
  ) {
    e.middle_name = "Letters only, min 2 characters";
  }

  if (!form.email?.trim()) e.email = "Email is required";
  else if (!EMAIL_RE.test(form.email.trim()))
    e.email = "Enter a valid email address";

  if (!isEdit && form.email?.trim() && EMAIL_RE.test(form.email.trim())) {
    try {
      const res = await api.get(
        `/staff?email=${encodeURIComponent(form.email.trim())}`,
      );
      const existing = res.data.data || [];
      if (existing.length > 0)
        e.email = "A user with this email already exists";
    } catch {
      // ignore
    }
  }

  if (!isEdit) {
    if (!form.password?.trim()) e.password = "Password is required";
    else if (form.password.trim().length < 8)
      e.password = "Password must be at least 8 characters";
  }

  if (!form.phone?.trim()) e.phone = "Phone number is required";
  else if (!PHONE_RE.test(form.phone.trim()))
    e.phone = "Enter a valid phone number";

  if (!form.role) e.role = "Role is required";

  if (form.employee_id && form.employee_id.trim()) {
    if (form.employee_id.trim().length < 2) {
      e.employee_id = "Min 2 characters";
    } else {
      try {
        const res = await api.get(
          `/staff?employee_id=${encodeURIComponent(form.employee_id.trim())}`,
        );
        const existing = res.data.data || [];
        const duplicate = existing.some((s) => s.id !== initialId);
        if (duplicate) e.employee_id = "This Employee ID is already in use";
      } catch {
        // ignore
      }
    }
  }

  if (form.department && form.department.trim().length < 2)
    e.department = "Min 2 characters";

  if (form.work_location && form.work_location.trim().length < 2)
    e.work_location = "Min 2 characters";

  if (form.joining_date) {
    const d = new Date(form.joining_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (isNaN(d.getTime())) e.joining_date = "Invalid date";
    else if (d > today) e.joining_date = "Date cannot be in the future";
  }

  return e;
}

const FieldError = ({ msg }) =>
  msg ? <p className="text-[10px] text-red-600 mt-0.5">{msg}</p> : null;

export default function StaffFormDialog({
  open,
  onClose,
  onSave,
  initial,
  saving,
}) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [validating, setValidating] = useState(false);
  const isEdit = !!initial;

  const resetForm = (data = null) => {
    setForm(data ? { ...EMPTY, ...data } : { ...EMPTY });
    setErrors({});
    setTouched({});
  };

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      resetForm(initial || null);
    } else {
      onClose();
    }
  };

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (touched[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const blur = async (k) => {
    setTouched((t) => ({ ...t, [k]: true }));
    setValidating(true);
    const e = await validate(form, isEdit, initial?.id);
    setErrors((prev) => ({ ...prev, [k]: e[k] }));
    setValidating(false);
  };

  const handleSubmit = async () => {
    setValidating(true);
    const e = await validate(form, isEdit, initial?.id);
    setErrors(e);
    setTouched(
      Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {}),
    );
    setValidating(false);
    if (Object.values(e).some(Boolean)) return;
    onSave(form);
  };

  const errClass = (field) =>
    errors[field] ? "border-red-500 focus-visible:ring-red-500" : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        key={open ? `staff-${initial?.id || "new"}` : "closed"}
        onOpenAutoFocus={() => resetForm(initial || null)}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add New User"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                onBlur={() => blur("first_name")}
                className={errClass("first_name")}
              />
              <FieldError msg={touched.first_name && errors.first_name} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Middle Name</Label>
              <Input
                value={form.middle_name}
                onChange={(e) => set("middle_name", e.target.value)}
                onBlur={() => blur("middle_name")}
                className={errClass("middle_name")}
              />
              <FieldError msg={touched.middle_name && errors.middle_name} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                onBlur={() => blur("last_name")}
                className={errClass("last_name")}
              />
              <FieldError msg={touched.last_name && errors.last_name} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email Address *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => blur("email")}
                placeholder="user@eic.com.et"
                disabled={isEdit}
                className={errClass("email")}
              />
              <FieldError msg={touched.email && errors.email} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number *</Label>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                onBlur={() => blur("phone")}
                placeholder="+251..."
                className={errClass("phone")}
              />
              <FieldError msg={touched.phone && errors.phone} />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  onBlur={() => blur("password")}
                  placeholder="Set a password for this user"
                  className={errClass("password")}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => set("password", generatePassword())}
                  title="Generate a secure password"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <FieldError msg={touched.password && errors.password} />
              <p className="text-[10px] text-muted-foreground">
                Share this password with the user directly. They'll log in with
                their email and this password.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => set("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Employee ID</Label>
              <Input
                value={form.employee_id}
                onChange={(e) => set("employee_id", e.target.value)}
                onBlur={() => blur("employee_id")}
                className={errClass("employee_id")}
              />
              <FieldError msg={touched.employee_id && errors.employee_id} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Joining Date</Label>
              <Input
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={form.joining_date}
                onChange={(e) => set("joining_date", e.target.value)}
                onBlur={() => blur("joining_date")}
                className={errClass("joining_date")}
              />
              <FieldError msg={touched.joining_date && errors.joining_date} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Role *</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger className={errClass("role")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={touched.role && errors.role} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select
                value={form.department}
                onValueChange={(v) => set("department", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={touched.department && errors.department} />
            </div>
          </div>

          {!isEdit && (
            <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-100 p-3">
              <KeyRound className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-800 leading-relaxed">
                This creates a login account immediately with the password
                above. Give the user their email and password directly — there's
                no separate invite step.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Additional information..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || validating}>
            {saving
              ? "Saving..."
              : validating
                ? "Validating..."
                : isEdit
                  ? "Save Changes"
                  : "Add User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
