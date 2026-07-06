import { describe, expect, it } from "vitest";
import { sampleGraph } from "../src/data.js";
import { validateFlow } from "../src/modules/flows/validation.js";

describe("validateFlow", () => {
  it("accepts the seeded support flow", () => {
    const result = validateFlow(sampleGraph);
    expect(result.valid).toBe(true);
  });

  it("rejects missing required voice bot fields", () => {
    const graph = structuredClone(sampleGraph);
    const voiceNode = graph.nodes.find((node) => node.id === "voicebot");
    if (voiceNode) voiceNode.data.promptId = "";
    const result = validateFlow(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("promptId");
  });
});
