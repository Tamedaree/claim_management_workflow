const GIO_HIERARCHY = [
  "secretary",
  "gio_principal_claim_officer",
  "gio_claim_manager",
  "director",
  "senior_director",
  "chief_of_gio",
  "ceo",
];

export function canActOnGioStage(actorRole, stageRole) {
  if (!actorRole) return false;
  if (actorRole === "admin") return true;
  if (!stageRole) return false;
  if (actorRole === stageRole) return true;
  const a = GIO_HIERARCHY.indexOf(actorRole);
  const s = GIO_HIERARCHY.indexOf(stageRole);
  return a > -1 && s > -1 && a > s;
}
