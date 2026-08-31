import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/roleConfig";

export default function ExistingClaimAlert({ claim, onView }) {
  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">This claim is already registered</p>
          <p className="text-xs text-amber-700 mt-0.5">
            {claim.claimant_name} — {claim.insurance_type} — {formatCurrency(claim.claim_amount || 0)} — Status: {claim.status}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onView} className="gap-1.5 shrink-0">
        View Claim <ExternalLink className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}