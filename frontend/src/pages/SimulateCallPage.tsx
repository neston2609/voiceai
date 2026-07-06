import { useEffect, useState } from "react";
import { Play, RotateCcw, StepForward, Volume2 } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { useAppStore } from "../store/appStore";
import type { CallFlow, ExecutionLog } from "../types/domain";

type CallerHears = {
  sequence: number;
  label: string;
  text: string;
  audioBase64?: string;
  audioFormat?: string;
  ttsStatus: "ready" | "not-configured" | "failed";
  ttsError?: string;
};

type CallPreview = {
  flowName: string;
  languageCode: string;
  voiceName?: string;
  aiProvider: string;
  model: string;
  dialogflowStatus: string;
  finalResult: string;
  summary: string;
};

export function SimulateCallPage() {
  const { setLatestLogs, setSelectedSession, setScreen } = useAppStore();
  const [flows, setFlows] = useState<CallFlow[]>([]);
  const [flowId, setFlowId] = useState("flow_inbound_support");
  const [callerNumber, setCallerNumber] = useState("+66 81 234 5678");
  const [calledNumber, setCalledNumber] = useState("7777");
  const [utterance, setUtterance] = useState("ต้องการตรวจสอบสถานะรายการค่ะ");
  const [dtmf, setDtmf] = useState("1");
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [callerHears, setCallerHears] = useState<CallerHears[]>([]);
  const [preview, setPreview] = useState<CallPreview | null>(null);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<CallFlow[]>("/flows").then(({ data }) => {
      const published = data.filter((flow) => flow.status === "PUBLISHED");
      const available = published.length ? published : data;
      setFlows(available);
      if (available[0]) setFlowId(available[0].id);
    }).catch(() => setError("Unable to load live flows"));
  }, []);

  async function run() {
    try {
      setError("");
      setStatus("Running");
      setCallerHears([]);
      setPreview(null);
      const { data } = await api.post("/runtime/simulate-call", {
        flowId,
        callerNumber,
        calledNumber,
        utterance,
        dtmf
      });
      setLogs(data.logs);
      setCallerHears(data.callerHears ?? []);
      setPreview(data.callPreview ?? null);
      setLatestLogs(data.logs);
      setSelectedSession(data.session);
      setStatus("Completed");
    } catch (err: unknown) {
      setStatus("Failed");
      setError(getApiMessage(err, "Simulation failed"));
    }
  }

  function reset() {
    setLogs([]);
    setCallerHears([]);
    setPreview(null);
    setError("");
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
          <select className="input" value={flowId} onChange={(event) => setFlowId(event.target.value)}>
            {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name} / {flow.status}</option>)}
          </select>
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
            <button className="btn primary" onClick={run} disabled={!flowId}><Play size={14} />Run</button>
            <button className="btn" onClick={run} disabled={!flowId}><StepForward size={14} />Step</button>
            <button className="btn danger" onClick={reset}><RotateCcw size={14} />Reset</button>
          </div>
          {error ? <div className="badge red" style={{ marginTop: 14, whiteSpace: "normal", lineHeight: 1.45 }}>{error}</div> : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          <div className="panel" style={{ minHeight: 420, overflow: "hidden" }}>
            <div className="panel-header row-between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Caller will hear</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{preview ? `${preview.flowName} / ${preview.languageCode} / ${preview.aiProvider} ${preview.model}` : "Run simulation to generate a live voice preview"}</div>
              </div>
              <Badge tone={preview?.dialogflowStatus === "configured" ? "green" : "amber"}>{preview?.voiceName ?? preview?.dialogflowStatus ?? "Waiting"}</Badge>
            </div>
            <div style={{ padding: 16 }}>
              {callerHears.length === 0 ? (
                <div className="muted" style={{ fontSize: 12.5 }}>No preview yet. Run จะเรียก live AI, Dialogflow intent, และ Google TTS เพื่อบอกว่าผู้โทรจะได้ยินอะไรบ้าง.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {callerHears.map((item) => (
                    <div key={`${item.sequence}-${item.label}`} className="panel" style={{ padding: 14, background: "var(--surface2)" }}>
                      <div className="row-between" style={{ gap: 12 }}>
                        <div className="inline" style={{ gap: 8 }}>
                          <span className="badge indigo">{item.sequence}</span>
                          <span style={{ fontWeight: 600, fontSize: 12.5 }}>{item.label}</span>
                        </div>
                        <Badge tone={item.ttsStatus === "ready" ? "green" : item.ttsStatus === "failed" ? "red" : "amber"}>{item.ttsStatus}</Badge>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55 }}>{item.text}</div>
                      {item.audioBase64 && item.audioFormat ? (
                        <audio controls src={`data:${item.audioFormat};base64,${item.audioBase64}`} style={{ width: "100%", marginTop: 10 }} />
                      ) : (
                        <div className="muted inline" style={{ gap: 6, marginTop: 10, fontSize: 11.5 }}><Volume2 size={13} />{item.ttsError ?? "Audio preview requires Dialogflow / Google service account JSON."}</div>
                      )}
                    </div>
                  ))}
                  {preview ? <div className="badge green" style={{ whiteSpace: "normal", lineHeight: 1.45 }}>Final result: {preview.finalResult}</div> : null}
                </div>
              )}
            </div>
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

function getApiMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  return fallback;
}
