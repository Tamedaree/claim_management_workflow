import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/api/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, CheckCircle2, Circle } from "lucide-react";
import PasswordInput from "@/components/ui/password-input";
import AuthLayout from "@/components/AuthLayout";
import loginLogo from "@/assets/login_logo.png";

function LoginLogoIcon({ className }) {
  return (
    <img
      src={loginLogo}
      alt="eic-logo"
      className={`${className} object-contain`}
    />
  );
}

function Rule({ ok, text }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Circle className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span className={ok ? "text-emerald-600" : "text-muted-foreground"}>
        {text}
      </span>
    </div>
  );
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const rules = {
    length: form.newPassword.length >= 8,
    upper: /[A-Z]/.test(form.newPassword),
    lower: /[a-z]/.test(form.newPassword),
    number: /[0-9]/.test(form.newPassword),
    match:
      form.newPassword.length > 0 && form.newPassword === form.confirmPassword,
    different:
      form.currentPassword.length > 0 &&
      form.newPassword.length > 0 &&
      form.currentPassword !== form.newPassword,
  };

  const canSubmit =
    form.currentPassword &&
    rules.length &&
    rules.match &&
    rules.different &&
    !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please meet all password requirements");
      return;
    }

    setSaving(true);
    try {
      await api.put("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      toast.success("Password changed successfully. Please sign in again.");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      icon={LoginLogoIcon}
      title="Change password"
      subtitle="Create a strong password for your account"
      footer={
        <Link
          to="/profile"
          className="text-amber-400 hover:underline font-medium"
        >
          Back to profile
        </Link>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <PasswordInput
            id="currentPassword"
            value={form.currentPassword}
            onChange={(e) => updateField("currentPassword", e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <PasswordInput
            id="newPassword"
            value={form.newPassword}
            onChange={(e) => updateField("newPassword", e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            id="confirmPassword"
            value={form.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
            className="h-12"
          />
        </div>

        <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5">
          <Rule ok={rules.length} text="At least 8 characters" />
          <Rule ok={rules.upper} text="One uppercase letter" />
          <Rule ok={rules.lower} text="One lowercase letter" />
          <Rule ok={rules.number} text="One number" />
          <Rule ok={rules.match} text="Passwords match" />
          <Rule ok={rules.different} text="Different from current password" />
        </div>

        <Button
          type="submit"
          className="w-full h-12 font-medium"
          disabled={!canSubmit}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
