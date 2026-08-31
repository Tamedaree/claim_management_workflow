import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import api from "@/api/api";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppLayout() {
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        const u = res.data.user || res.data.data || res.data;
        setUser(u);
        localStorage.setItem("user", JSON.stringify(u));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        user={user}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <div
        className={`transition-all duration-300 ${
          collapsed ? "ml-[68px]" : "ml-[260px]"
        }`}
      >
        <TopBar user={user} />
        <main className="p-6">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
