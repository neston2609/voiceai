import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { useAppStore } from "../store/appStore";
import type { CallSession } from "../types/domain";

export function SessionsPage() {
  const { setSelectedSession, setScreen } = useAppStore();
  const { data = [] } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await api.get<CallSession[]>("/call-sessions")).data });
  const sessions = data.map((session) => ({
      id: session.id,
      callerNumber: session.callerNumber,
      flow: "Inbound Support",
      duration: `${session.durationSeconds ?? 0}s`,
      latency: "0.9s",
      outcome: session.finalResult ?? session.status,
      tone: session.finalResult === "Escalated" ? "indigo" : "teal",
      time: "now",
      raw: session
    }));

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <div className="inline" style={{ gap: 10, marginBottom: 16 }}>
        <div className="input muted" style={{ width: 260 }}>Search caller, flow</div>
        <button className="btn">Outcome</button>
        <button className="btn">Flow</button>
        <button className="btn">Last 24h</button>
      </div>
      <div className="panel" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead><tr><th>Session ID</th><th>Caller</th><th>Flow</th><th>Duration</th><th>AI latency</th><th>Outcome</th><th>Time</th></tr></thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} onClick={() => { if (session.raw) setSelectedSession(session.raw); setScreen("detail"); }} style={{ cursor: "pointer" }}>
                <td className="mono" style={{ color: "var(--indigo)", fontWeight: 500 }}>{session.id}</td>
                <td className="mono">{session.callerNumber}</td>
                <td>{session.flow}</td>
                <td className="mono subtle">{session.duration}</td>
                <td className="mono subtle">{session.latency}</td>
                <td><Badge tone={session.tone}>{session.outcome}</Badge></td>
                <td className="muted">{session.time}</td>
              </tr>
            ))}
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 28 }}>No live call sessions recorded yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
