import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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

export default function ForgotPassword() {
  return (
    <AuthLayout
      icon={LoginLogoIcon}
      title="Password recovery"
      subtitle="Contact your System Administrator"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />
          Back to log in
        </Link>
      }
    >
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground space-y-2">
        <p className="font-medium">
          For security, password recovery is managed by the System
          Administrator.
        </p>
        <p className="text-muted-foreground">
          Please contact your System Administrator to reset your password. You
          will receive a temporary password and must change it after you log in.
        </p>
      </div>
    </AuthLayout>
  );
}
