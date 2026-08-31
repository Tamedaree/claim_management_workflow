import { useState } from "react";
import { checkExistingClaim } from "@/lib/claimRegistration";

export function useExistingClaimCheck() {
  const [existingClaim, setExistingClaim] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = async (reference) => {
    if (!reference || reference.trim().length < 3) {
      setExistingClaim(null);
      return;
    }
    setChecking(true);
    try {
      const found = await checkExistingClaim(reference);
      setExistingClaim(found);
    } catch {
      setExistingClaim(null);
    } finally {
      setChecking(false);
    }
  };

  return {
    existingClaim,
    checking,
    check,
    clear: () => setExistingClaim(null),
  };
}
