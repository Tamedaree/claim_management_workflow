import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/roleConfig";

/**
 * @param {{ claim: object, onView: () => void, title?: string }} props
 */
export default function ExistingClaimAlert({
  claim,
  onView,
  title = "This claim is already registered",
}) {
  if (!claim) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">{title}</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-amber-950/90">
            <p>
              <span className="text-amber-800/70">Reference · </span>
              {claim.claim_reference || "—"}
            </p>
            <p>
              <span className="text-amber-800/70">Claim no. · </span>
              {claim.claim_number || "—"}
            </p>
            <p>
              <span className="text-amber-800/70">Insured · </span>
              {claim.claimant_name || "—"}
            </p>
            <p>
              <span className="text-amber-800/70">Type · </span>
              {claim.insurance_type || "—"}
            </p>
            <p>
              <span className="text-amber-800/70">Status · </span>
              {claim.status?.replace(/_/g, " ") || "—"}
            </p>
            <p>
              <span className="text-amber-800/70">Amount · </span>
              {formatCurrency(claim.claim_amount || 0)}
            </p>
            <p>
              <span className="text-amber-800/70">Stage · </span>
              {claim.workflow_stage || "—"}
            </p>
            <p>
              <span className="text-amber-800/70">Office · </span>
              {claim.originating_office || "—"}
            </p>
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onView}
        className="gap-1.5 border-amber-300 bg-white hover:bg-amber-50"
      >
        View claim <ExternalLink className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
