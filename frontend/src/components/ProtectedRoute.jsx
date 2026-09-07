import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

/**
 * @typedef {Object} ProtectedRouteProps
 * @property {import('react').ReactNode} [fallback]
 * @property {import('react').ReactNode} unauthenticatedElement
 */

/**
 * @param {ProtectedRouteProps} props
 */
export default function ProtectedRoute({
  fallback = <DefaultFallback />,
  unauthenticatedElement,
}) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, user } =
    useAuth();
  const location = useLocation();

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // Temp / admin-reset password → only allow change-password page
  if (user?.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password?forced=1" replace />;
  }

  return <Outlet />;
}
