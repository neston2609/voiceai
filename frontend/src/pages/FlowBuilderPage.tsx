import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, Download, Play, Save, Upload } from "lucide-react";
import { api } from "../api/client";
import { palette, nodeTone } from "../data/mock";
import { FlowNode } from "../flow-builder/FlowNode";
import { useAppStore } from "../store/appStore";
import type { CallFlow } from "../types/domain";

type ProviderOption = { id: string; name: string; type: "OPENAI" | "GEMINI" | "CLAUDE" | "CUSTOM" | "MOCK" };
type SelectOption = { id: string; name: string; version?: number };
type ModelOption = { id: string; label: string };
type KnowledgeOption = { id: string; name: string; status: string; chunks?: unknown[] };
type FlowMeta = { id?: string; name: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" };

const defaultNodes: Node[] = [
  { id: "start", type: "start", position: { x: 60, y: 180 }, data: { label: "Start", description: "Inbound call" } },
  { id: "voicebot", type: "voiceBot", position: { x: 280, y: 180 }, selected: true, data: { label: "Voice Bot", description: "Thai greeting and intent detection" } },
  { id: "hangup", type: "hangup", position: { x: 520, y: 180 }, data: { label: "Hangup", description: "End call" } }
];

const defaultEdges: Edge[] = [{ id: "e_start_voicebot", source: "start", target: "voicebot" }, { id: "e_voicebot_hangup", source: "voicebot", target: "hangup", label: "complete" }];

const nodeTypesByName = {
  start: FlowNode,
  voiceBot: FlowNode,
  ivrMenu: FlowNode,
  dtmfInput: FlowNode,
  condition: FlowNode,
  businessHours: FlowNode,
  webhook: FlowNode,
  transfer: FlowNode,
  fallback: FlowNode,
  hangup: FlowNode
};

const paletteTypeByLabel: Record<string, string> = {
  Start: "start",
  Hangup: "hangup",
  "Voice Bot": "voiceBot",
  "IVR Menu": "ivrMenu",
  "DTMF Input": "dtmfInput",
  Condition: "condition",
  "Business Hours": "businessHours",
  "Webhook / API": "webhook",
  Transfer: "transfer",
  Fallback: "fallback"
};

export function FlowBuilderPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { selectedFlowId, setSelectedFlowId, setScreen } = useAppStore();
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [meta, setMeta] = useState<FlowMeta>({ name: "New Voice Flow", description: "Live voice bot flow", status: "DRAFT" });
  const [validation, setValidation] = useState<string>("Not validated");
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [prompts, setPrompts] = useState<SelectOption[]>([]);
  const [dialogflows, setDialogflows] = useState<SelectOption[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeOption[]>([]);
  const [modelOptionsByProvider, setModelOptionsByProvider] = useState<Record<string, ModelOption[]>>({});
  const [loadingModelsFor, setLoadingModelsFor] = useState("");
  const [modelLoadError, setModelLoadError] = useState("");
  const nodeTypes = useMemo(() => nodeTypesByName, []);

  const selected = nodes.find((node) => node.selected) ?? nodes[0];
  const selectedProviderId = selected?.type === "voiceBot" ? String(selected.data.aiProviderId ?? providers[0]?.id ?? "") : "";
  const selectedModelValue = selected?.type === "voiceBot" ? String(selected.data.model ?? "") : "";
  const selectedModelOptions = selectedProviderId ? modelOptionsByProvider[selectedProviderId] ?? [] : [];
  const modelSelectOptions = selectedModelValue && !selectedModelOptions.some((model) => model.id === selectedModelValue)
    ? [{ id: selectedModelValue, label: selectedModelValue }, ...selectedModelOptions]
    : selectedModelOptions;
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);

  useEffect(() => {
    Promise.all([
      api.get("/ai-providers"),
      api.get("/prompts"),
      api.get("/dialogflow-configs"),
      api.get("/knowledge-bases")
    ]).then(([providerResponse, promptResponse, dialogflowResponse, knowledgeResponse]) => {
      setProviders(providerResponse.data.map((item: { id: string; name: string; type: ProviderOption["type"] }) => ({ id: item.id, name: item.name, type: item.type })));
      setPrompts(promptResponse.data.map((item: { id: string; name: string; version?: number }) => ({ id: item.id, name: item.name, version: item.version })));
      setDialogflows(dialogflowResponse.data.map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })));
      setKnowledgeBases(knowledgeResponse.data.map((item: KnowledgeOption) => ({ id: item.id, name: item.name, status: item.status, chunks: item.chunks })));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedFlowId) {
      setMeta({ name: "New Voice Flow", description: "Live voice bot flow", status: "DRAFT" });
      setNodes(defaultNodes);
      setEdges(defaultEdges);
      setValidation("Not validated");
      return;
    }
    api.get<CallFlow>(`/flows/${selectedFlowId}`).then(({ data }) => {
      setMeta({ id: data.id, name: data.name, description: data.description, status: data.status });
      setNodes(toReactNodes(data));
      setEdges(data.graphJson.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label || undefined })));
      setValidation("Loaded from server");
    }).catch((error: unknown) => {
      setValidation(getErrorMessage(error, "Could not load flow"));
    });
  }, [selectedFlowId, setEdges, setNodes]);

  function toReactNodes(flow: CallFlow): Node[] {
    return flow.graphJson.nodes.map((node, index) => {
      const position = isPosition(node.data.position) ? node.data.position : { x: 70 + (index % 4) * 220, y: 100 + Math.floor(index / 4) * 150 };
      return {
        id: node.id,
        type: node.type,
        position,
        data: {
          ...node.data,
          label: node.label,
          description: typeof node.data.description === "string" ? node.data.description : node.type
        }
      };
    });
  }

  function updateSelectedNode(field: string, value: string) {
    if (!selected) return;
    setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, data: { ...node.data, [field]: value } } : node));
  }

  const loadProviderModels = useCallback(async (providerId: string) => {
    if (!providerId) return [];
    const provider = providers.find((item) => item.id === providerId);
    setModelLoadError("");
    if (provider?.type === "CUSTOM") {
      setModelLoadError("Custom providers do not expose a standard model-list API.");
      return [];
    }
    if (provider?.type === "MOCK") {
      setModelLoadError("Mock providers do not expose live model lists.");
      return [];
    }
    const cached = modelOptionsByProvider[providerId];
    if (cached) return cached;
    try {
      setLoadingModelsFor(providerId);
      const { data } = await api.post(`/ai-providers/${providerId}/models`, {});
      const models = (data.models ?? []) as ModelOption[];
      setModelOptionsByProvider((current) => ({ ...current, [providerId]: models }));
      return models;
    } catch (error: unknown) {
      setModelLoadError(getErrorMessage(error, "Could not load models from the selected AI provider"));
      return [];
    } finally {
      setLoadingModelsFor("");
    }
  }, [modelOptionsByProvider, providers]);

  useEffect(() => {
    if (selected?.type !== "voiceBot" || !selectedProviderId || modelOptionsByProvider[selectedProviderId]) return;
    void loadProviderModels(selectedProviderId).then((models) => {
      if (!String(selected.data.model ?? "").trim() && models[0]?.id) {
        updateSelectedNode("model", models[0].id);
      }
    });
  }, [loadProviderModels, modelOptionsByProvider, selected?.type, selectedProviderId]);

  function graphJson() {
    const firstProvider = providers[0];
    const firstPrompt = prompts[0];
    const firstDialogflow = dialogflows[0];
    return {
      nodes: nodes.map((node) => {
        const data = {
          ...node.data,
          position: node.position,
          aiProviderId: node.type === "voiceBot" ? String(node.data.aiProviderId ?? firstProvider?.id ?? "") : undefined,
          model: node.type === "voiceBot" ? String(node.data.model ?? "") : undefined,
          promptId: node.type === "voiceBot" ? String(node.data.promptId ?? firstPrompt?.id ?? "") : undefined,
          dialogflowConfigId: node.type === "voiceBot" ? String(node.data.dialogflowConfigId ?? firstDialogflow?.id ?? "") : undefined
        };
        return { id: node.id, type: node.type ?? "start", label: String(node.data.label ?? node.id), data };
      }),
      edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: String(edge.label ?? "") }))
    };
  }

  async function saveDraft() {
    const payload = { name: meta.name, description: meta.description, status: "DRAFT", graphJson: graphJson() };
    const { data } = meta.id ? await api.patch<CallFlow>(`/flows/${meta.id}`, payload) : await api.post<CallFlow>("/flows", payload);
    setMeta({ id: data.id, name: data.name, description: data.description, status: data.status });
    setSelectedFlowId(data.id);
    setValidation(`Saved draft ${data.name}`);
    return data;
  }

  async function validate() {
    try {
      const flowId = meta.id ?? "draft";
      const { data } = await api.post(`/flows/${flowId}/validate`, { graphJson: graphJson() });
      setValidation(data.valid ? `Valid - ${data.warnings.length} warnings` : data.errors.join("; "));
    } catch (error: unknown) {
      setValidation(getErrorMessage(error, "Validation failed"));
    }
  }

  async function publish() {
    try {
      const flow = meta.id ? { id: meta.id } : await saveDraft();
      const { data } = await api.post<CallFlow>(`/flows/${flow.id}/publish`, { graphJson: graphJson() });
      setMeta({ id: data.id, name: data.name, description: data.description, status: data.status });
      setValidation(`Published ${data.name}`);
    } catch (error: unknown) {
      setValidation(getErrorMessage(error, "Publish failed"));
    }
  }

  function addNode(label: string) {
    const type = paletteTypeByLabel[label] ?? "voiceBot";
    const id = `${type}_${Date.now().toString(36)}`;
    const nextNode: Node = {
      id,
      type,
      position: { x: 180 + nodes.length * 28, y: 120 + nodes.length * 18 },
      data: { label, description: "Configure route" }
    };
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), { ...nextNode, selected: true }]);
  }

  function toggleNodeKnowledgeBase(id: string) {
    if (!selected) return;
    const current = Array.isArray(selected.data.knowledgeBaseIds) ? selected.data.knowledgeBaseIds.filter((item): item is string => typeof item === "string") : [];
    const set = new Set(current);
    if (set.has(id)) set.delete(id); else set.add(id);
    setNodes((nodesNow) => nodesNow.map((node) => node.id === selected.id ? { ...node, data: { ...node.data, knowledgeBaseIds: Array.from(set) } } : node));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...meta, graphJson: graphJson() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${meta.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "voice-flow"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file?: File) {
    if (!file) return;
    const imported = JSON.parse(await file.text()) as Partial<CallFlow>;
    if (!imported.graphJson?.nodes || !imported.graphJson?.edges) {
      setValidation("Import failed: JSON does not contain graphJson nodes and edges");
      return;
    }
    setMeta({ name: imported.name ?? "Imported Voice Flow", description: imported.description ?? "", status: "DRAFT" });
    setSelectedFlowId(undefined);
    setNodes(toReactNodes({ ...(imported as CallFlow), id: "imported", updatedAt: new Date().toISOString(), graphJson: imported.graphJson }));
    setEdges(imported.graphJson.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label || undefined })));
    setValidation("Imported JSON. Save draft to persist.");
  }

  return (
    <div className="builder">
      <div className="toolbar">
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(event) => importJson(event.target.files?.[0])} />
        <input className="input" value={meta.name} onChange={(event) => setMeta((current) => ({ ...current, name: event.target.value }))} style={{ width: 220 }} />
        <input className="input" value={meta.description} onChange={(event) => setMeta((current) => ({ ...current, description: event.target.value }))} style={{ width: 280 }} />
        <button className="btn" onClick={saveDraft}><Save size={14} />Save Draft</button>
        <button className="btn" onClick={validate}><CheckCircle2 size={14} />Validate</button>
        <button className="btn teal" onClick={() => setScreen("simulate")}><Play size={14} />Simulate</button>
        <button className="btn" onClick={exportJson}><Download size={14} />Export JSON</button>
        <button className="btn" onClick={() => fileInputRef.current?.click()}><Upload size={14} />Import JSON</button>
        <button className="btn primary" onClick={publish} style={{ marginLeft: "auto" }}>Publish</button>
      </div>
      <div className="builder-body">
        <aside className="palette">
          <div className="input muted" style={{ marginBottom: 12 }}>Click node to add</div>
          {palette.map((group) => (
            <div key={group.cat} style={{ marginTop: 12 }}>
              <div className="label" style={{ textTransform: "uppercase", letterSpacing: ".07em" }}>{group.cat}</div>
              {group.items.map((item) => (
                <button className="node-palette-item" key={item.label} onClick={() => addNode(item.label)} style={{ width: "100%", textAlign: "left" }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: `${nodeTone[item.tone]}22`, color: nodeTone[item.tone], display: "grid", placeItems: "center" }}>
                    <item.icon size={14} />
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <div className="canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(connection: Connection) => setEdges((eds) => addEdge({ ...connection, id: `e_${connection.source}_${connection.target}_${Date.now().toString(36)}` }, eds))}
            fitView
          >
            <Background color="#d9dde6" gap={22} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
        <aside className="inspector">
          <div className="panel-header inline" style={{ gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--teal50)", color: "var(--teal)", display: "grid", placeItems: "center" }}><CheckCircle2 size={15} /></span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{String(selected?.data.label ?? "Node")}</div>
              <div className="muted" style={{ fontSize: 10.5 }}>{meta.status} / {meta.id ?? "unsaved"}</div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <label className="label">Node label</label>
            <input className="input" value={String(selected?.data.label ?? "")} onChange={(event) => updateSelectedNode("label", event.target.value)} />
            <div style={{ height: 15 }} />
            <label className="label">Description</label>
            <input className="input" value={String(selected?.data.description ?? "")} onChange={(event) => updateSelectedNode("description", event.target.value)} />
            {selected?.type === "voiceBot" ? (
              <>
                <div style={{ height: 15 }} />
                <SelectSetting label="AI provider" value={selectedProviderId} options={providers.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => {
                  updateSelectedNode("aiProviderId", value);
                  updateSelectedNode("model", "");
                  void loadProviderModels(value).then((models) => {
                    if (models[0]?.id) updateSelectedNode("model", models[0].id);
                  });
                }} />
                <div style={{ height: 15 }} />
                <SelectSetting label="Model" value={selectedModelValue} options={modelSelectOptions.map((model) => ({ value: model.id, label: model.label || model.id }))} onChange={(value) => updateSelectedNode("model", value)} />
                <div className="inline" style={{ gap: 8, marginTop: 8 }}>
                  <button className="btn" onClick={() => void loadProviderModels(selectedProviderId).then((models) => {
                    if (!selectedModelValue && models[0]?.id) updateSelectedNode("model", models[0].id);
                  })} disabled={!selectedProviderId || loadingModelsFor === selectedProviderId || selectedProvider?.type === "CUSTOM" || selectedProvider?.type === "MOCK"}>
                    {loadingModelsFor === selectedProviderId ? "Loading models" : "Refresh models"}
                  </button>
                  {modelLoadError ? <span className="badge amber">{modelLoadError}</span> : null}
                </div>
                <div style={{ height: 15 }} />
                <SelectSetting label="System prompt" value={String(selected.data.promptId ?? prompts[0]?.id ?? "")} options={prompts.map((item) => ({ value: item.id, label: `${item.name} v${item.version ?? 1}` }))} onChange={(value) => updateSelectedNode("promptId", value)} />
                <div style={{ height: 15 }} />
                <SelectSetting label="Dialogflow config" value={String(selected.data.dialogflowConfigId ?? dialogflows[0]?.id ?? "")} options={dialogflows.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => updateSelectedNode("dialogflowConfigId", value)} />
                <div style={{ height: 15 }} />
                <label className="label">RAG knowledge bases</label>
                <div style={{ display: "grid", gap: 7 }}>
                  {knowledgeBases.length ? knowledgeBases.map((kb) => (
                    <label key={kb.id} className="inline panel" style={{ gap: 8, padding: 9, background: "var(--surface2)" }}>
                      <input type="checkbox" checked={(Array.isArray(selected.data.knowledgeBaseIds) ? selected.data.knowledgeBaseIds : []).includes(kb.id)} onChange={() => toggleNodeKnowledgeBase(kb.id)} />
                      <span style={{ fontSize: 12, flex: 1 }}>{kb.name}</span>
                      <span className={`badge ${kb.status === "ready" ? "green" : "amber"}`}>{kb.chunks?.length ?? 0}</span>
                    </label>
                  )) : <div className="muted" style={{ fontSize: 11.5 }}>No knowledge bases configured.</div>}
                </div>
              </>
            ) : null}
            <div style={{ height: 15 }} />
            <label className="label">Validation</label>
            <div className={`badge ${validation.startsWith("Valid") || validation.startsWith("Published") || validation.startsWith("Saved") || validation.startsWith("Loaded") ? "green" : "amber"}`}>{validation}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SelectSetting({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length ? options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : <option value="">No options configured</option>}
      </select>
    </>
  );
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return typeof value === "object" && value !== null && "x" in value && "y" in value
    && typeof (value as { x: unknown }).x === "number"
    && typeof (value as { y: unknown }).y === "number";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: string[] } } }).response;
    return response?.data?.message ?? response?.data?.errors?.join("; ") ?? fallback;
  }
  return fallback;
}
