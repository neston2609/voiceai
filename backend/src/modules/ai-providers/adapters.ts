import type { AiProviderConfig } from "../../types.js";
import { decryptSecret } from "../../common/crypto/encryption.js";

export type StandardAiProviderType = "OPENAI" | "GEMINI" | "CLAUDE";

export const STANDARD_AI_BASE_URLS: Record<StandardAiProviderType, string> = {
  OPENAI: "https://api.openai.com/v1",
  GEMINI: "https://generativelanguage.googleapis.com/v1beta",
  CLAUDE: "https://api.anthropic.com/v1"
};

export type AiModelOption = {
  id: string;
  label: string;
};

export interface AiChatProvider {
  generateResponse(input: {
    systemPrompt: string;
    userText: string;
    conversationHistory: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    model: string;
    temperature?: number;
    maxTokens?: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ text: string; rawResponse: unknown; usage?: unknown; latencyMs: number }>;
}

export class MockAiProviderAdapter implements AiChatProvider {
  async generateResponse(input: Parameters<AiChatProvider["generateResponse"]>[0]) {
    const started = Date.now();
    const mentionsAgent = /agent|human|operator|sales/i.test(input.userText);
    const text = mentionsAgent
      ? "I can connect you to a specialist now."
      : "I can help with that. I found the order status intent and can continue in self-service.";
    return {
      text,
      rawResponse: { provider: "mock", intent: mentionsAgent ? "transfer_agent" : "order_status", confidence: mentionsAgent ? 0.92 : 0.71 },
      usage: { inputTokens: 120, outputTokens: 24 },
      latencyMs: Date.now() - started + 180
    };
  }
}

type ProviderRuntimeConfig = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs: number;
};

function getNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function postJson(url: string, init: RequestInit, timeoutMs: number) {
  return requestJson(url, init, timeoutMs);
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = typeof json === "object" && json && "error" in json ? JSON.stringify((json as { error: unknown }).error) : text;
      throw new Error(`Provider returned HTTP ${response.status}: ${message}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export function getAiProviderBaseUrl(type: AiProviderConfig["type"], baseUrl?: string) {
  if (type === "OPENAI" || type === "GEMINI" || type === "CLAUDE") {
    return STANDARD_AI_BASE_URLS[type];
  }
  return baseUrl;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function getProviderApiKey(config: AiProviderConfig, overrideApiKey?: string) {
  if (overrideApiKey && overrideApiKey !== "********") return overrideApiKey;
  return config.encryptedApiKey ? decryptSecret(config.encryptedApiKey) : undefined;
}

abstract class BaseHttpAiProviderAdapter implements AiChatProvider {
  protected readonly runtime: ProviderRuntimeConfig;

  constructor(protected readonly config: AiProviderConfig) {
    this.runtime = {
      apiKey: config.encryptedApiKey ? decryptSecret(config.encryptedApiKey) : undefined,
      baseUrl: getAiProviderBaseUrl(config.type, config.baseUrl),
      timeoutMs: getNumber(config.configJson.timeoutMs, 8000)
    };
  }

  abstract generateResponse(input: Parameters<AiChatProvider["generateResponse"]>[0]): ReturnType<AiChatProvider["generateResponse"]>;

  protected requireApiKey() {
    if (!this.runtime.apiKey) {
      throw new Error(`${this.config.name} API key is not configured`);
    }
    return this.runtime.apiKey;
  }
}

export class OpenAiProviderAdapter extends BaseHttpAiProviderAdapter {
  async generateResponse(input: Parameters<AiChatProvider["generateResponse"]>[0]) {
    const started = Date.now();
    const apiKey = this.requireApiKey();
    const baseUrl = normalizeBaseUrl(this.runtime.baseUrl ?? STANDARD_AI_BASE_URLS.OPENAI);
    const json = await postJson(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            ...input.conversationHistory,
            { role: "user", content: input.userText }
          ],
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxTokens ?? 300
        })
      },
      this.runtime.timeoutMs
    ) as { choices?: Array<{ message?: { content?: string } }>; usage?: unknown };
    return {
      text: json.choices?.[0]?.message?.content?.trim() || "ไม่มีคำตอบจาก AI provider",
      rawResponse: json,
      usage: json.usage,
      latencyMs: Date.now() - started
    };
  }
}

export class GeminiProviderAdapter extends BaseHttpAiProviderAdapter {
  async generateResponse(input: Parameters<AiChatProvider["generateResponse"]>[0]) {
    const started = Date.now();
    const apiKey = this.requireApiKey();
    const baseUrl = normalizeBaseUrl(this.runtime.baseUrl ?? STANDARD_AI_BASE_URLS.GEMINI);
    const model = input.model.replace(/^models\//, "");
    const json = await postJson(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: input.userText }] }],
          generationConfig: {
            temperature: input.temperature ?? 0.4,
            maxOutputTokens: input.maxTokens ?? 300
          }
        })
      },
      this.runtime.timeoutMs
    ) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: unknown };
    return {
      text: json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() || "ไม่มีคำตอบจาก AI provider",
      rawResponse: json,
      usage: json.usageMetadata,
      latencyMs: Date.now() - started
    };
  }
}

export class ClaudeProviderAdapter extends BaseHttpAiProviderAdapter {
  async generateResponse(input: Parameters<AiChatProvider["generateResponse"]>[0]) {
    const started = Date.now();
    const apiKey = this.requireApiKey();
    const baseUrl = normalizeBaseUrl(this.runtime.baseUrl ?? STANDARD_AI_BASE_URLS.CLAUDE);
    const json = await postJson(
      `${baseUrl}/messages`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: input.model,
          system: input.systemPrompt,
          messages: [{ role: "user", content: input.userText }],
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxTokens ?? 300
        })
      },
      this.runtime.timeoutMs
    ) as { content?: Array<{ text?: string }>; usage?: unknown };
    return {
      text: json.content?.map((item) => item.text ?? "").join("").trim() || "ไม่มีคำตอบจาก AI provider",
      rawResponse: json,
      usage: json.usage,
      latencyMs: Date.now() - started
    };
  }
}

export class CustomHttpProviderAdapter extends BaseHttpAiProviderAdapter {
  async generateResponse(input: Parameters<AiChatProvider["generateResponse"]>[0]) {
    const started = Date.now();
    if (!this.runtime.baseUrl) throw new Error("Custom provider base URL is not configured");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.runtime.apiKey) headers.Authorization = `Bearer ${this.runtime.apiKey}`;
    const json = await postJson(
      this.runtime.baseUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: input.model,
          systemPrompt: input.systemPrompt,
          userText: input.userText,
          conversationHistory: input.conversationHistory,
          temperature: input.temperature ?? 0.4,
          maxTokens: input.maxTokens ?? 300,
          metadata: input.metadata
        })
      },
      this.runtime.timeoutMs
    ) as { text?: string; response?: string; answer?: string; usage?: unknown };
    return {
      text: json.text ?? json.response ?? json.answer ?? "ไม่มีคำตอบจาก custom AI provider",
      rawResponse: json,
      usage: json.usage,
      latencyMs: Date.now() - started
    };
  }
}

export async function listAiProviderModels(config: AiProviderConfig, overrideApiKey?: string): Promise<AiModelOption[]> {
  const apiKey = getProviderApiKey(config, overrideApiKey);
  const timeoutMs = getNumber(config.configJson.timeoutMs, 8000);

  if (config.type === "CUSTOM") {
    throw new Error("Custom provider models must be entered manually because custom APIs do not share one standard model-list endpoint.");
  }
  if (config.type === "MOCK") {
    throw new Error("Mock providers do not expose live model lists.");
  }
  if (!apiKey) {
    throw new Error(`${config.name} API key is not configured`);
  }

  if (config.type === "OPENAI") {
    const json = await requestJson(
      `${STANDARD_AI_BASE_URLS.OPENAI}/models`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json"
        }
      },
      timeoutMs
    ) as { data?: Array<{ id?: string }> };
    return (json.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => Boolean(id))
      .sort()
      .map((id) => ({ id, label: id }));
  }

  if (config.type === "GEMINI") {
    const json = await requestJson(
      `${STANDARD_AI_BASE_URLS.GEMINI}/models?key=${encodeURIComponent(apiKey)}`,
      { method: "GET", headers: { Accept: "application/json" } },
      timeoutMs
    ) as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> };
    return (json.models ?? [])
      .filter((model) => model.name && (model.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((model) => {
        const id = String(model.name).replace(/^models\//, "");
        return { id, label: model.displayName ? `${model.displayName} (${id})` : id };
      })
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  const json = await requestJson(
    `${STANDARD_AI_BASE_URLS.CLAUDE}/models`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        Accept: "application/json"
      }
    },
    timeoutMs
  ) as { data?: Array<{ id?: string; display_name?: string }> };
  return (json.data ?? [])
    .map((model) => model.id ? { id: model.id, label: model.display_name ? `${model.display_name} (${model.id})` : model.id } : null)
    .filter((model): model is AiModelOption => Boolean(model))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function createAiProviderAdapter(config: AiProviderConfig): AiChatProvider {
  if (config.type === "OPENAI") return new OpenAiProviderAdapter(config);
  if (config.type === "GEMINI") return new GeminiProviderAdapter(config);
  if (config.type === "CLAUDE") return new ClaudeProviderAdapter(config);
  if (config.type === "CUSTOM") return new CustomHttpProviderAdapter(config);
  return new MockAiProviderAdapter();
}
