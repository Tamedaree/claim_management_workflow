import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Bell,
  Settings,
  Users,
  BarChart3,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Wrench,
  Workflow,
} from "lucide-react";
import {
  canApproveClaims,
  canConfigureSystem,
  canViewAllClaims,
  canViewMyClaims,
  canViewGarages,
  canRegisterClaims,
  ROLE_LABELS,
} from "@/lib/roleConfig";
import { cn } from "@/lib/utils";

export default function Sidebar({
  user,
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}) {
  const location = useLocation();
  const role = user?.role || "claim_adjuster";

  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/", show: true },
    { label: "Search & Monitor", icon: Search, path: "/search", show: true },
    {
      label: "Register Claim",
      icon: FileText,
      path: "/claims/register",
      show: canRegisterClaims(role),
    },
    {
      label: "My Claims",
      icon: FileText,
      path: "/claims",
      show: canViewMyClaims(role),
    },
    {
      label: "Approvals",
      icon: ClipboardCheck,
      path: "/approvals",
      show: canApproveClaims(role),
    },
    {
      label: "All Claims",
      icon: FileText,
      path: "/claims/all",
      show: canViewAllClaims(role),
    },
    {
      label: "Garage Tracking",
      icon: Wrench,
      path: "/garages",
      show: canViewGarages(role),
    },
    { label: "Reports", icon: BarChart3, path: "/reports", show: true },
    { label: "Notifications", icon: Bell, path: "/notifications", show: true },
    {
      label: "User Management",
      icon: Users,
      path: "/admin/users",
      show: canConfigureSystem(role),
    },
    {
      label: "Approval Thresholds",
      icon: Settings,
      path: "/admin/thresholds",
      show: canConfigureSystem(role),
    },
    {
      label: "Workflow Stages",
      icon: Workflow,
      path: "/admin/workflow",
      show: canConfigureSystem(role),
    },
    {
      label: "Audit Trail",
      icon: Shield,
      path: "/audit",
      show: canApproveClaims(role) || canConfigureSystem(role),
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const displayName =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "User";

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-screen z-50 flex flex-col transition-all duration-300",
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        "w-[260px]",
        collapsed && "lg:w-[68px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0",
          collapsed && "lg:justify-center lg:px-2",
        )}
      >
        <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-sm text-gray-900 shrink-0">
          EIC
        </div>
        <div className={cn("overflow-hidden", collapsed && "lg:hidden")}>
          <p className="text-sm font-semibold leading-tight truncate">
            EIC Claims
          </p>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">
            Workflow System
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  collapsed && "lg:justify-center lg:px-2",
                  isActive
                    ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className={cn("truncate", collapsed && "lg:hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div
          className={cn(
            "flex items-center gap-3 mb-3 px-1",
            collapsed && "lg:hidden",
          )}
        >
          <div className="w-8 h-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-xs font-medium truncate">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">
              {ROLE_LABELS?.[role] || role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-1",
              collapsed && "lg:justify-center lg:px-2",
            )}
            title="Logout"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Sign Out</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="hidden lg:flex p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
