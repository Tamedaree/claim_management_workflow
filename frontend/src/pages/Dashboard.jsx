import { useOutletContext } from "react-router-dom";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import ClaimAdjusterDashboard from "@/components/dashboards/ClaimAdjusterDashboard";
import GioClaimAdjusterDashboard from "@/components/dashboards/GioClaimAdjusterDashboard";
import SecretaryDashboard from "@/components/dashboards/SecretaryDashboard";
import SurveyorDashboard from "@/components/dashboards/SurveyorDashboard";
import ApproverDashboard from "@/components/dashboards/ApproverDashboard";
import PrincipalClaimOfficerDashboard from "@/components/dashboards/PrincipalClaimOfficerDashboard";
import ClaimsProcessingTable from "@/components/dashboards/ClaimsProcessingTable";
import { isApprovalRole } from "@/lib/roleConfig";

export default function Dashboard() {
  const { user } = useOutletContext();
  const role = user?.role || "claim_adjuster";

  let dashboard;
  if (role === "admin") {
    dashboard = <AdminDashboard />;
  } else if (role === "secretary") {
    dashboard = <SecretaryDashboard />;
  } else if (role === "claim_adjuster") {
    dashboard = <ClaimAdjusterDashboard />;
  } else if (role === "gio_claim_adjuster") {
    dashboard = <GioClaimAdjusterDashboard />;
  } else if (role === "surveyor") {
    dashboard = <SurveyorDashboard />;
  } else if (role === "principal_claim_officer") {
    dashboard = <PrincipalClaimOfficerDashboard />;
  } else if (
    [
      "claim_manager",
      "gio_claim_manager",
      "director",
      "chief_of_gio",
      "ceo",
    ].includes(role)
  ) {
    dashboard = <ApproverDashboard />;
  } else {
    dashboard = <ClaimAdjusterDashboard />;
  }

  // ClaimsProcessingTable shows approval stats — only relevant for approval roles & admin
  const showProcessingTable = isApprovalRole(role) || role === "admin";

  return (
    <div className="space-y-6">
      {dashboard}
      {showProcessingTable && <ClaimsProcessingTable />}
    </div>
  );
}
