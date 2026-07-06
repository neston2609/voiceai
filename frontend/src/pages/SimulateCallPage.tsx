import { useState } from "react";
import { Play, RotateCcw, StepForward } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { useAppStore } from "../store/appStore";
import type { ExecutionLog } from "../types/domain";

export function SimulateCallPage() {
  const { setLatestLogs, setSelectedSession, setScreen } = useAppStore();
  const [callerNumber, setCallerNumber] = useState("+66 81 234 5678");
  const [calledNumber, setCalledNumber] = useState("7777");
  const [utterance, setUtterance] = useState("ต้องการตรวจสอบสถานะรายการค่ะ");
  const [dtmf, setDtmf] = useState("1");
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [status, setStatus] = useState("Idle");

  async function run() {
    setStatus("Running");
    const { data } = await api.post("/runtime/simulate-call", {
      flowId: "flow_inbound_support",
      callerNumber,
      calledNumber,
      utterance,
      dtmf
    });
    setLogs(data.logs);
    setLatestLogs(data.logs);
    setSelectedSession(data.session);
    setStatus("Completed");
  }

  function reset() {
    setLogs([]);
    setStatus("Idle");
  }

  return (
    <div className="page">
      <div className="panel inline" style={{ gap: 8, padding: "11px 15px", marginBottom: 18, maxWidth: 1240, background: "var(--green50)", borderColor: "var(--green)" }}>
        <Badge tone="green">Live test run</Badge>
        <span style={{ fontSize: 12.5, color: "#0B5F32" }}>This test uses the configured live AI and Dialogflow services. Missing credentials will fail instead of using demo responses.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, maxWidth: 1240 }}>
        <div className="panel" style={{ padding: 18 }}>
          <label className="label">Published flow</label>
          <div className="select">Inbound Support Bot v3</div>
          <div style={{ height: 13 }} />
          <label className="label">Caller number</label>
          <input className="input mono" value={callerNumber} onChange={(event) => setCallerNumber(event.target.value)} />
          <div style={{ height: 13 }} />
          <label className="label">Called number</label>
          <input className="input mono" value={calledNumber} onChange={(event) => setCalledNumber(event.target.value)} />
          <div style={{ height: 13 }} />
          <label className="label">Caller says</label>
          <textarea className="textarea" style={{ height: 70 }} value={utterance} onChange={(event) => setUtterance(event.target.value)} />
          <div style={{ height: 13 }} />
          <label className="label">Simulate DTMF</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
              <button className={`btn ${dtmf === key ? "teal" : ""}`} key={key} onClick={() => setDtmf(key)}>{key}</button>
            ))}
          </div>
          <div className="inline" style={{ gap: 8, marginTop: 16 }}>
            <button className="btn primary" onClick={run}><Play size={14} />Run</button>
            <button className="btn" onClick={run}><StepForward size={14} />Step</button>
            <button className="btn danger" onClick={reset}><RotateCcw size={14} />Reset</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          <div className="panel canvas" style={{ minHeight: 420, position: "relative", overflow: "hidden" }}>
            <div className="badge gray" style={{ position: "absolute", top: 12, left: 14, zIndex: 2 }}>Live execution</div>
            {["Start", "Voice Bot", "IVR Menu", "Condition", "Transfer"].map((label, index) => (
              <div key={label} className="panel inline" style={{ gap: 8, position: "absolute", left: 54 + index * 128, top: index % 2 ? 220 : 160, width: 126, height: 42, padding: "0 11px", borderColor: logs[index] ? "var(--teal)" : "var(--border)" }}>
                <span className="dot" style={{ color: logs[index] ? "var(--teal)" : "var(--ink3)" }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
          <div className="mock-log">
            <div className="row-between" style={{ padding: "12px 15px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>Execution log</span>
              <span className="badge teal">{status}</span>
            </div>
            <div style={{ padding: 14, fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, lineHeight: 1.55 }}>
              {logs.length === 0 ? (
                <div style={{ color: "#6B7690" }}>Run the simulation to create a CallSession, logs, transcript, and provider request records.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <span style={{ color: "#8FA0C4" }}>{String(log.sequence).padStart(2, "0")}</span>
                    <span style={{ color: log.status === "BRANCH" ? "var(--amber)" : "var(--teal)" }}>{log.nodeType}</span>
                    <span style={{ color: "#CBD5E1" }}>{log.eventType}</span>
                  </div>
                ))
              )}
            </div>
            {logs.length > 0 ? (
              <button className="btn" style={{ margin: 14 }} onClick={() => setScreen("detail")}>Open call detail</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
