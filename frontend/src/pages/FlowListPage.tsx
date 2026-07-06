import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { useAppStore } from "../store/appStore";
import type { CallFlow } from "../types/domain";

export function FlowListPage() {
  const setScreen = useAppStore((state) => state.setScreen);
  const { data: flows = [] } = useQuery({ queryKey: ["flows"], queryFn: async () => (await api.get<CallFlow[]>("/flows")).data });
  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div className="subtle" style={{ fontSize: 12.5 }}>Draft, published, and archived call flows</div>
        <button className="btn primary" onClick={() => setScreen("builder")}>New flow</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {flows.map((flow) => (
          <button key={flow.id} className="panel" onClick={() => setScreen("builder")} style={{ padding: 17, textAlign: "left" }}>
            <div className="row-between">
              <div style={{ fontWeight: 600, fontSize: 14 }}>{flow.name}</div>
              <Badge tone={flow.status === "PUBLISHED" ? "green" : flow.status === "DRAFT" ? "amber" : "gray"}>{flow.status}</Badge>
            </div>
            <div className="muted" style={{ fontSize: 11.5, margin: "9px 0 14px" }}>{flow.description}</div>
            <div className="row-between muted" style={{ borderTop: "1px solid var(--border2)", paddingTop: 11, fontSize: 11 }}>
              <span>{flow.graphJson.nodes.length} nodes</span>
              <span>{flow.activeVersionId ?? "draft"}</span>
              <span>{new Date(flow.updatedAt).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
        {flows.length === 0 ? <div className="panel muted" style={{ padding: 20 }}>No call flows found.</div> : null}
      </div>
    </div>
  );
}
