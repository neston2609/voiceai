import { useMemo, useState } from "react";
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

const initialNodes: Node[] = [
  { id: "start", type: "start", position: { x: 60, y: 180 }, data: { label: "Start", description: "Inbound call - from-pstn" } },
  { id: "voicebot", type: "voiceBot", position: { x: 270, y: 180 }, selected: true, data: { label: "Voice Bot", description: "Greet and understand intent - gpt-4o" } },
  { id: "ivr", type: "ivrMenu", position: { x: 490, y: 100 }, data: { label: "IVR Menu", description: "Press 1 status - 2 billing - 0 agent" } },
  { id: "transfer", type: "transfer", position: { x: 490, y: 260 }, data: { label: "Transfer", description: "Route to queue:sales" } },
  { id: "condition", type: "condition", position: { x: 710, y: 180 }, data: { label: "Condition", description: "confidence < 0.80 to escalate" } },
  { id: "fallback", type: "fallback", position: { x: 920, y: 100 }, data: { label: "Fallback", description: "Route to IVR ext 7100" } },
  { id: "hangup", type: "hangup", position: { x: 920, y: 260 }, data: { label: "Hangup", description: "End call and CSAT survey" } }
];

const initialEdges: Edge[] = [
  { id: "e_start_voicebot", source: "start", target: "voicebot" },
  { id: "e_voicebot_ivr", source: "voicebot", target: "ivr", label: "fallback" },
  { id: "e_voicebot_transfer", source: "voicebot", target: "transfer", label: "resolved" },
  { id: "e_ivr_condition", source: "ivr", target: "condition", label: "digit 1" },
  { id: "e_transfer_condition", source: "transfer", target: "condition", label: "answered" },
  { id: "e_condition_fallback", source: "condition", target: "fallback", label: "low confidence" },
  { id: "e_condition_hangup", source: "condition", target: "hangup", label: "complete" }
];

export function FlowBuilderPage() {
  const setScreen = useAppStore((state) => state.setScreen);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [validation, setValidation] = useState<string>("Not validated");
  const nodeTypes = useMemo(() => ({ start: FlowNode, voiceBot: FlowNode, ivrMenu: FlowNode, condition: FlowNode, transfer: FlowNode, fallback: FlowNode, hangup: FlowNode }), []);

  const selected = nodes.find((node) => node.selected) ?? nodes[1];

  function graphJson() {
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        label: String(node.data.label),
        data: {
          ...node.data,
          aiProviderId: node.type === "voiceBot" ? "prov_mock" : undefined,
          model: node.type === "voiceBot" ? "gpt-4o" : undefined,
          promptId: node.type === "voiceBot" ? "prompt_support" : undefined,
          dialogflowConfigId: node.type === "voiceBot" ? "df_mock" : undefined,
          allowedDigits: node.type === "ivrMenu" ? ["1", "2", "0"] : undefined,
          expression: node.type === "condition" ? "confidence < 0.80" : undefined,
          destination: node.type === "transfer" ? "sales" : undefined
        }
      })),
      edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: String(edge.label ?? "") }))
    };
  }

  async function validate() {
    const { data } = await api.post("/flows/flow_inbound_support/validate", { graphJson: graphJson() });
    setValidation(data.valid ? `Valid - ${data.warnings.length} warnings` : data.errors.join("; "));
  }

  async function publish() {
    const { data } = await api.post("/flows/flow_inbound_support/publish", { graphJson: graphJson() });
    setValidation(`Published ${data.name}`);
  }

  return (
    <div className="builder">
      <div className="toolbar">
        <button className="btn"><Save size={14} />Save Draft</button>
        <button className="btn" onClick={validate}><CheckCircle2 size={14} />Validate</button>
        <button className="btn teal" onClick={() => setScreen("simulate")}><Play size={14} />Simulate</button>
        <button className="btn"><Download size={14} />Export JSON</button>
        <button className="btn"><Upload size={14} />Import JSON</button>
        <button className="btn primary" onClick={publish} style={{ marginLeft: "auto" }}>Publish</button>
      </div>
      <div className="builder-body">
        <aside className="palette">
          <div className="input muted" style={{ marginBottom: 12 }}>Search nodes</div>
          {palette.map((group) => (
            <div key={group.cat} style={{ marginTop: 12 }}>
              <div className="label" style={{ textTransform: "uppercase", letterSpacing: ".07em" }}>{group.cat}</div>
              {group.items.map((item) => (
                <div className="node-palette-item" key={item.label} draggable>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: `${nodeTone[item.tone]}22`, color: nodeTone[item.tone], display: "grid", placeItems: "center" }}>
                    <item.icon size={14} />
                  </span>
                  {item.label}
                </div>
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
            onConnect={(connection: Connection) => setEdges((eds) => addEdge(connection, eds))}
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
              <div style={{ fontWeight: 600, fontSize: 13 }}>{String(selected.data.label)}</div>
              <div className="muted" style={{ fontSize: 10.5 }}>Node properties</div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <label className="label">Node label</label>
            <input className="input" value={String(selected.data.label)} readOnly />
            <div style={{ height: 15 }} />
            <label className="label">AI provider</label>
            <div className="select">OpenAI - gpt-4o</div>
            <div style={{ height: 15 }} />
            <label className="label">System prompt</label>
            <div className="select">Support Bot - Prompt v4</div>
            <div style={{ height: 15 }} />
            <label className="label">Validation</label>
            <div className={`badge ${validation.startsWith("Valid") || validation.startsWith("Published") ? "green" : "amber"}`}>{validation}</div>
            <div className="panel" style={{ marginTop: 16, padding: 12, background: "var(--surface2)" }}>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>Advanced settings</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 11.5 }}>Max retries: 3, STT threshold: 0.80, escape key: 0</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
