import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { useAppStore } from "../store/appStore";
import type { CallFlow } from "../types/domain";

export function FlowListPage() {
  const queryClient = useQueryClient();
  const { setScreen, setSelectedFlowId } = useAppStore();
  const { data: flows = [] } = useQuery({ queryKey: ["flows"], queryFn: async () => (await api.get<CallFlow[]>("/flows")).data });

  function openFlow(flowId?: string) {
    setSelectedFlowId(flowId);
    setScreen("builder");
  }

  async function deleteFlow(flowId: string, name: string) {
    if (!window.confirm(`Delete flow "${name}"?`)) return;
    await api.delete(`/flows/${flowId}`);
    await queryClient.invalidateQueries({ queryKey: ["flows"] });
  }

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div className="subtle" style={{ fontSize: 12.5 }}>Draft, published, and archived call flows</div>
        <button className="btn primary" onClick={() => openFlow(undefined)}>New flow</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {flows.map((flow) => (
          <div key={flow.id} className="panel" style={{ padding: 17, textAlign: "left" }}>
            <div className="row-between">
              <button onClick={() => openFlow(flow.id)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{flow.name}</button>
              <Badge tone={flow.status === "PUBLISHED" ? "green" : flow.status === "DRAFT" ? "amber" : "gray"}>{flow.status}</Badge>
            </div>
            <div className="muted" style={{ fontSize: 11.5, margin: "9px 0 14px" }}>{flow.description}</div>
            <div className="row-between muted" style={{ borderTop: "1px solid var(--border2)", paddingTop: 11, fontSize: 11 }}>
              <span>{flow.graphJson.nodes.length} nodes</span>
              <span>{flow.activeVersionId ?? "draft"}</span>
              <span>{new Date(flow.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="inline" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn teal" onClick={() => openFlow(flow.id)}>Open builder</button>
              <button className="btn danger" onClick={() => deleteFlow(flow.id, flow.name)}><Trash2 size={14} />Delete</button>
            </div>
          </div>
        ))}
        {flows.length === 0 ? <div className="panel muted" style={{ padding: 20 }}>No call flows found.</div> : null}
      </div>
    </div>
  );
}
