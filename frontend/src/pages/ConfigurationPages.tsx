import { useEffect, useState } from "react";
import { Database, FileText, Globe2, Mic, Phone, Plus, Save, Shield, Trash2, Upload } from "lucide-react";
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
    hasApiKey?: boolean;
    configJson?: Record<string, unknown>;
    isActive?: boolean;
  };
  type ProviderForm = {
    id?: string;
    name: string;
    type: ProviderType;
    baseUrl: string;
    apiKey: string;
    temperature: string;
    maxTokens: string;
    timeoutMs: string;
    isActive: boolean;
  };
  const standardBaseUrls: Record<Exclude<ProviderType, "CUSTOM">, string> = {
    OPENAI: "https://api.openai.com/v1",
    GEMINI: "https://generativelanguage.googleapis.com/v1beta",
    CLAUDE: "https://api.anthropic.com/v1"
  };

  const newProviderForm = (type: ProviderType = "OPENAI"): ProviderForm => ({
    name: `${type === "CUSTOM" ? "Custom" : type} provider`,
    type,
    baseUrl: type === "CUSTOM" ? "" : standardBaseUrls[type],
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
      apiKey: provider.hasApiKey ? "********" : "",
      temperature: String(provider.configJson?.temperature ?? "0.4"),
      maxTokens: String(provider.configJson?.maxTokens ?? "300"),
      timeoutMs: String(provider.configJson?.timeoutMs ?? "8000"),
      isActive: provider.isActive ?? true
    };
  }

  function selectProvider(provider: SavedProvider) {
    setConfig(mapProvider(provider));
    setResult("");
  }

  function startNewProvider() {
    setConfig(newProviderForm());
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
      baseUrl: type === "CUSTOM" ? "" : standardBaseUrls[type]
    }));
  }

  function providerPayload() {
    return {
      name: config.name,
      type: config.type,
      baseUrl: config.type === "CUSTOM" ? config.baseUrl || undefined : undefined,
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
      setResult(`Saved ${data.name}`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not save AI provider"));
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
                <div className="muted" style={{ fontSize: 10.5 }}>{provider.type}</div>
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
              {config.type === "CUSTOM" ? <ControlledField label="Custom endpoint URL" value={config.baseUrl} onChange={(value) => updateConfig("baseUrl", value)} /> : null}
              <ControlledField label="API key" value={config.apiKey} onChange={(value) => updateConfig("apiKey", value)} type="password" />
              <ControlledField label="Timeout ms" value={config.timeoutMs} onChange={(value) => updateConfig("timeoutMs", value)} />
              <ControlledField label="Temperature" value={config.temperature} onChange={(value) => updateConfig("temperature", value)} />
              <ControlledField label="Max tokens" value={config.maxTokens} onChange={(value) => updateConfig("maxTokens", value)} />
            </div>
            <div className="inline" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn primary" onClick={saveProvider}><Save size={14} />Save configuration</button>
              {result ? <span className={`badge ${resultTone}`}>{result}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeBasesPage() {
  type SourceType = "TEXT" | "FILE" | "DATABASE" | "WEBSITE";
  type KnowledgeBase = {
    id: string;
    name: string;
    description?: string;
    sourceType: SourceType;
    sourceConfig: Record<string, unknown>;
    status: "empty" | "ready" | "failed";
    chunks: Array<{ id: string; embedding?: number[]; sourceRef?: string }>;
    vectorIndex?: { provider: string; dimensions: number; chunkCount: number; updatedAt: string };
    errorMessage?: string;
    updatedAt: string;
  };

  const [items, setItems] = useState<KnowledgeBase[]>([]);
  const [draft, setDraft] = useState({
    name: "Support KB",
    description: "",
    sourceType: "FILE" as SourceType,
    text: "",
    url: "",
    connectionString: "",
    table: "",
    query: "",
    limit: "100"
  });
  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadKnowledgeBases();
  }, []);

  async function loadKnowledgeBases() {
    try {
      const { data } = await api.get<KnowledgeBase[]>("/knowledge-bases");
      setItems(data);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Unable to load knowledge bases"));
    }
  }

  function updateDraft(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function createKnowledgeBase(file?: File) {
    try {
      setBusy(true);
      setResult("");
      const { data: kb } = await api.post("/knowledge-bases", {
        name: draft.name,
        description: draft.description || undefined,
        sourceType: draft.sourceType
      });
      if (draft.sourceType === "TEXT") {
        await api.post(`/knowledge-bases/${kb.id}/ingest-text`, { text: draft.text });
      } else if (draft.sourceType === "WEBSITE") {
        await api.post(`/knowledge-bases/${kb.id}/ingest-url`, { url: draft.url });
      } else if (draft.sourceType === "DATABASE") {
        await api.post(`/knowledge-bases/${kb.id}/ingest-database`, {
          connectionString: draft.connectionString,
          table: draft.table || undefined,
          query: draft.query || undefined,
          limit: Number(draft.limit || 100)
        });
      } else {
        if (!file) throw new Error("Choose a file to upload.");
        const base64 = await fileToBase64(file);
        await api.post(`/knowledge-bases/${kb.id}/ingest-file`, { fileName: file.name, mimeType: file.type, base64 });
      }
      await loadKnowledgeBases();
      setResultTone("green");
      setResult(`Knowledge base ${draft.name} vectorized`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(error instanceof Error ? error.message : getApiMessage(error, "Could not create knowledge base"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteKnowledgeBase(id: string, name: string) {
    if (!window.confirm(`Delete knowledge base "${name}"?`)) return;
    try {
      await api.delete(`/knowledge-bases/${id}`);
      await loadKnowledgeBases();
      setResultTone("green");
      setResult(`Deleted ${name}`);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not delete knowledge base"));
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="panel inline" style={{ gap: 8, padding: "11px 15px", marginBottom: 16, background: "var(--green50)" }}>
        <Badge tone="green">Vector KB</Badge>
        <span style={{ fontSize: 12.5, color: "#0B5F32" }}>Upload files, crawl websites, or connect a database. All extracted chunks are stored with vectors for RAG.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        <div className="panel" style={{ height: "fit-content" }}>
          <div className="panel-header inline" style={{ gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: "var(--indigo50)", color: "var(--indigo)", display: "grid", placeItems: "center" }}><Database size={18} /></span>
            <div><div style={{ fontWeight: 600, fontSize: 14 }}>Add knowledge base</div><div className="muted" style={{ fontSize: 11.5 }}>Each KB becomes a searchable vector index</div></div>
          </div>
          <div style={{ padding: 18 }}>
            <ControlledField label="KB name" value={draft.name} onChange={(value) => updateDraft("name", value)} />
            <ControlledField label="Description" value={draft.description} onChange={(value) => updateDraft("description", value)} />
            <SelectField label="Source type" value={draft.sourceType} onChange={(value) => updateDraft("sourceType", value)} options={["FILE", "TEXT", "DATABASE", "WEBSITE"]} />
            {draft.sourceType === "TEXT" ? (
              <>
                <label className="label" htmlFor="kb-text">Knowledge text</label>
                <textarea id="kb-text" className="textarea mono" rows={7} value={draft.text} onChange={(event) => updateDraft("text", event.target.value)} />
                <button className="btn primary" onClick={() => createKnowledgeBase()} disabled={busy} style={{ marginTop: 12 }}><Save size={14} />{busy ? "Vectorizing" : "Create KB"}</button>
              </>
            ) : null}
            {draft.sourceType === "FILE" ? (
              <>
                <label className="label" htmlFor="kb-file">Upload file</label>
                <input id="kb-file" className="input" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => createKnowledgeBase(event.target.files?.[0])} disabled={busy} />
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>PDF, Word, Excel, CSV, text, and best-effort text extraction for other files.</div>
              </>
            ) : null}
            {draft.sourceType === "WEBSITE" ? (
              <>
                <ControlledField label="Website URL" value={draft.url} onChange={(value) => updateDraft("url", value)} />
                <button className="btn primary" onClick={() => createKnowledgeBase()} disabled={busy}><Globe2 size={14} />{busy ? "Crawling" : "Crawl website"}</button>
              </>
            ) : null}
            {draft.sourceType === "DATABASE" ? (
              <>
                <ControlledField label="Connection string" value={draft.connectionString} onChange={(value) => updateDraft("connectionString", value)} type="password" />
                <ControlledField label="Table" value={draft.table} onChange={(value) => updateDraft("table", value)} />
                <label className="label" htmlFor="kb-query">Query</label>
                <textarea id="kb-query" className="textarea mono" rows={4} value={draft.query} onChange={(event) => updateDraft("query", event.target.value)} placeholder="optional SELECT query" />
                <ControlledField label="Row limit" value={draft.limit} onChange={(value) => updateDraft("limit", value)} />
                <button className="btn primary" onClick={() => createKnowledgeBase()} disabled={busy}><Database size={14} />{busy ? "Indexing" : "Connect and index"}</button>
              </>
            ) : null}
            {result ? <div className={`badge ${resultTone}`} style={{ marginTop: 12 }}>{result}</div> : null}
          </div>
        </div>
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="panel-header row-between">
            <span style={{ fontWeight: 600, fontSize: 13 }}>Knowledge bases</span>
            <Badge tone="indigo">{items.length} total</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12, padding: 16 }}>
            {items.map((kb) => (
              <div key={kb.id} className="panel" style={{ padding: 14, background: "var(--surface2)" }}>
                <div className="row-between" style={{ alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{kb.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{kb.sourceType} / {kb.vectorIndex?.provider ?? "not-vectorized"}</div>
                  </div>
                  <Badge tone={kb.status === "ready" ? "green" : kb.status === "failed" ? "red" : "amber"}>{kb.status}</Badge>
                </div>
                {kb.description ? <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{kb.description}</div> : null}
                <div className="inline" style={{ gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                  <Badge tone="gray">{kb.chunks.length} chunks</Badge>
                  <Badge tone="gray">{kb.vectorIndex?.dimensions ?? 0} dims</Badge>
                  <Badge tone="gray">{kb.sourceConfig.pages && Array.isArray(kb.sourceConfig.pages) ? `${kb.sourceConfig.pages.length} pages` : "1 source"}</Badge>
                </div>
                {kb.errorMessage ? <div className="badge red" style={{ marginTop: 10 }}>{kb.errorMessage}</div> : null}
                <button className="btn danger" onClick={() => deleteKnowledgeBase(kb.id, kb.name)} style={{ marginTop: 12 }}><Trash2 size={14} />Delete</button>
              </div>
            ))}
            {items.length === 0 ? <div className="muted" style={{ fontSize: 12 }}>No knowledge bases yet.</div> : null}
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
    knowledgeBaseIds?: string[];
    updatedAt: string;
  };
  type KnowledgeBase = { id: string; name: string; sourceType: "TEXT" | "FILE" | "DATABASE" | "WEBSITE"; status: string; chunks: Array<{ id: string }>; errorMessage?: string };
  type PromptForm = Omit<PromptTemplate, "id" | "version" | "updatedAt"> & { id?: string; version?: number; updatedAt?: string };

  const emptyPrompt = (): PromptForm => ({
    name: "New Thai Voice Prompt",
    systemPrompt: "คุณคือผู้ช่วยเสียงภาษาไทย ตอบให้สุภาพ กระชับ และช่วยผู้โทรจนจบงาน",
    fallbackPrompt: "ขอโทษค่ะ ฉันยังไม่เข้าใจ ขอพูดอีกครั้งได้ไหมคะ",
    language: "th-TH",
    knowledgeBaseIds: [],
    isActive: true
  });

  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [kbToAdd, setKbToAdd] = useState("");
  const [form, setForm] = useState<PromptForm>(emptyPrompt());
  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");

  useEffect(() => {
    loadPrompts();
    loadKnowledgeBases();
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

  async function loadKnowledgeBases() {
    try {
      const { data } = await api.get<KnowledgeBase[]>("/knowledge-bases");
      setKnowledgeBases(data);
    } catch {
      setKnowledgeBases([]);
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
        knowledgeBaseIds: form.knowledgeBaseIds ?? [],
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

  function addKnowledgeBase() {
    if (!kbToAdd) return;
    setForm((current) => {
      const existing = new Set(current.knowledgeBaseIds ?? []);
      existing.add(kbToAdd);
      return { ...current, knowledgeBaseIds: Array.from(existing) };
    });
    setKbToAdd("");
  }

  function removeKnowledgeBase(id: string) {
    setForm((current) => ({ ...current, knowledgeBaseIds: (current.knowledgeBaseIds ?? []).filter((item) => item !== id) }));
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
            <div className="panel" style={{ marginTop: 16, padding: 14, background: "var(--surface2)" }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>RAG / Knowledge bases</div>
                <Badge tone="indigo">{form.knowledgeBaseIds?.length ?? 0} selected</Badge>
              </div>
              <div className="inline" style={{ gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="label" htmlFor="prompt-kb-add">Add KB</label>
                  <select id="prompt-kb-add" className="input" value={kbToAdd} onChange={(event) => setKbToAdd(event.target.value)}>
                    <option value="">Select a knowledge base</option>
                    {knowledgeBases.filter((kb) => !(form.knowledgeBaseIds ?? []).includes(kb.id)).map((kb) => (
                      <option key={kb.id} value={kb.id}>{kb.name} / {kb.status} / {kb.chunks.length} chunks</option>
                    ))}
                  </select>
                </div>
                <button className="btn teal" onClick={addKnowledgeBase}><Plus size={14} />Add</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                {(form.knowledgeBaseIds ?? []).map((id) => {
                  const kb = knowledgeBases.find((item) => item.id === id);
                  return (
                    <div key={id} className="panel row-between" style={{ gap: 8, padding: 10, background: "var(--surface)" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{kb?.name ?? id}</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>{kb ? `${kb.sourceType} / ${kb.chunks.length} chunks` : "missing"}</div>
                      </div>
                      <button className="btn" onClick={() => removeKnowledgeBase(id)} title="Remove KB"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
                {(form.knowledgeBaseIds ?? []).length === 0 ? <div className="muted" style={{ fontSize: 11.5 }}>No KB selected for this prompt.</div> : null}
              </div>
            </div>
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
  type TelephonyConnection = {
    id?: string;
    name: string;
    type: "ARI" | "SIP";
    host: string;
    port: string;
    transport: "UDP" | "TCP" | "TLS" | "WS" | "WSS";
    ariUrl: string;
    username: string;
    password: string;
    extension: string;
    appName: string;
    flowId: string;
    status?: string;
    lastRegistrationMessage?: string;
  };
  type FlowOption = { id: string; name: string; status: string };

  const [result, setResult] = useState("");
  const [resultTone, setResultTone] = useState<"green" | "amber" | "red">("green");
  const [liveStatus, setLiveStatus] = useState("checking");
  const [connections, setConnections] = useState<TelephonyConnection[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [config, setConfig] = useState<TelephonyConnection>({
    name: "FreePBX SIP 7777",
    type: "SIP",
    host: "192.168.30.14",
    port: "5060",
    transport: "UDP",
    ariUrl: "http://192.168.30.14:8088/ari",
    username: "7777",
    password: "",
    appName: "voicebot-app",
    extension: "7777",
    flowId: ""
  });

  useEffect(() => {
    api.get("/system/health").then(({ data }) => setLiveStatus(data.mockMode ? "disabled" : "active")).catch(() => setLiveStatus("unknown"));
    api.get("/flows").then(({ data }) => setFlows(data.map((flow: { id: string; name: string; status: string }) => ({ id: flow.id, name: flow.name, status: flow.status })))).catch(() => undefined);
    loadConnections();
  }, []);

  function loadConnections() {
    api.get("/telephony-connections").then(({ data }) => {
      const mapped = data.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        name: String(item.name ?? ""),
        type: (item.type === "ARI" ? "ARI" : "SIP") as "ARI" | "SIP",
        host: String(item.host ?? ""),
        port: String(item.port ?? (item.type === "ARI" ? 8088 : 5060)),
        transport: (item.transport ?? "UDP") as "UDP" | "TCP" | "TLS" | "WS" | "WSS",
        ariUrl: String(item.ariUrl ?? ""),
        username: String(item.username ?? ""),
        password: String(item.password ?? ""),
        appName: String(item.appName ?? "voicebot-app"),
        extension: String(item.extension ?? "7777"),
        flowId: String(item.flowId ?? ""),
        status: String(item.status ?? "not-tested"),
        lastRegistrationMessage: String(item.lastRegistrationMessage ?? "")
      }));
      setConnections(mapped);
      const first = data[0];
      if (first) setConfig(mapped[0]);
    }).catch(() => {
      setResultTone("red");
      setResult("Unable to load telephony connections");
    });
  }

  function updateConfig(field: keyof typeof config, value: string) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function startNew(type: "ARI" | "SIP") {
    setConfig({
      name: type === "SIP" ? "FreePBX SIP 7777" : "FreePBX ARI",
      type,
      host: "192.168.30.14",
      port: type === "SIP" ? "5060" : "8088",
      transport: type === "SIP" ? "UDP" : "TCP",
      ariUrl: "http://192.168.30.14:8088/ari",
      username: type === "SIP" ? "7777" : "neston14",
      password: "",
      appName: "voicebot-app",
      extension: "7777",
      flowId: flows.find((flow) => flow.status === "PUBLISHED")?.id ?? flows[0]?.id ?? ""
    });
    setResult("");
  }

  function payload() {
    return {
      name: config.name,
      type: config.type,
      host: config.host,
      port: Number(config.port),
      transport: config.transport,
      ariUrl: config.type === "ARI" ? config.ariUrl : undefined,
      username: config.username,
      password: config.password || undefined,
      extension: config.extension,
      appName: config.appName,
      flowId: config.flowId || undefined,
      isActive: true
    };
  }

  async function save() {
    try {
      const { data } = config.id ? await api.patch(`/telephony-connections/${config.id}`, payload()) : await api.post("/telephony-connections", payload());
      await loadConnections();
      setConfig((current) => ({ ...current, id: data.id, password: data.password ?? "", status: data.status }));
      setResultTone("green");
      setResult(`Saved ${data.type} ${data.username}@${data.host}:${data.port} for extension ${data.extension}`);
    } catch (error) {
      setResultTone("red");
      setResult(getApiMessage(error, "Could not save telephony connection"));
    }
  }

  async function test() {
    if (!config.id) {
      setResultTone("amber");
      setResult("Save this connection before testing.");
      return;
    }
    try {
      const { data } = await api.post(`/telephony-connections/${config.id}/test`);
      await loadConnections();
      setResultTone(data.ok ? "green" : "red");
      setResult(data.message);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "Live telephony test failed"));
    }
  }

  async function registerSip() {
    if (!config.id) {
      setResultTone("amber");
      setResult("Save this SIP connection before registering.");
      return;
    }
    try {
      const { data } = await api.post(`/telephony-connections/${config.id}/register`);
      await loadConnections();
      setResultTone(data.ok ? "green" : "red");
      setResult(data.message);
    } catch (error: unknown) {
      setResultTone("red");
      setResult(getApiMessage(error, "SIP registration failed"));
    }
  }
  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="panel inline" style={{ gap: 8, padding: "11px 15px", marginBottom: 16, background: liveStatus === "active" ? "var(--green50)" : "var(--amber50)" }}>
        <Badge tone={liveStatus === "active" ? "green" : "amber"}>{liveStatus === "active" ? "Live Mode active" : "Live Mode checking"}</Badge>
        <span style={{ fontSize: 12.5, color: liveStatus === "active" ? "#0B5F32" : "#7A5A12" }}>Manage multiple ARI or SIP voice bot registrations and map each extension to a flow.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      <div className="panel" style={{ overflow: "hidden", height: "fit-content" }}>
        <div className="panel-header row-between">
          <span style={{ fontWeight: 600, fontSize: 13 }}>Telephony connections</span>
          <div className="inline" style={{ gap: 6 }}>
            <button className="btn" onClick={() => startNew("SIP")}>SIP</button>
            <button className="btn" onClick={() => startNew("ARI")}>ARI</button>
          </div>
        </div>
        {connections.map((item) => (
          <button key={item.id} className="row-between" onClick={() => setConfig(item)} style={{ width: "100%", padding: "12px 15px", border: 0, borderTop: "1px solid var(--border2)", background: item.id === config.id ? "var(--indigo50)" : "transparent", textAlign: "left" }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{item.name}</div>
              <div className="muted" style={{ fontSize: 10.5 }}>{`${item.type} ${item.extension} -> ${flows.find((flow) => flow.id === item.flowId)?.name ?? "No flow"}`}</div>
            </div>
            <Badge tone={item.status === "registered" || item.status === "connected" ? "green" : item.status?.includes("failed") ? "red" : "amber"}>{item.status ?? "new"}</Badge>
          </button>
        ))}
        {connections.length === 0 ? <div className="muted" style={{ padding: 15, fontSize: 12 }}>No connections saved yet.</div> : null}
      </div>
      <div className="panel">
        <div className="panel-header inline" style={{ gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: "var(--indigo50)", color: "var(--indigo)", display: "grid", placeItems: "center" }}><Phone size={18} /></span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>{config.id ? config.name : "New telephony connection"}</div><div className="muted" style={{ fontSize: 11.5 }}>Inbound extension to Voice AI flow mapping</div></div>
          <Badge tone={config.status === "registered" || config.status === "connected" ? "green" : "amber"}>{config.status ?? "new"}</Badge>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 16 }}>
            <ControlledField label="Config name" value={config.name} onChange={(value) => updateConfig("name", value)} />
            <SelectField label="Type" value={config.type} onChange={(value) => updateConfig("type", value as "ARI" | "SIP")} options={["SIP", "ARI"]} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px", gap: 16 }}>
            <ControlledField label="Host / PBX IP" value={config.host} onChange={(value) => updateConfig("host", value)} />
            <ControlledField label="Port" value={config.port} onChange={(value) => updateConfig("port", value)} />
            <SelectField label="Transport" value={config.transport} onChange={(value) => updateConfig("transport", value as TelephonyConnection["transport"])} options={["UDP", "TCP", "TLS", "WS", "WSS"]} />
          </div>
          {config.type === "ARI" ? <ControlledField label="ARI URL" value={config.ariUrl} onChange={(value) => updateConfig("ariUrl", value)} /> : null}
          <ControlledField label="Username" value={config.username} onChange={(value) => updateConfig("username", value)} />
          <ControlledField label="Password" value={config.password} onChange={(value) => updateConfig("password", value)} type="password" />
          <ControlledField label="Voice bot extension" value={config.extension} onChange={(value) => updateConfig("extension", value)} />
          <ControlledField label="App name" value={config.appName} onChange={(value) => updateConfig("appName", value)} />
          <SelectField label="Run flow for this extension" value={config.flowId} onChange={(value) => updateConfig("flowId", value)} options={flows.map((flow) => flow.id)} />
          <div className="panel mono" style={{ padding: 14, background: "var(--surface2)", fontSize: 12, overflow: "auto" }}>
            {config.type === "SIP" ? `SIP REGISTER ${config.username}@${config.host}:${config.port} extension ${config.extension}\nMapped flow: ${flows.find((flow) => flow.id === config.flowId)?.name ?? "No flow selected"}` : `[from-internal-custom]\nexten => ${config.extension || "7777"},1,NoOp(Voice AI Bot)\n same => n,Stasis(${config.appName || "voicebot-app"})\n same => n,Hangup()`}
          </div>
          <div className="inline" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn teal" onClick={test}>{config.type === "SIP" ? "Test/Register" : "Test ARI"}</button>
            {config.type === "SIP" ? <button className="btn teal" onClick={registerSip}>Register SIP</button> : null}
            <button className="btn primary" onClick={save}>Save configuration</button>
            {result ? <span className={`badge ${resultTone}`}>{result}</span> : null}
          </div>
          {config.lastRegistrationMessage ? <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{config.lastRegistrationMessage}</div> : null}
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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
