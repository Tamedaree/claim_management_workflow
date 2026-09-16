import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";

// Auth pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Profile from "@/pages/Profile";
import ChangePassword from "@/pages/ChangePassword";

// Layout
import AppLayout from "@/components/layout/AppLayout";

// Pages
import Dashboard from "@/pages/Dashboard";
import ClaimRegister from "@/pages/ClaimRegister";
import MyClaims from "@/pages/MyClaims";
import ClaimDetail from "@/pages/ClaimDetail";
import AllClaims from "@/pages/AllClaims";
import Notifications from "@/pages/Notifications";
import Reports from "@/pages/Reports";
import AuditTrail from "@/pages/AuditTrail";
import SystemSettings from "@/pages/SystemSettings";
import AdminUsers from "@/pages/AdminUsers";
import AdminThresholds from "@/pages/AdminThresholds";
import WorkflowConfig from "@/pages/WorkflowConfig";
import GarageTracking from "@/pages/GarageTracking";
import ClaimSearch from "@/pages/ClaimSearch";

//claims
import CompleteClaimRegistration from "@/components/claims/CompleteClaimRegistration";

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center font-bold text-lg text-gray-900">
            EIC
          </div>
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    }
    if (authError.type === "auth_required") {
      return <Navigate to="/login" replace />;
    }
  }

  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute
            unauthenticatedElement={<Navigate to="/login" replace />}
          />
        }
      >
        {/* Full-screen auth UI (no sidebar) */}
        <Route path="/change-password" element={<ChangePassword />} />

        {/* App shell with sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/claims/register" element={<ClaimRegister />} />
          <Route path="/claims/all" element={<AllClaims />} />
          <Route
            path="/claims/:id/complete-registration"
            element={<CompleteClaimRegistration />}
          />
          <Route path="/claims/:id" element={<ClaimDetail />} />
          <Route path="/claims" element={<MyClaims />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/admin/system-settings" element={<SystemSettings />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/thresholds" element={<AdminThresholds />} />
          <Route path="/admin/workflow" element={<WorkflowConfig />} />
          <Route path="/garages" element={<GarageTracking />} />
          <Route path="/search" element={<ClaimSearch />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
