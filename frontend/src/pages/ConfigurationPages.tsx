import { useEffect, useState } from "react";
import { Bot, FileText, Mic, Phone, Plus, Shield, Upload } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { prompts, users } from "../data/mock";

export function ProvidersPage() {
  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");
  const [providerId, setProviderId] = useState("prov_mock");
  const [config, setConfig] = useState({
    name: "OpenAI - ChatGPT",
    type: "OPENAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    apiKey: "",
    temperature: "0.4",
    maxTokens: "300",
    timeoutMs: "8000"
  });

  useEffect(() => {
    api.get("/ai-providers").then(({ data }) => {
      const first = data[0];
      if (!first) return;
      setProviderId(first.id);
      setConfig({
        name: first.name ?? "OpenAI - ChatGPT",
        type: first.type ?? "OPENAI",
        baseUrl: first.baseUrl ?? "",
        defaultModel: first.defaultModel ?? "gpt-4o",
        apiKey: first.hasApiKey ? "********" : "",
        temperature: String(first.configJson?.temperature ?? "0.4"),
        maxTokens: String(first.configJson?.maxTokens ?? "300"),
        timeoutMs: String(first.configJson?.timeoutMs ?? "8000")
      });
    }).catch(() => {
      setResultTone("red");
      setResult("Unable to load AI provider config");
    });
  }, []);

  function updateConfig(field: keyof typeof config, value: string) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function providerPayload() {
    return {
      name: config.name,
      type: config.type,
      baseUrl: config.baseUrl || undefined,
      defaultModel: config.defaultModel,
      apiKey: config.apiKey || undefined,
      configJson: {
        temperature: Number(config.temperature),
        maxTokens: Number(config.maxTokens),
        timeoutMs: Number(config.timeoutMs)
      },
      isActive: true
    };
  }

  async function saveProvider() {
    try {
      const { data } = await api.patch(`/ai-providers/${providerId}`, providerPayload());
      setConfig((current) => ({ ...current, apiKey: data.hasApiKey ? "********" : "" }));
      setResultTone("green");
      setResult(`Saved ${data.name} using ${data.defaultModel}`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not save AI provider"));
    }
  }

  async function testProvider() {
    try {
      const { data } = await api.post(`/ai-providers/${providerId}/test`);
      setResultTone(data.ok ? "green" : "red");
      setResult(`${data.message} ${data.latencyMs ?? 0}ms`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "AI provider test failed"));
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="panel inline" style={{ gap: 8, padding: "11px 15px", marginBottom: 16, background: "var(--green50)" }}>
        <Badge tone="green">Live Mode active</Badge>
        <span style={{ fontSize: 12.5, color: "#0B5F32" }}>Test provider performs a real request for configured providers.</span>
      </div>
      <div className="panel">
        <div className="panel-header inline" style={{ gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: "#0B7A5E", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>AI</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>AI Provider</div><div className="muted" style={{ fontSize: 11.5 }}>LLM answer engine for Voice Bot nodes</div></div>
          <Badge tone={config.apiKey && config.apiKey !== "" ? "green" : "amber"}>{config.apiKey ? "Credential set" : "Needs key"}</Badge>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ControlledField label="Config name" value={config.name} onChange={(value) => updateConfig("name", value)} />
            <SelectField label="Provider" value={config.type} onChange={(value) => updateConfig("type", value)} options={["OPENAI", "GEMINI", "CLAUDE", "CUSTOM"]} />
            <ControlledField label="Model" value={config.defaultModel} onChange={(value) => updateConfig("defaultModel", value)} />
            <ControlledField label="Base URL" value={config.baseUrl} onChange={(value) => updateConfig("baseUrl", value)} />
            <ControlledField label="API key" value={config.apiKey} onChange={(value) => updateConfig("apiKey", value)} type="password" />
            <ControlledField label="Timeout ms" value={config.timeoutMs} onChange={(value) => updateConfig("timeoutMs", value)} />
            <ControlledField label="Temperature" value={config.temperature} onChange={(value) => updateConfig("temperature", value)} />
            <ControlledField label="Max tokens" value={config.maxTokens} onChange={(value) => updateConfig("maxTokens", value)} />
          </div>
          <div className="inline" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn teal" onClick={testProvider}><Bot size={14} />Test provider</button>
            <button className="btn primary" onClick={saveProvider}>Save configuration</button>
            {result ? <span className={`badge ${resultTone}`}>{result}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PromptsPage() {
  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div className="panel" style={{ overflow: "hidden", height: "fit-content" }}>
          <div className="panel-header row-between"><span style={{ fontWeight: 600, fontSize: 13 }}>Prompts</span><button className="btn"><Plus size={14} /></button></div>
          {prompts.map((prompt, index) => (
            <div key={prompt.name} className="row-between" style={{ padding: "12px 15px", borderTop: "1px solid var(--border2)", background: index === 0 ? "var(--indigo50)" : "transparent" }}>
              <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{prompt.name}</div><div className="muted" style={{ fontSize: 10.5 }}>{prompt.meta}</div></div>
              <Badge tone={prompt.tone}>{prompt.tag}</Badge>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-header inline" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Support Bot - System prompt</div><div className="muted" style={{ fontSize: 11.5 }}>Version 4 - edited by Rania A. - 2 days ago</div></div>
            <Badge tone="green">Active</Badge>
            <button className="btn">History</button>
          </div>
          <div style={{ padding: 20 }}>
            <label className="label">Prompt content</label>
            <div className="panel mono" style={{ padding: "14px 16px", background: "var(--surface2)", fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{`You are Ava, the friendly voice assistant for Northwind Support. Greet the caller warmly and identify their intent within two turns.\n\nRules:\n- Keep spoken replies under 2 sentences.\n- Confirm before transferring.\n- Offer a human agent after 3 failed attempts.`}</div>
            <div className="inline" style={{ gap: 10, marginTop: 16 }}>
              <button className="btn teal"><FileText size={14} />Test prompt</button>
              <span className="muted" style={{ fontSize: 11.5 }}>Try against a sample transcript before publishing</span>
              <button className="btn primary" style={{ marginLeft: "auto" }}>Save new version</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DialogflowPage() {
  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");
  const [configId, setConfigId] = useState("df_mock");
  const [config, setConfig] = useState({
    name: "Dialogflow Thai Voice Bot",
    projectId: "",
    location: "global",
    agentId: "",
    languageCode: "th-TH",
    voiceName: "th-TH-Standard-A",
    hasServiceAccount: false
  });

  useEffect(() => {
    api.get("/dialogflow-configs").then(({ data }) => {
      const first = data[0];
      if (!first) return;
      setConfigId(first.id);
      setConfig({
        name: first.name ?? "Dialogflow Thai Voice Bot",
        projectId: first.projectId ?? "",
        location: first.location ?? "global",
        agentId: first.agentId ?? "",
        languageCode: first.languageCode ?? "th-TH",
        voiceName: first.voiceName ?? "th-TH-Standard-A",
        hasServiceAccount: Boolean(first.hasServiceAccount)
      });
    }).catch(() => {
      setResultTone("red");
      setResult("Unable to load Dialogflow config");
    });
  }, []);

  function updateConfig(field: keyof typeof config, value: string | boolean) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    try {
      const { data } = await api.patch(`/dialogflow-configs/${configId}`, {
        name: config.name,
        projectId: config.projectId,
        location: config.location,
        agentId: config.agentId,
        languageCode: config.languageCode,
        voiceName: config.voiceName,
        isActive: true
      });
      updateConfig("hasServiceAccount", Boolean(data.hasServiceAccount));
      setResultTone("green");
      setResult(`Saved ${data.languageCode} / ${data.voiceName}`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not save Dialogflow config"));
    }
  }

  async function uploadServiceAccount(file?: File) {
    if (!file) return;
    try {
      const serviceAccountJson = await file.text();
      const { data } = await api.post(`/dialogflow-configs/${configId}/upload-service-account`, { serviceAccountJson });
      setConfig((current) => ({
        ...current,
        projectId: data.projectId ?? current.projectId,
        hasServiceAccount: Boolean(data.hasServiceAccount)
      }));
      setResultTone("green");
      setResult("Service account JSON uploaded and encrypted");
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not upload service account JSON"));
    }
  }

  async function test() {
    try {
      const { data } = await api.post(`/dialogflow-configs/${configId}/test`);
      setResultTone(data.ok ? "green" : "red");
      setResult(`${data.message} ${data.latencyMs ?? 0}ms`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Dialogflow test failed"));
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="panel">
        <div className="panel-header inline" style={{ gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: "var(--teal50)", color: "var(--teal)", display: "grid", placeItems: "center" }}><Mic size={18} /></span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>Dialogflow / Google Voice</div><div className="muted" style={{ fontSize: 11.5 }}>STT, TTS, and intent adapter</div></div>
          <Badge tone={config.hasServiceAccount ? "green" : "amber"}>{config.hasServiceAccount ? "Credential set" : "Needs JSON"}</Badge>
        </div>
        <div style={{ padding: 22 }}>
          <ControlledField label="Config name" value={config.name} onChange={(value) => updateConfig("name", value)} />
          <ControlledField label="Project ID" value={config.projectId} onChange={(value) => updateConfig("projectId", value)} />
          <ControlledField label="Location" value={config.location} onChange={(value) => updateConfig("location", value)} />
          <ControlledField label="Agent ID" value={config.agentId} onChange={(value) => updateConfig("agentId", value)} />
          <ControlledField label="Language code" value={config.languageCode} onChange={(value) => updateConfig("languageCode", value)} />
          <ControlledField label="Voice name" value={config.voiceName} onChange={(value) => updateConfig("voiceName", value)} />
          <label className="label">Service account JSON</label>
          <input className="input" type="file" accept="application/json" onChange={(event) => uploadServiceAccount(event.target.files?.[0])} />
          <div className="inline" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn teal" onClick={test}><Mic size={14} />Test connection</button>
            <button className="btn primary" onClick={save}><Upload size={14} />Save configuration</button>
            {result ? <span className={`badge ${resultTone}`}>{result}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AsteriskPage() {
  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");
  const [liveStatus, setLiveStatus] = useState("checking");
  const [config, setConfig] = useState({
    name: "FreePBX ARI",
    ariUrl: "http://freepbx.local:8088/ari",
    username: "voicebot",
    password: "",
    appName: "voicebot-app",
    botExtension: "7777"
  });

  useEffect(() => {
    api.get("/system/health").then(({ data }) => setLiveStatus(data.mockMode ? "disabled" : "active")).catch(() => setLiveStatus("unknown"));
    api.get("/asterisk-configs").then(({ data }) => {
      const first = data[0];
      if (!first) return;
      setConfig({
        name: first.name ?? "FreePBX ARI",
        ariUrl: first.ariUrl ?? "",
        username: first.username ?? "",
        password: first.password ?? "",
        appName: first.appName ?? "voicebot-app",
        botExtension: first.botExtension ?? "7777"
      });
    }).catch(() => {
      setResultTone("red");
      setResult("Unable to load ARI config");
    });
  }, []);

  function updateConfig(field: keyof typeof config, value: string) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    try {
      const { data } = await api.patch("/asterisk-configs/ari_mock", config);
      setConfig((current) => ({ ...current, password: data.password ?? "" }));
      setResultTone("green");
      setResult(`Saved ${data.username}@${data.ariUrl} for extension ${data.botExtension}`);
    } catch (error) {
      setResultTone("red");
      setResult("Could not save ARI configuration");
    }
  }

  async function test() {
    try {
      const { data } = await api.post("/asterisk-configs/ari_mock/test");
      setResultTone(data.ok ? "green" : "red");
      setResult(data.message);
    } catch (error: unknown) {
      const message = typeof error === "object" && error && "response" in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setResultTone("red");
      setResult(message ?? "Live ARI test failed");
    }
  }
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="panel inline" style={{ gap: 8, padding: "11px 15px", marginBottom: 16, background: liveStatus === "active" ? "var(--green50)" : "var(--amber50)" }}>
        <Badge tone={liveStatus === "active" ? "green" : "amber"}>{liveStatus === "active" ? "Live Mode active" : "Live Mode checking"}</Badge>
        <span style={{ fontSize: 12.5, color: liveStatus === "active" ? "#0B5F32" : "#7A5A12" }}>Test ARI performs a real request to FreePBX when the backend is in live mode.</span>
      </div>
      <div className="panel">
        <div className="panel-header inline" style={{ gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: "var(--indigo50)", color: "var(--indigo)", display: "grid", placeItems: "center" }}><Phone size={18} /></span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>FreePBX / Asterisk - ARI</div><div className="muted" style={{ fontSize: 11.5 }}>Telephony bridge for inbound calls</div></div>
          <Badge tone={liveStatus === "active" ? "green" : "amber"}>{liveStatus === "active" ? "Live" : "Checking"}</Badge>
        </div>
        <div style={{ padding: 22 }}>
          <ControlledField label="Config name" value={config.name} onChange={(value) => updateConfig("name", value)} />
          <ControlledField label="ARI URL" value={config.ariUrl} onChange={(value) => updateConfig("ariUrl", value)} />
          <ControlledField label="ARI username" value={config.username} onChange={(value) => updateConfig("username", value)} />
          <ControlledField label="ARI password" value={config.password} onChange={(value) => updateConfig("password", value)} type="password" />
          <ControlledField label="App name" value={config.appName} onChange={(value) => updateConfig("appName", value)} />
          <ControlledField label="Voice bot extension" value={config.botExtension} onChange={(value) => updateConfig("botExtension", value)} />
          <label className="label">FreePBX dialplan example</label>
          <pre className="panel mono" style={{ padding: 14, background: "var(--surface2)", fontSize: 12, overflow: "auto" }}>{`[from-internal-custom]\nexten => ${config.botExtension || "7777"},1,NoOp(Voice AI Bot)\n same => n,Stasis(${config.appName || "voicebot-app"})\n same => n,Hangup()`}</pre>
          <div className="inline" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn teal" onClick={test}>Test ARI</button>
            <button className="btn primary" onClick={save}>Save configuration</button>
            {result ? <span className={`badge ${resultTone}`}>{result}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function UsersPage() {
  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="row-between" style={{ marginBottom: 16 }}><div className="subtle" style={{ fontSize: 12.5 }}>12 users - 5 roles</div><button className="btn primary"><Plus size={14} />Invite user</button></div>
      <div className="panel" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead><tr><th>User</th><th>Role</th><th>Last active</th><th>Status</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.email}>
                <td><div className="inline" style={{ gap: 10 }}><span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--indigo)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 12 }}>{user.initials}</span><div><div style={{ fontWeight: 600 }}>{user.name}</div><div className="muted" style={{ fontSize: 11 }}>{user.email}</div></div></div></td>
                <td><Badge tone={user.tone}>{user.role}</Badge></td>
                <td className="muted">{user.last}</td>
                <td><Badge tone={user.status === "Active" ? "green" : "amber"}>{user.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GenericAdminPage({ title }: { title: string }) {
  return (
    <div className="page" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--indigo50)", color: "var(--indigo)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}><Shield size={30} /></div>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{title}</div>
        <div className="muted" style={{ fontSize: 12.5, maxWidth: 460 }}>This module is scaffolded with routing, RBAC placement, audit-log coverage, and production documentation for implementation-specific policies.</div>
      </div>
    </div>
  );
}

function ControlledField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)} type={type} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
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
