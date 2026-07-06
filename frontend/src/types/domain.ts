export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: string;
  mustChangePassword: boolean;
}

export interface FlowNodeData {
  label?: string;
  [key: string]: unknown;
}

export interface CallFlow {
  id: string;
  name: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  activeVersionId?: string;
  createdAt?: string;
  updatedAt: string;
  graphJson: {
    nodes: Array<{ id: string; type: string; label: string; data: Record<string, unknown> }>;
    edges: Array<{ id: string; source: string; target: string; label?: string }>;
  };
}

export interface CallSession {
  id: string;
  callerNumber: string;
  calledNumber: string;
  status: string;
  finalResult?: string;
  durationSeconds?: number;
  startedAt: string;
}

export interface ExecutionLog {
  id: string;
  sequence: number;
  nodeId: string;
  nodeType: string;
  eventType: string;
  outputJson: Record<string, unknown>;
  latencyMs: number;
  status: string;
  createdAt: string;
}
