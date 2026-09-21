import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { REGISTRATION_TYPES } from "@/lib/claimRegistration";
import NewClaimNotificationForm from "@/components/claims/NewClaimNotificationForm";
import NewGioCaseForm from "@/components/claims/NewGioCaseForm";
import ClaimForApprovalForm from "@/components/claims/ClaimForApprovalForm";
import { FileText, Briefcase, ShieldCheck } from "lucide-react";

const TYPE_ICONS = {
  "New Claim Notification": FileText,
  "GIO Case": Briefcase,
  "Claim for Approval": ShieldCheck,
};

export default function ClaimRegister() {
  const { user } = useOutletContext();
  const [registrationType, setRegistrationType] = useState(
    "New Claim Notification",
  );

  const renderForm = () => {
    switch (registrationType) {
      case "GIO Case":
        return <NewGioCaseForm user={user} />;
      case "Claim for Approval":
        return <ClaimForApprovalForm user={user} />;
      default:
        return <NewClaimNotificationForm user={user} />;
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Register Incoming Claim
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select the registration type, then fill in the claim details
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {REGISTRATION_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t.value] || FileText;
              const active = registrationType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setRegistrationType(t.value)}
                  className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                    active
                      ? "border-primary bg-accent ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`mt-0.5 p-2 rounded-md ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {renderForm()}
    </div>
  );
}
