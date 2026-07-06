import { useEffect, useState } from "react";
import { Bot, FileText, Mic, Phone, Plus, RefreshCw, Save, Shield, Trash2, Upload } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { users } from "../data/mock";

export function ProvidersPage() {
  type ProviderType = "OPENAI" | "GEMINI" | "CLAUDE" | "CUSTOM";
  type SavedProvider = {
    id: string;
    name?: string;
    type?: ProviderType;
    baseUrl?: string;
    defaultModel?: string;
    hasApiKey?: boolean;
    configJson?: Record<string, unknown>;
    isActive?: boolean;
  };
  type ProviderForm = {
    id?: string;
    name: string;
    type: ProviderType;
    baseUrl: string;
    defaultModel: string;
    apiKey: string;
    temperature: string;
    maxTokens: string;
    timeoutMs: string;
    isActive: boolean;
  };
  type ModelOption = { id: string; label: string };

  const standardBaseUrls: Record<Exclude<ProviderType, "CUSTOM">, string> = {
    OPENAI: "https://api.openai.com/v1",
    GEMINI: "https://generativelanguage.googleapis.com/v1beta",
    CLAUDE: "https://api.anthropic.com/v1"
  };
  const defaultModels: Record<ProviderType, string> = {
    OPENAI: "gpt-4o",
    GEMINI: "gemini-1.5-pro",
    CLAUDE: "claude-3-5-sonnet-latest",
    CUSTOM: ""
  };

  const newProviderForm = (type: ProviderType = "OPENAI"): ProviderForm => ({
    name: `${type === "CUSTOM" ? "Custom" : type} provider`,
    type,
    baseUrl: type === "CUSTOM" ? "" : standardBaseUrls[type],
    defaultModel: defaultModels[type],
    apiKey: "",
    temperature: "0.4",
    maxTokens: "300",
    timeoutMs: "8000",
    isActive: true
  });

  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");
  const [providers, setProviders] = useState<SavedProvider[]>([]);
  const [config, setConfig] = useState<ProviderForm>(newProviderForm());
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    api.get("/ai-providers").then(({ data }) => {
      setProviders(data);
      const first = data[0] as SavedProvider | undefined;
      if (!first) return;
      selectProvider(first);
    }).catch(() => {
      setResultTone("red");
      setResult("Unable to load AI provider config");
    });
  }, []);

  function mapProvider(provider: SavedProvider): ProviderForm {
    const type = provider.type ?? "OPENAI";
    return {
      id: provider.id,
      name: provider.name ?? `${type} provider`,
      type,
      baseUrl: provider.baseUrl ?? (type === "CUSTOM" ? "" : standardBaseUrls[type]),
      defaultModel: provider.defaultModel ?? defaultModels[type],
      apiKey: provider.hasApiKey ? "********" : "",
      temperature: String(provider.configJson?.temperature ?? "0.4"),
      maxTokens: String(provider.configJson?.maxTokens ?? "300"),
      timeoutMs: String(provider.configJson?.timeoutMs ?? "8000"),
      isActive: provider.isActive ?? true
    };
  }

  function selectProvider(provider: SavedProvider) {
    setConfig(mapProvider(provider));
    setModelOptions([]);
    setResult("");
  }

  function startNewProvider() {
    setConfig(newProviderForm());
    setModelOptions([]);
    setResult("");
  }

  function updateConfig(field: keyof ProviderForm, value: string | boolean) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function updateProviderType(value: string) {
    const type = value as ProviderType;
    setConfig((current) => ({
      ...current,
      type,
      name: current.id ? current.name : `${type === "CUSTOM" ? "Custom" : type} provider`,
      baseUrl: type === "CUSTOM" ? "" : standardBaseUrls[type],
      defaultModel: defaultModels[type]
    }));
    setModelOptions([]);
  }

  function providerPayload() {
    return {
      name: config.name,
      type: config.type,
      baseUrl: config.type === "CUSTOM" ? config.baseUrl || undefined : undefined,
      defaultModel: config.defaultModel,
      apiKey: config.apiKey || undefined,
      configJson: {
        temperature: Number(config.temperature),
        maxTokens: Number(config.maxTokens),
        timeoutMs: Number(config.timeoutMs)
      },
      isActive: config.isActive
    };
  }

  async function saveProvider() {
    try {
      const request = config.id ? api.patch(`/ai-providers/${config.id}`, providerPayload()) : api.post("/ai-providers", providerPayload());
      const { data } = await request;
      setProviders((current) => {
        const exists = current.some((provider) => provider.id === data.id);
        return exists ? current.map((provider) => provider.id === data.id ? data : provider) : [...current, data];
      });
      setConfig(mapProvider(data));
      setResultTone("green");
      setResult(`Saved ${data.name} using ${data.defaultModel}`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not save AI provider"));
    }
  }

  async function loadModels() {
    if (config.type === "CUSTOM") {
      setResultTone("amber");
      setResult("Custom provider models are manual because custom endpoints do not share one model-list API.");
      return;
    }
    try {
      setLoadingModels(true);
      const payload = {
        type: config.type,
        apiKey: config.apiKey && config.apiKey !== "********" ? config.apiKey : undefined,
        timeoutMs: Number(config.timeoutMs)
      };
      const { data } = config.id
        ? await api.post(`/ai-providers/${config.id}/models`, payload)
        : await api.post("/ai-providers/models", payload);
      setModelOptions(data.models ?? []);
      if (!config.defaultModel && data.models?.[0]?.id) {
        updateConfig("defaultModel", data.models[0].id);
      }
      setResultTone("green");
      setResult(`Loaded ${data.models?.length ?? 0} live models from ${config.type}`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not load models from provider"));
    } finally {
      setLoadingModels(false);
    }
  }

  async function testProvider() {
    if (!config.id) {
      setResultTone("amber");
      setResult("Save this provider before testing the live request.");
      return;
    }
    try {
      const { data } = await api.post(`/ai-providers/${config.id}/test`);
      setResultTone(data.ok ? "green" : "red");
      setResult(`${data.message} ${data.latencyMs ?? 0}ms`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "AI provider test failed"));
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="panel inline" style={{ gap: 8, padding: "11px 15px", marginBottom: 16, background: "var(--green50)" }}>
        <Badge tone="green">Live Mode active</Badge>
        <span style={{ fontSize: 12.5, color: "#0B5F32" }}>Standard providers use official endpoints. Custom is the only mode with a manual endpoint.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        <div className="panel" style={{ overflow: "hidden", height: "fit-content" }}>
          <div className="panel-header row-between">
            <span style={{ fontWeight: 600, fontSize: 13 }}>Saved AI keys</span>
            <button className="btn" onClick={startNewProvider} title="Add provider"><Plus size={14} /></button>
          </div>
          {providers.length ? providers.map((provider) => (
            <button
              key={provider.id}
              className="row-between"
              onClick={() => selectProvider(provider)}
              style={{
                width: "100%",
                padding: "12px 15px",
                border: 0,
                borderTop: "1px solid var(--border2)",
                background: provider.id === config.id ? "var(--indigo50)" : "transparent",
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{provider.name}</div>
                <div className="muted" style={{ fontSize: 10.5 }}>{provider.type} / {provider.defaultModel}</div>
              </div>
              <Badge tone={provider.hasApiKey ? "green" : "amber"}>{provider.hasApiKey ? "Key" : "No key"}</Badge>
            </button>
          )) : (
            <div className="muted" style={{ padding: 15, fontSize: 12 }}>No provider saved yet.</div>
          )}
        </div>
        <div className="panel">
          <div className="panel-header inline" style={{ gap: 11 }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: "#0B7A5E", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>AI</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>{config.id ? "AI Provider" : "New AI Provider"}</div><div className="muted" style={{ fontSize: 11.5 }}>LLM answer engine for Voice Bot nodes</div></div>
            <Badge tone={config.apiKey && config.apiKey !== "" ? "green" : "amber"}>{config.apiKey ? "Credential set" : "Needs key"}</Badge>
          </div>
          <div style={{ padding: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ControlledField label="Config name" value={config.name} onChange={(value) => updateConfig("name", value)} />
              <SelectField label="Provider" value={config.type} onChange={updateProviderType} options={["OPENAI", "GEMINI", "CLAUDE", "CUSTOM"]} />
              {modelOptions.length ? (
                <SelectField label="Model" value={config.defaultModel} onChange={(value) => updateConfig("defaultModel", value)} options={modelOptions.map((model) => model.id)} />
              ) : (
                <ControlledField label="Model" value={config.defaultModel} onChange={(value) => updateConfig("defaultModel", value)} />
              )}
              {config.type === "CUSTOM" ? (
                <ControlledField label="Custom endpoint URL" value={config.baseUrl} onChange={(value) => updateConfig("baseUrl", value)} />
              ) : (
                <ReadOnlyField label="Standard endpoint" value={standardBaseUrls[config.type]} />
              )}
              <ControlledField label="API key" value={config.apiKey} onChange={(value) => updateConfig("apiKey", value)} type="password" />
              <ControlledField label="Timeout ms" value={config.timeoutMs} onChange={(value) => updateConfig("timeoutMs", value)} />
              <ControlledField label="Temperature" value={config.temperature} onChange={(value) => updateConfig("temperature", value)} />
              <ControlledField label="Max tokens" value={config.maxTokens} onChange={(value) => updateConfig("maxTokens", value)} />
            </div>
            <div className="inline" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn teal" onClick={loadModels} disabled={loadingModels || config.type === "CUSTOM"}><RefreshCw size={14} />{loadingModels ? "Loading models" : "Load models"}</button>
              <button className="btn teal" onClick={testProvider}><Bot size={14} />Test provider</button>
              <button className="btn primary" onClick={saveProvider}><Save size={14} />Save configuration</button>
              {result ? <span className={`badge ${resultTone}`}>{result}</span> : null}
            </div>
            {modelOptions.length ? (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{modelOptions.length} models loaded from {config.type}. Save to keep the selected model with this key.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PromptsPage() {
  type PromptTemplate = {
    id: string;
    name: string;
    systemPrompt: string;
    fallbackPrompt: string;
    language: string;
    version: number;
    isActive: boolean;
    updatedAt: string;
  };
  type PromptForm = Omit<PromptTemplate, "id" | "version" | "updatedAt"> & { id?: string; version?: number; updatedAt?: string };

  const emptyPrompt = (): PromptForm => ({
    name: "New Thai Voice Prompt",
    systemPrompt: "คุณคือผู้ช่วยเสียงภาษาไทย ตอบให้สุภาพ กระชับ และช่วยผู้โทรจนจบงาน",
    fallbackPrompt: "ขอโทษค่ะ ฉันยังไม่เข้าใจ ขอพูดอีกครั้งได้ไหมคะ",
    language: "th-TH",
    isActive: true
  });

  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [form, setForm] = useState<PromptForm>(emptyPrompt());
  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");

  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    try {
      const { data } = await api.get<PromptTemplate[]>("/prompts");
      setItems(data);
      if (data[0]) setForm(data[0]);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Unable to load prompts"));
    }
  }

  function updateForm(field: keyof PromptForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startNewPrompt() {
    setForm(emptyPrompt());
    setResult("");
  }

  async function savePrompt() {
    try {
      const payload = {
        name: form.name,
        systemPrompt: form.systemPrompt,
        fallbackPrompt: form.fallbackPrompt,
        language: form.language,
        isActive: form.isActive
      };
      const { data } = form.id ? await api.patch(`/prompts/${form.id}`, payload) : await api.post("/prompts", payload);
      setItems((current) => {
        const exists = current.some((item) => item.id === data.id);
        return exists ? current.map((item) => item.id === data.id ? data : item) : [data, ...current];
      });
      setForm(data);
      setResultTone("green");
      setResult(`Saved ${data.name} v${data.version}`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not save prompt"));
    }
  }

  async function deletePrompt() {
    if (!form.id) {
      startNewPrompt();
      return;
    }
    if (!window.confirm(`Delete prompt "${form.name}"?`)) return;
    try {
      await api.delete(`/prompts/${form.id}`);
      const nextItems = items.filter((item) => item.id !== form.id);
      setItems(nextItems);
      setForm(nextItems[0] ?? emptyPrompt());
      setResultTone("green");
      setResult("Prompt deleted");
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not delete prompt"));
    }
  }

  async function testPrompt() {
    if (!form.id) {
      setResultTone("amber");
      setResult("Save this prompt before testing.");
      return;
    }
    try {
      const { data } = await api.post(`/prompts/${form.id}/test`);
      setResultTone(data.ok ? "green" : "red");
      setResult(data.response ?? "Prompt test completed");
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Prompt test failed"));
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div className="panel" style={{ overflow: "hidden", height: "fit-content" }}>
          <div className="panel-header row-between"><span style={{ fontWeight: 600, fontSize: 13 }}>Prompts</span><button className="btn" onClick={startNewPrompt}><Plus size={14} /></button></div>
          {items.map((prompt) => (
            <button
              key={prompt.id}
              className="row-between"
              onClick={() => {
                setForm(prompt);
                setResult("");
              }}
              style={{
                width: "100%",
                padding: "12px 15px",
                border: 0,
                borderTop: "1px solid var(--border2)",
                background: prompt.id === form.id ? "var(--indigo50)" : "transparent",
                textAlign: "left"
              }}
            >
              <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{prompt.name}</div><div className="muted" style={{ fontSize: 10.5 }}>v{prompt.version} - {prompt.language}</div></div>
              <Badge tone={prompt.isActive ? "green" : "gray"}>{prompt.isActive ? "Active" : "Off"}</Badge>
            </button>
          ))}
          {items.length === 0 ? <div className="muted" style={{ padding: 15, fontSize: 12 }}>No prompts saved yet.</div> : null}
        </div>
        <div className="panel">
          <div className="panel-header inline" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{form.id ? form.name : "New prompt"}</div><div className="muted" style={{ fontSize: 11.5 }}>{form.id ? `Version ${form.version ?? 1} - ${form.updatedAt ? new Date(form.updatedAt).toLocaleString() : "saved"}` : "Not saved yet"}</div></div>
            <Badge tone={form.isActive ? "green" : "gray"}>{form.isActive ? "Active" : "Disabled"}</Badge>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 16 }}>
              <ControlledField label="Prompt name" value={form.name} onChange={(value) => updateForm("name", value)} />
              <ControlledField label="Language" value={form.language} onChange={(value) => updateForm("language", value)} />
            </div>
            <label className="label" htmlFor="system-prompt">System prompt</label>
            <textarea id="system-prompt" className="textarea mono" rows={9} value={form.systemPrompt} onChange={(event) => updateForm("systemPrompt", event.target.value)} />
            <label className="label" htmlFor="fallback-prompt" style={{ marginTop: 16 }}>Fallback prompt</label>
            <textarea id="fallback-prompt" className="textarea mono" rows={4} value={form.fallbackPrompt} onChange={(event) => updateForm("fallbackPrompt", event.target.value)} />
            <label className="inline" style={{ gap: 8, marginTop: 14, fontSize: 12.5, color: "var(--ink2)", fontWeight: 600 }}>
              <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} />
              Active prompt
            </label>
            <div className="inline" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn teal" onClick={testPrompt}><FileText size={14} />Test prompt</button>
              <button className="btn danger" onClick={deletePrompt}><Trash2 size={14} />Delete</button>
              <button className="btn primary" onClick={savePrompt} style={{ marginLeft: "auto" }}><Save size={14} />Save prompt</button>
              {result ? <span className={`badge ${resultTone}`}>{result}</span> : null}
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} readOnly />
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
