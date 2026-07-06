import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { useAppStore } from "../store/appStore";
import type { CallSession } from "../types/domain";

type DashboardSummary = {
  totalCallsToday: number;
  activeCalls: number;
  botResolvedRate: number;
  escalatedCalls: number;
  failedCalls: number;
  averageDurationSeconds: number;
  averageAiResponseMs: number;
  averageSttConfidence: number;
  topFallbackReasons: string[];
  latestSessions: CallSession[];
};

type DashboardCharts = {
  callResults: Array<{ day: string; resolved: number; escalated: number; failed: number }>;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

export function DashboardPage() {
  const setScreen = useAppStore((state) => state.setScreen);
  const { data: summary } = useQuery({ queryKey: ["dashboard-summary"], queryFn: async () => (await api.get<DashboardSummary>("/dashboard/summary")).data });
  const { data: charts } = useQuery({ queryKey: ["dashboard-charts"], queryFn: async () => (await api.get<DashboardCharts>("/dashboard/charts")).data });
  const callChart = charts?.callResults ?? [];
  const kpis = [
    { label: "Total calls", value: String(summary?.totalCallsToday ?? 0), sub: "today", delta: "Live", tone: "green" },
    { label: "Bot resolved", value: `${summary?.botResolvedRate ?? 0}%`, sub: `${summary?.escalatedCalls ?? 0} escalated`, delta: "Live", tone: "green" },
    { label: "Avg duration", value: formatDuration(summary?.averageDurationSeconds ?? 0), sub: "per call", delta: "Live", tone: "green" },
    { label: "AI response", value: `${summary?.averageAiResponseMs ?? 0}ms`, sub: "average latency", delta: "Live", tone: "green" }
  ];
  const activeCalls = summary?.latestSessions.filter((session) => session.status === "ACTIVE") ?? [];

  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <div className="panel inline" style={{ gap: 16, padding: "14px 18px", marginBottom: 20, background: "linear-gradient(100deg,var(--indigo50),#fff 65%)", borderColor: "var(--indigo100)" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--indigo)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>6</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Setup checklist - 6 of 7 complete</div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>Last step: publish your first production flow to go live.</div>
          <div style={{ height: 6, background: "var(--indigo100)", borderRadius: 20, marginTop: 9, overflow: "hidden", maxWidth: 520 }}>
            <div style={{ width: "86%", height: "100%", background: "var(--indigo)" }} />
          </div>
        </div>
        <button className="btn primary" onClick={() => setScreen("builder")}>Finish setup</button>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        {kpis.map((kpi) => (
          <div className="panel" key={kpi.label} style={{ padding: "16px 17px" }}>
            <div className="row-between">
              <span className="subtle" style={{ fontSize: 12, fontWeight: 500 }}>{kpi.label}</span>
              <Badge tone={kpi.tone}>{kpi.delta}</Badge>
            </div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.5px", marginTop: 8 }}>{kpi.value}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="panel" style={{ padding: "18px 20px" }}>
            <div className="row-between" style={{ marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Call outcomes</div>
                <div className="muted" style={{ fontSize: 11.5 }}>Last 7 days - live sessions only</div>
              </div>
              <div className="inline" style={{ gap: 14, fontSize: 11.5 }}>
                <span className="inline" style={{ gap: 5 }}><span className="dot" style={{ color: "var(--teal)" }} />Bot resolved</span>
                <span className="inline" style={{ gap: 5 }}><span className="dot" style={{ color: "var(--indigo)" }} />Escalated</span>
                <span className="inline" style={{ gap: 5 }}><span className="dot" style={{ color: "var(--red)" }} />Failed</span>
              </div>
            </div>
            <div className="stack-chart">
              {callChart.map((day) => (
                <div className="stack-day" key={day.day}>
                  <div className="stack-bar">
                    <span style={{ height: day.failed, background: "var(--red)" }} />
                    <span style={{ height: day.escalated, background: "var(--indigo)" }} />
                    <span style={{ height: day.resolved, background: "var(--teal)" }} />
                  </div>
                  <span>{day.day}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="row-between" style={{ padding: "15px 20px 12px" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Latest call sessions</div>
              <button className="btn" onClick={() => setScreen("sessions")}>View all</button>
            </div>
            <table className="table">
              <thead><tr><th>Caller</th><th>Flow</th><th>Duration</th><th>Outcome</th><th>Time</th></tr></thead>
              <tbody>
                {(summary?.latestSessions ?? []).map((session) => (
                  <tr key={session.id}>
                    <td className="mono">{session.callerNumber}</td>
                    <td>Inbound Support</td>
                    <td className="mono subtle">{formatDuration(session.durationSeconds ?? 0)}</td>
                    <td><Badge tone={session.finalResult === "Escalated" ? "indigo" : session.status === "FAILED" ? "red" : "teal"}>{session.finalResult ?? session.status}</Badge></td>
                    <td className="muted">{new Date(session.startedAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {(summary?.latestSessions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 28 }}>No live call sessions recorded yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Active calls</div>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}>{summary?.activeCalls ?? 0} currently running</div>
            {activeCalls.map((session) => (
              <div className="row-between" key={session.id} style={{ padding: "9px 0", borderTop: "1px solid var(--border2)" }}>
                <span className="mono" style={{ fontSize: 12 }}>{session.callerNumber}</span>
                <Badge tone="teal">{session.status}</Badge>
              </div>
            ))}
            {activeCalls.length === 0 ? <div className="muted" style={{ paddingTop: 10, fontSize: 12 }}>No active live calls.</div> : null}
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Top fallback reasons</div>
            {(summary?.topFallbackReasons ?? []).map((label, index) => (
              <div key={label} style={{ marginTop: 12 }}>
                <div className="row-between" style={{ fontSize: 12 }}>
                  <span>{label}</span><span className="muted">{34 - index * 5}%</span>
                </div>
                <div style={{ height: 5, background: "var(--border2)", borderRadius: 10, marginTop: 6 }}>
                  <div style={{ height: "100%", width: `${34 - index * 5}%`, background: index === 0 ? "var(--amber)" : "var(--indigo)", borderRadius: 10 }} />
                </div>
              </div>
            ))}
            {(summary?.topFallbackReasons ?? []).length === 0 ? <div className="muted" style={{ paddingTop: 12, fontSize: 12 }}>No fallback reasons recorded yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
