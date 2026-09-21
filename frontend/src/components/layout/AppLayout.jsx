import { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import api from "@/api/api";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppLayout() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/auth/me");
        const u = res.data?.user ?? res.data?.data ?? res.data;
        if (!cancelled) {
          setUser(u);
          localStorage.setItem("user", JSON.stringify(u));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          localStorage.removeItem("user");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token" && !e.newValue) {
        setUser(null);
        window.location.href = "/login";
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password?forced=1" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar
        user={user}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={[
          "min-h-screen transition-[margin] duration-300 ease-in-out",
          "lg:ml-[260px]",
          collapsed ? "lg:ml-[68px]" : "",
        ].join(" ")}
      >
        <TopBar user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-5 lg:p-6 max-w-[1600px] mx-auto">
          <Outlet context={{ user, setUser }} />
        </main>
      </div>
    </div>
  );
}
