export type Role = "SUPER_ADMIN" | "ADMIN" | "FLOW_DESIGNER" | "OPERATOR" | "VIEWER";

export type FlowNodeType =
  | "start"
  | "voiceBot"
  | "ivrMenu"
  | "dtmfInput"
  | "condition"
  | "transfer"
  | "webhook"
  | "setVariable"
  | "fallback"
  | "hangup"
  | "log"
  | "businessHours"
  | "queueCheck";

export interface User {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderConfig {
  id: string;
  organizationId: string;
  name: string;
  type: "OPENAI" | "GEMINI" | "CLAUDE" | "CUSTOM" | "MOCK";
  baseUrl?: string;
  encryptedApiKey?: string;
  defaultModel?: string;
  configJson: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DialogflowConfig {
  id: string;
  organizationId: string;
  name: string;
  projectId: string;
  location: string;
  agentId: string;
  languageCode: string;
  voiceName: string;
  encryptedServiceAccountJson?: string;
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelephonyConnection {
  id: string;
  organizationId: string;
  name: string;
  type: "ARI" | "SIP";
  host: string;
  port: number;
  transport: "UDP" | "TCP" | "TLS" | "WS" | "WSS";
  ariUrl?: string;
  username: string;
  encryptedPassword?: string;
  extension: string;
  appName?: string;
  flowId?: string;
  isActive: boolean;
  status: "not-tested" | "configured" | "connected" | "registered" | "registration-failed" | "connection-failed";
  lastRegistrationMessage?: string;
  registeredAt?: string;
  updatedAt: string;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  organizationId: string;
  name: string;
  systemPrompt: string;
  fallbackPrompt: string;
  language: string;
  version: number;
  isActive: boolean;
  knowledgeBaseIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  sourceRef?: string;
  createdAt: string;
}

export interface KnowledgeBase {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  sourceType: "TEXT" | "FILE" | "DATABASE" | "WEBSITE";
  sourceConfig: Record<string, unknown>;
  chunks: KnowledgeChunk[];
  status: "empty" | "ready" | "failed";
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ValidationIssue {
  nodeId?: string;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  nodeIssues: ValidationIssue[];
}

export interface CallFlow {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  activeVersionId?: string;
  graphJson: FlowGraph;
  validationJson?: ValidationResult;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallExecutionLog {
  id: string;
  organizationId: string;
  callSessionId: string;
  sequence: number;
  nodeId: string;
  nodeType: FlowNodeType;
  eventType: string;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  latencyMs: number;
  status: "OK" | "ERROR" | "BRANCH" | "END";
  errorMessage?: string;
  correlationId: string;
  createdAt: string;
}

export interface Transcript {
  id: string;
  organizationId: string;
  callSessionId: string;
  speaker: "caller" | "bot" | "system";
  text: string;
  confidence?: number;
  audioRef?: string;
  createdAt: string;
}

export interface ProviderRequestLog {
  id: string;
  organizationId: string;
  callSessionId: string;
  providerId?: string;
  model: string;
  requestJsonMasked: Record<string, unknown>;
  responseJson: Record<string, unknown>;
  latencyMs: number;
  status: "OK" | "ERROR";
  errorMessage?: string;
  createdAt: string;
}

export interface CallSession {
  id: string;
  organizationId: string;
  callId: string;
  channelId: string;
  callerNumber: string;
  calledNumber: string;
  flowVersionId?: string;
  status: "ACTIVE" | "COMPLETED" | "FAILED";
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  finalResult?: string;
  failureReason?: string;
  metadataJson: Record<string, unknown>;
}
