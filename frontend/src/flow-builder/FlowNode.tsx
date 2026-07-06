import { Activity, Bot, Clock, GitBranch, Hash, Phone, Play, Shield, Square, Wrench } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const iconMap = {
  start: Play,
  voiceBot: Bot,
  ivrMenu: Hash,
  condition: GitBranch,
  transfer: Phone,
  fallback: Shield,
  hangup: Square,
  dtmfInput: Wrench,
  businessHours: Clock,
  webhook: Activity
};

const colorMap = {
  start: "var(--green)",
  voiceBot: "var(--teal)",
  ivrMenu: "var(--indigo)",
  condition: "var(--amber)",
  transfer: "var(--indigo)",
  fallback: "var(--indigo)",
  hangup: "var(--red)",
  dtmfInput: "var(--indigo)",
  businessHours: "var(--amber)",
  webhook: "var(--violet)"
};

export function FlowNode({ data, selected, type }: NodeProps) {
  const nodeType = (type ?? "start") as keyof typeof iconMap;
  const Icon = iconMap[nodeType] ?? Play;
  const color = colorMap[nodeType] ?? "var(--ink3)";
  return (
    <div className={`flow-node ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-strip" style={{ background: color }} />
      <div className="node-body">
        <div className="inline" style={{ gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 6, background: `${color}22`, color, display: "grid", placeItems: "center", flex: "none" }}>
            <Icon size={15} />
          </span>
          <span style={{ fontWeight: 600, fontSize: 12.5 }}>{String(data.label ?? "Node")}</span>
        </div>
        <div className="muted" style={{ fontSize: 10.8, lineHeight: 1.35, marginTop: 7 }}>
          {String(data.description ?? "Configure route")}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
