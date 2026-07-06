import type { FlowGraph, FlowNode, ValidationResult } from "../../types.js";

const terminalTypes = new Set(["hangup", "transfer"]);

export function validateFlow(graph: FlowGraph): ValidationResult {
  const issues: ValidationResult["nodeIssues"] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const startNodes = graph.nodes.filter((node) => node.type === "start");

  const addError = (message: string, node?: FlowNode, code = "FLOW_INVALID") => {
    errors.push(message);
    issues.push({ nodeId: node?.id, severity: "error", code, message });
  };
  const addWarning = (message: string, node?: FlowNode, code = "FLOW_WARNING") => {
    warnings.push(message);
    issues.push({ nodeId: node?.id, severity: "warning", code, message });
  };

  if (startNodes.length !== 1) addError("Flow must contain exactly one Start node", startNodes[0], "START_COUNT");

  for (const edge of graph.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      addError(`Dangling edge ${edge.id} references a missing node`, undefined, "DANGLING_EDGE");
    }
  }

  for (const node of graph.nodes) {
    if (node.type === "voiceBot") {
      for (const field of ["aiProviderId", "model", "promptId", "dialogflowConfigId"]) {
        if (!node.data[field]) addError(`Voice Bot node requires ${field}`, node, "VOICEBOT_REQUIRED");
      }
    }
    if (node.type === "ivrMenu") {
      const digits = node.data.allowedDigits;
      const hasDigitRoute = Array.isArray(digits) && digits.length > 0 && graph.edges.some((edge) => edge.source === node.id);
      if (!hasDigitRoute) addError("IVR node must have at least one valid digit route", node, "IVR_ROUTE_REQUIRED");
    }
    if (node.type === "transfer" && !node.data.destination) addError("Transfer node must have a destination", node, "TRANSFER_DESTINATION");
    if (node.type === "webhook") {
      try {
        new URL(String(node.data.url ?? ""));
      } catch {
        addError("Webhook node must have a valid URL", node, "WEBHOOK_URL");
      }
    }
    if (node.type === "condition" && !node.data.expression) addError("Condition node must define at least one condition", node, "CONDITION_REQUIRED");
    if (node.type === "hangup" && graph.edges.some((edge) => edge.source === node.id)) addError("Hangup node must be terminal", node, "HANGUP_TERMINAL");
  }

  if (startNodes.length === 1) {
    const reachable = new Set<string>();
    const queue = [startNodes[0].id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || reachable.has(current)) continue;
      reachable.add(current);
      graph.edges.filter((edge) => edge.source === current).forEach((edge) => queue.push(edge.target));
    }
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) addError(`Node ${node.label} is not reachable from Start`, node, "UNREACHABLE_NODE");
    }
  }

  const hasTerminalPath = graph.nodes.some((node) => terminalTypes.has(node.type));
  if (!hasTerminalPath) addError("Flow must have at least one terminal Transfer or Hangup path", undefined, "TERMINAL_PATH");

  const edgeCounts = new Map<string, number>();
  graph.edges.forEach((edge) => edgeCounts.set(edge.source, (edgeCounts.get(edge.source) ?? 0) + 1));
  for (const node of graph.nodes) {
    if (!terminalTypes.has(node.type) && (edgeCounts.get(node.id) ?? 0) === 0) {
      addWarning(`Node ${node.label} has no outgoing route`, node, "NO_OUTGOING_ROUTE");
    }
  }

  return { valid: errors.length === 0, errors, warnings, nodeIssues: issues };
}
