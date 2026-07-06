import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { useAppStore } from "../store/appStore";
import type { ExecutionLog } from "../types/domain";

export function CallDetailPage() {
  const { selectedSession, latestLogs, setScreen } = useAppStore();
  const sessionId = selectedSession?.id;
  const { data: logs = latestLogs } = useQuery({
    queryKey: ["session-logs", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => (await api.get<ExecutionLog[]>(`/call-sessions/${sessionId}/logs`)).data
  });
  const { data: transcript = [] } = useQuery({
    queryKey: ["transcript", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => (await api.get<Array<{ speaker: string; text: string; confidence?: number }>>(`/call-sessions/${sessionId}/transcript`)).data
  });

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <button className="btn" onClick={() => setScreen("sessions")} style={{ marginBottom: 14 }}>Back to sessions</button>
      <div className="panel inline" style={{ gap: 24, padding: "18px 22px", marginBottom: 16 }}>
        <div><div className="label">Session</div><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{sessionId ?? "se_9f2a71c4"}</div></div>
        <div><div className="label">Caller</div><div className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{selectedSession?.callerNumber ?? "+1 415 555 0142"}</div></div>
        <div><div className="label">Flow</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>Inbound Support Bot v3</div></div>
        <Badge tone={selectedSession?.finalResult === "Escalated" ? "indigo" : "teal"}>{selectedSession?.finalResult ?? "Escalated"}</Badge>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div className="panel">
          <div className="panel-header"><div style={{ fontWeight: 600 }}>Flow execution timeline</div></div>
          <div style={{ padding: 20 }}>
            {(logs.length ? logs : [
              { id: "1", sequence: 1, nodeType: "start", eventType: "call.started", latencyMs: 0, status: "OK", outputJson: {}, nodeId: "start", createdAt: "" },
              { id: "2", sequence: 2, nodeType: "voiceBot", eventType: "voicebot.completed", latencyMs: 812, status: "OK", outputJson: {}, nodeId: "voicebot", createdAt: "" }
            ]).map((log) => (
              <div className="inline" key={log.id} style={{ gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border2)" }}>
                <span className="dot" style={{ color: log.status === "BRANCH" ? "var(--amber)" : "var(--teal)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{log.nodeType}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{log.eventType}</div>
                </div>
                <span className="mono muted" style={{ fontSize: 12 }}>{log.latencyMs}ms</span>
                <Badge tone={log.status === "BRANCH" ? "amber" : "green"}>{log.status}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="panel" style={{ padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Transcript</div>
          {(transcript.length ? transcript : [
            { speaker: "bot", text: "Hi, thanks for calling Northwind Support. How can I help today?" },
            { speaker: "caller", text: "I need to check my order status." }
          ]).map((line, index) => (
            <div key={`${line.speaker}-${index}`} style={{ textAlign: line.speaker === "caller" ? "right" : "left", marginBottom: 12 }}>
              <div style={{ display: "inline-block", maxWidth: "82%", textAlign: "left", padding: "9px 13px", borderRadius: line.speaker === "caller" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: line.speaker === "caller" ? "var(--surface2)" : "var(--teal50)", border: line.speaker === "caller" ? "1px solid var(--border)" : "0", fontSize: 12.5 }}>
                {line.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
