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
} from "@/lib/roleConfig";
import { useAuth } from "@/lib/AuthContext";

export default function Sidebar({ user, collapsed, onToggle }) {
  const { logout } = useAuth();
  const location = useLocation();
  const role = user?.role || "claim_adjuster";

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
      show: canViewMyClaims(role), // includes surveyor + register roles
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
      show: canViewAllClaims(role), // includes surveyor + approvers + admin
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
    logout();
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-[hsl(222,47%,11%)] text-[hsl(220,14%,92%)] flex flex-col transition-all duration-300 z-50 ${
        collapsed ? "w-[68px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-sm text-gray-900 shrink-0">
          EIC
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold leading-tight truncate">
              EIC Claims
            </p>
            <p className="text-[11px] text-white/50 truncate">
              Workflow System
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-amber-500/15 text-amber-400 font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white/90"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
      </nav>

      {/* Collapse + logout */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors flex-1"
            title="Logout"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
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
