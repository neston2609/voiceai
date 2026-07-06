import { Bell, Mic, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { navGroups, pageMeta } from "../data/mock";
import { api, clearTokens } from "../api/client";
import { useAppStore, type Screen } from "../store/appStore";

export function Shell({ children }: { children: ReactNode }) {
  const { screen, setScreen, user, setUser } = useAppStore();
  const [crumb, title] = pageMeta[screen];
  const [health, setHealth] = useState({
    mockMode: false,
    services: { aiProvider: "checking", dialogflow: "checking", asterisk: "checking" }
  });

  useEffect(() => {
    api.get("/system/health").then(({ data }) => setHealth(data)).catch(() => undefined);
  }, []);

  function logout() {
    clearTokens();
    setUser(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Mic size={19} />
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
              VoiceFlow<span style={{ color: "var(--teal)" }}>AI</span>
            </div>
            <div style={{ fontSize: 10.5, color: "#6B7690", fontWeight: 500, marginTop: 2 }}>Bot Flow Builder</div>
          </div>
        </div>
        <nav className="nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-title">{group.title}</div>
              {group.items.map((item) => (
                <button key={item.id} className={`nav-link ${screen === item.id ? "active" : ""}`} onClick={() => setScreen(item.id as Screen)}>
                  <span className="nav-icon">
                    <item.icon size={18} />
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge ? <span className="badge indigo">{item.badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="health">
          <div className="nav-title" style={{ padding: 0, marginBottom: 9 }}>
            System Health
          </div>
          <div className="health-row" style={{ color: "var(--green)" }}>
            <span className="dot" /> <span style={{ color: "#C4CBDA" }}>AI Provider</span>
            <span style={{ marginLeft: "auto", color: "#7E88A0", fontSize: 11 }}>{health.services.aiProvider}</span>
          </div>
          <div className="health-row" style={{ color: "var(--green)" }}>
            <span className="dot" /> <span style={{ color: "#C4CBDA" }}>Dialogflow</span>
            <span style={{ marginLeft: "auto", color: "#7E88A0", fontSize: 11 }}>{health.services.dialogflow}</span>
          </div>
          <div className="health-row" style={{ color: health.services.asterisk === "connected" ? "var(--green)" : "var(--amber)" }}>
            <span className="dot" /> <span style={{ color: "#C4CBDA" }}>Asterisk ARI</span>
            <span style={{ marginLeft: "auto", color: "#7E88A0", fontSize: 11 }}>{health.services.asterisk}</span>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 500 }}>{crumb}</div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.2px", lineHeight: 1.1 }}>{title}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="inline topbar-search" style={{ gap: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 11px", width: 230, color: "var(--ink3)" }}>
              <Search size={15} />
              <span style={{ fontSize: 12.5 }}>Search flows, calls</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10, border: "1px solid var(--border)", borderRadius: 4, padding: "0 5px" }}>
                Ctrl K
              </span>
            </div>
            <span className="badge green topbar-mock">
              <span className="dot" /> Live Mode
            </span>
            <button className="btn" aria-label="Notifications">
              <Bell size={16} />
            </button>
            <button className="btn topbar-user" onClick={logout}>
              {user?.fullName ?? "Admin"}
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
