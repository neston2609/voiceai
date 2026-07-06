import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { createStore, defaultOrgId, persistAiProviders, persistAsteriskConfigs, persistDialogflowConfigs, sampleGraph } from "./data.js";
import { decryptSecret, encryptSecret, maskSecret } from "./common/crypto/encryption.js";
import { logger } from "./common/logger/logger.js";
import { createAiProviderAdapter } from "./modules/ai-providers/adapters.js";
import { changePassword, login, publicUser } from "./modules/auth/auth.service.js";
import { validateFlow } from "./modules/flows/validation.js";
import { simulateCall } from "./modules/runtime/runtime.service.js";
import { GoogleDialogflowVoiceProvider, parseServiceAccountJson } from "./modules/voice/providers.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const store = await createStore();
const isMockMode = () => process.env.MOCK_MODE === "true";

app.use(helmet());
const allowedOrigins = new Set([process.env.FRONTEND_URL ?? "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5173"]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? uuid();
  res.setHeader("x-correlation-id", correlationId);
  (req as express.Request & { correlationId: string }).correlationId = correlationId;
  next();
});

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET ?? "development-access-secret") as { sub: string };
    const user = store.users.find((item) => item.id === payload.sub);
    if (!user) return res.status(401).json({ message: "Invalid token" });
    (req as express.Request & { userId: string }).userId = user.id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

app.get("/api/system/health", (_req, res) => {
  res.json({
    status: "ok",
    mockMode: isMockMode(),
    services: {
      api: "ok",
      aiProvider: store.aiProviders.some((provider) => provider.isActive && provider.type !== "MOCK" && provider.encryptedApiKey) ? "configured" : "missing-credential",
      dialogflow: store.dialogflowConfigs.some((config) => config.isActive && config.encryptedServiceAccountJson) ? "configured" : "missing-credential",
      asterisk: store.asteriskConfigs[0]?.status ?? "not-tested"
    }
  });
});

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const body = z.object({ email: z.string().min(3), password: z.string().min(1) }).parse(req.body);
    const result = await login(store, body.email, body.password);
    res.json(result);
  })
);

app.post(
  "/api/auth/change-password",
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = z.object({ currentPassword: z.string(), newPassword: z.string() }).parse(req.body);
    const result = await changePassword(store, (req as express.Request & { userId: string }).userId, body.currentPassword, body.newPassword);
    res.json(result);
  })
);

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = store.users.find((item) => item.id === (req as express.Request & { userId: string }).userId);
  res.json({ user: user ? publicUser(user) : null });
});

app.post("/api/auth/logout", (_req, res) => res.json({ ok: true }));
app.post("/api/auth/refresh", (_req, res) => res.status(501).json({ message: "Refresh token rotation is prepared for database persistence." }));

app.get("/api/dashboard/summary", requireAuth, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const sessionsToday = store.sessions.filter((session) => session.startedAt.startsWith(today));
  const completed = sessionsToday.filter((session) => session.status === "COMPLETED");
  const escalated = sessionsToday.filter((session) => session.finalResult === "Escalated");
  const failed = sessionsToday.filter((session) => session.status === "FAILED");
  const botResolved = sessionsToday.filter((session) => session.finalResult === "Bot resolved");
  const avgDuration = completed.length
    ? Math.round(completed.reduce((total, session) => total + (session.durationSeconds ?? 0), 0) / completed.length)
    : 0;
  const providerLogs = store.providerLogs.filter((log) => store.sessions.some((session) => session.id === log.callSessionId && session.startedAt.startsWith(today)));
  const avgAiResponse = providerLogs.length
    ? Math.round(providerLogs.reduce((total, log) => total + log.latencyMs, 0) / providerLogs.length)
    : 0;
  const transcriptConfidence = store.transcripts
    .filter((item) => item.speaker === "caller" && typeof item.confidence === "number")
    .map((item) => item.confidence ?? 0);
  const avgSttConfidence = transcriptConfidence.length
    ? Number((transcriptConfidence.reduce((total, value) => total + value, 0) / transcriptConfidence.length).toFixed(2))
    : 0;
  res.json({
    totalCallsToday: sessionsToday.length,
    activeCalls: sessionsToday.filter((session) => session.status === "ACTIVE").length,
    botResolvedRate: sessionsToday.length ? Math.round((botResolved.length / sessionsToday.length) * 100) : 0,
    escalatedCalls: escalated.length,
    failedCalls: failed.length,
    averageDurationSeconds: avgDuration,
    averageAiResponseMs: avgAiResponse,
    averageSttConfidence: avgSttConfidence,
    topFallbackReasons: [],
    providerHealth: {
      ai: store.aiProviders.some((provider) => provider.isActive && provider.type !== "MOCK" && provider.encryptedApiKey) ? "configured" : "missing-credential",
      dialogflow: store.dialogflowConfigs.some((config) => config.isActive && config.encryptedServiceAccountJson) ? "configured" : "missing-credential",
      asterisk: store.asteriskConfigs[0]?.status ?? "not-tested"
    },
    latestSessions: store.sessions.slice(0, 8)
  });
});

app.get("/api/dashboard/charts", requireAuth, (_req, res) => {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const sessions = store.sessions.filter((session) => session.startedAt.startsWith(key));
    return {
      day: dayNames[date.getDay()],
      resolved: sessions.filter((session) => session.finalResult === "Bot resolved").length,
      escalated: sessions.filter((session) => session.finalResult === "Escalated").length,
      failed: sessions.filter((session) => session.status === "FAILED").length
    };
  });
  res.json({
    callResults: days
  });
});

function publicAiProvider(provider: (typeof store.aiProviders)[number]) {
  return {
    ...provider,
    hasApiKey: Boolean(provider.encryptedApiKey),
    encryptedApiKey: provider.encryptedApiKey ? maskSecret(provider.encryptedApiKey) : null
  };
}

const aiProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["OPENAI", "GEMINI", "CLAUDE", "CUSTOM"]),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1),
  configJson: z.record(z.unknown()).default({}),
  isActive: z.boolean().optional()
});

app.get("/api/ai-providers", requireAuth, (_req, res) => {
  res.json(store.aiProviders.map(publicAiProvider));
});

app.post(
  "/api/ai-providers",
  requireAuth,
  asyncRoute(async (req, res) => {
  const body = aiProviderSchema.parse(req.body);
  const provider = {
    id: `prov_${uuid().slice(0, 8)}`,
    organizationId: defaultOrgId,
    name: body.name,
    type: body.type,
    baseUrl: body.baseUrl,
    encryptedApiKey: body.apiKey ? encryptSecret(body.apiKey) : undefined,
    defaultModel: body.defaultModel,
    configJson: body.configJson,
    isActive: body.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.aiProviders.push(provider);
  store.auditLogs.push({ id: uuid(), organizationId: defaultOrgId, action: "ai_provider.create", entityType: "AiProvider", entityId: provider.id, createdAt: new Date().toISOString() });
    await persistAiProviders(store.aiProviders);
    res.status(201).json(publicAiProvider(provider));
  })
);

app.patch(
  "/api/ai-providers/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = aiProviderSchema.partial().parse(req.body);
    const provider = store.aiProviders.find((item) => item.id === req.params.id);
    if (!provider) return res.status(404).json({ message: "AI provider not found" });
    if (body.name !== undefined) provider.name = body.name;
    if (body.type !== undefined) provider.type = body.type;
    if (body.baseUrl !== undefined) provider.baseUrl = body.baseUrl;
    if (body.defaultModel !== undefined) provider.defaultModel = body.defaultModel;
    if (body.configJson !== undefined) provider.configJson = body.configJson;
    if (body.isActive !== undefined) provider.isActive = body.isActive;
    if (body.apiKey && body.apiKey !== "********") provider.encryptedApiKey = encryptSecret(body.apiKey);
    provider.updatedAt = new Date().toISOString();
    store.auditLogs.push({
      id: uuid(),
      organizationId: defaultOrgId,
      userId: (req as express.Request & { userId: string }).userId,
      action: "ai_provider.update",
      entityType: "AiProvider",
      entityId: provider.id,
      afterJson: { ...publicAiProvider(provider), apiKey: "***masked***" },
      correlationId: (req as express.Request & { correlationId: string }).correlationId,
      createdAt: new Date().toISOString()
    });
    await persistAiProviders(store.aiProviders);
    res.json(publicAiProvider(provider));
  })
);

app.post(
  "/api/ai-providers/:id/test",
  requireAuth,
  asyncRoute(async (req, res) => {
    const provider = store.aiProviders.find((item) => item.id === req.params.id);
    if (!provider) return res.status(404).json({ message: "AI provider not found" });
    const temperature = typeof provider.configJson.temperature === "number" ? provider.configJson.temperature : 0.4;
    const maxTokens = typeof provider.configJson.maxTokens === "number" ? provider.configJson.maxTokens : 300;
    try {
      const response = await createAiProviderAdapter(provider).generateResponse({
        systemPrompt: "ตอบภาษาไทยอย่างสุภาพและกระชับสำหรับระบบ voice bot",
        userText: "ทดสอบการเชื่อมต่อ AI provider",
        conversationHistory: [],
        model: provider.defaultModel,
        temperature,
        maxTokens
      });
      res.json({
        ok: true,
        mode: provider.type === "MOCK" ? "mock" : "live",
        latencyMs: response.latencyMs,
        providerId: provider.id,
        model: provider.defaultModel,
        message: provider.type === "MOCK" ? "Development provider generated a test response." : "AI provider generated a live test response.",
        sample: response.text
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI provider test failed";
      res.status(502).json({ ok: false, mode: "live", providerId: provider.id, message });
    }
  })
);

app.get("/api/prompts", requireAuth, (_req, res) => res.json(store.prompts));
app.post("/api/prompts/:id/test", requireAuth, (req, res) => res.json({ ok: true, promptId: req.params.id, response: "Prompt response is ready for a live caller." }));

app.get("/api/flows", requireAuth, (_req, res) => res.json(store.flows));
app.post("/api/flows", requireAuth, (req, res) => {
  const body = z.object({ name: z.string(), description: z.string().optional(), graphJson: z.any().default(sampleGraph) }).parse(req.body);
  const flow = {
    id: `flow_${uuid().slice(0, 8)}`,
    organizationId: defaultOrgId,
    name: body.name,
    description: body.description ?? "",
    status: "DRAFT" as const,
    graphJson: body.graphJson,
    createdBy: (req as express.Request & { userId: string }).userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.flows.push(flow);
  res.status(201).json(flow);
});
app.get("/api/flows/:id", requireAuth, (req, res) => {
  const flow = store.flows.find((item) => item.id === req.params.id);
  if (!flow) return res.status(404).json({ message: "Flow not found" });
  res.json(flow);
});
app.post("/api/flows/:id/validate", requireAuth, (req, res) => {
  const flow = store.flows.find((item) => item.id === req.params.id);
  const graph = req.body?.graphJson ?? flow?.graphJson;
  const result = validateFlow(graph);
  if (flow) flow.validationJson = result;
  res.json(result);
});
app.post("/api/flows/:id/publish", requireAuth, (req, res) => {
  const flow = store.flows.find((item) => item.id === req.params.id);
  if (!flow) return res.status(404).json({ message: "Flow not found" });
  const result = validateFlow(req.body?.graphJson ?? flow.graphJson);
  if (!result.valid) return res.status(400).json(result);
  flow.status = "PUBLISHED";
  flow.activeVersionId = flow.activeVersionId ?? `flowver_${uuid().slice(0, 8)}`;
  flow.validationJson = result;
  flow.updatedAt = new Date().toISOString();
  res.json(flow);
});

app.post(
  "/api/runtime/simulate-call",
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = z
      .object({
        flowId: z.string(),
        callerNumber: z.string(),
        calledNumber: z.string(),
        utterance: z.string(),
        dtmf: z.string().optional()
      })
      .parse(req.body);
    const result = await simulateCall(store, body, (req as express.Request & { correlationId: string }).correlationId);
    res.status(201).json(result);
  })
);

app.get("/api/call-sessions", requireAuth, (_req, res) => res.json(store.sessions));
app.get("/api/call-sessions/:id", requireAuth, (req, res) => {
  const session = store.sessions.find((item) => item.id === req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });
  res.json(session);
});
app.get("/api/call-sessions/:id/logs", requireAuth, (req, res) => res.json(store.executionLogs.filter((log) => log.callSessionId === req.params.id)));
app.get("/api/call-sessions/:id/transcript", requireAuth, (req, res) => res.json(store.transcripts.filter((item) => item.callSessionId === req.params.id)));
app.get("/api/call-sessions/:id/provider-requests", requireAuth, (req, res) => res.json(store.providerLogs.filter((item) => item.callSessionId === req.params.id)));

app.get("/api/users", requireAuth, (_req, res) => res.json(store.users.map(publicUser)));
app.get("/api/audit-logs", requireAuth, (_req, res) => res.json(store.auditLogs));

function publicDialogflowConfig(config: (typeof store.dialogflowConfigs)[number]) {
  return {
    ...config,
    hasServiceAccount: Boolean(config.encryptedServiceAccountJson),
    encryptedServiceAccountJson: undefined
  };
}

const dialogflowSchema = z.object({
  name: z.string().min(1).optional(),
  projectId: z.string().optional(),
  location: z.string().min(1).optional(),
  agentId: z.string().optional(),
  languageCode: z.string().min(2).optional(),
  voiceName: z.string().optional(),
  isActive: z.boolean().optional()
});

app.get("/api/dialogflow-configs", requireAuth, (_req, res) => res.json(store.dialogflowConfigs.map(publicDialogflowConfig)));

app.patch(
  "/api/dialogflow-configs/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = dialogflowSchema.parse(req.body);
    const config = store.dialogflowConfigs.find((item) => item.id === req.params.id);
    if (!config) return res.status(404).json({ message: "Dialogflow config not found" });
    if (body.name !== undefined) config.name = body.name;
    if (body.projectId !== undefined) config.projectId = body.projectId;
    if (body.location !== undefined) config.location = body.location;
    if (body.agentId !== undefined) config.agentId = body.agentId;
    if (body.languageCode !== undefined) config.languageCode = body.languageCode;
    if (body.voiceName !== undefined) config.voiceName = body.voiceName;
    if (body.isActive !== undefined) config.isActive = body.isActive;
    config.status = config.encryptedServiceAccountJson ? "configured" : "missing-credential";
    config.updatedAt = new Date().toISOString();
    await persistDialogflowConfigs(store.dialogflowConfigs);
    res.json(publicDialogflowConfig(config));
  })
);

app.post(
  "/api/dialogflow-configs/:id/upload-service-account",
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = z.object({ serviceAccountJson: z.string().min(10) }).parse(req.body);
    const config = store.dialogflowConfigs.find((item) => item.id === req.params.id);
    if (!config) return res.status(404).json({ message: "Dialogflow config not found" });
    const account = parseServiceAccountJson(body.serviceAccountJson);
    config.encryptedServiceAccountJson = encryptSecret(body.serviceAccountJson);
    config.projectId = config.projectId || account.project_id;
    config.status = "credential-uploaded";
    config.updatedAt = new Date().toISOString();
    store.auditLogs.push({
      id: uuid(),
      organizationId: defaultOrgId,
      userId: (req as express.Request & { userId: string }).userId,
      action: "dialogflow_config.upload_service_account",
      entityType: "DialogflowConfig",
      entityId: config.id,
      afterJson: { ...publicDialogflowConfig(config), serviceAccount: "***masked***" },
      correlationId: (req as express.Request & { correlationId: string }).correlationId,
      createdAt: new Date().toISOString()
    });
    await persistDialogflowConfigs(store.dialogflowConfigs);
    res.json(publicDialogflowConfig(config));
  })
);

app.post(
  "/api/dialogflow-configs/:id/test",
  requireAuth,
  asyncRoute(async (req, res) => {
    const config = store.dialogflowConfigs.find((item) => item.id === req.params.id);
    if (!config) return res.status(404).json({ message: "Dialogflow config not found" });
    const started = Date.now();
    try {
      const provider = new GoogleDialogflowVoiceProvider(config);
      await provider.getAccessToken();
      let detectIntent: string = "not-tested";
      if (config.projectId && config.agentId) {
        const intent = await provider.detectIntent({ text: "สวัสดี", sessionId: `test-${uuid()}`, languageCode: config.languageCode || "th-TH" });
        detectIntent = intent.intentName || "no-intent";
      }
      await provider.synthesizeSpeech({ text: "สวัสดีค่ะ", languageCode: config.languageCode || "th-TH", voiceName: config.voiceName || "th-TH-Standard-A" });
      config.status = "connected";
      config.updatedAt = new Date().toISOString();
      await persistDialogflowConfigs(store.dialogflowConfigs);
      res.json({
        ok: true,
        mode: "live",
        stt: "credential-ready",
        tts: "ready",
        detectIntent,
        latencyMs: Date.now() - started,
        message: "Google credential, Dialogflow CX, and Thai TTS test completed."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dialogflow test failed";
      config.status = "connection-failed";
      config.updatedAt = new Date().toISOString();
      await persistDialogflowConfigs(store.dialogflowConfigs);
      res.status(502).json({ ok: false, mode: "live", message, latencyMs: Date.now() - started });
    }
  })
);

function publicAsteriskConfig(config: (typeof store.asteriskConfigs)[number]) {
  return {
    ...config,
    password: config.encryptedPassword ? "********" : "",
    encryptedPassword: undefined
  };
}

app.get("/api/asterisk-configs", requireAuth, (_req, res) => res.json(store.asteriskConfigs.map(publicAsteriskConfig)));

app.patch(
  "/api/asterisk-configs/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      ariUrl: z.string().url(),
      username: z.string().min(1),
      password: z.string().optional(),
      appName: z.string().min(1),
      botExtension: z.string().min(1)
    })
    .parse(req.body);
  const config = store.asteriskConfigs.find((item) => item.id === req.params.id);
  if (!config) return res.status(404).json({ message: "Asterisk config not found" });
  config.name = body.name;
  config.ariUrl = body.ariUrl;
  config.username = body.username;
  if (body.password && body.password !== "********") {
    config.encryptedPassword = encryptSecret(body.password);
  }
  config.appName = body.appName;
  config.botExtension = body.botExtension;
  config.status = "configured";
  config.updatedAt = new Date().toISOString();
  store.auditLogs.push({
    id: uuid(),
    organizationId: defaultOrgId,
    userId: (req as express.Request & { userId: string }).userId,
    action: "asterisk_config.update",
    entityType: "AsteriskConfig",
    entityId: config.id,
    afterJson: { ...publicAsteriskConfig(config), password: "***masked***" },
    correlationId: (req as express.Request & { correlationId: string }).correlationId,
    createdAt: new Date().toISOString()
  });
    await persistAsteriskConfigs(store.asteriskConfigs);
    res.json(publicAsteriskConfig(config));
  })
);

async function testAriConnection(config: (typeof store.asteriskConfigs)[number]) {
  if (!config.encryptedPassword) {
    throw new Error("ARI password is not configured");
  }
  const url = new URL(`${config.ariUrl.replace(/\/+$/, "")}/asterisk/info`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.username}:${decryptSecret(config.encryptedPassword)}`).toString("base64")}`,
        Accept: "application/json"
      },
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        message: `ARI returned HTTP ${response.status} from ${config.ariUrl}. Check ARI user/password and ari.conf permissions.`
      };
    }
    return {
      ok: true,
      httpStatus: response.status,
      message: `Connected to FreePBX ARI at ${config.ariUrl} for extension ${config.botExtension}.`,
      info: text ? JSON.parse(text) : {}
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `Timed out connecting to ${config.ariUrl}. Check that Asterisk HTTP/ARI is enabled and reachable.`
      : `Could not connect to ${config.ariUrl}. Check FreePBX IP, port 8088, firewall, and ARI service.`;
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}

app.post(
  "/api/asterisk-configs/:id/test",
  requireAuth,
  asyncRoute(async (req, res) => {
  const config = store.asteriskConfigs.find((item) => item.id === req.params.id);
  if (!config) return res.status(404).json({ message: "Asterisk config not found" });
    const result = await testAriConnection(config);
    config.status = result.ok ? "connected" : "connection-failed";
    config.updatedAt = new Date().toISOString();
    await persistAsteriskConfigs(store.asteriskConfigs);
    res.status(result.ok ? 200 : 502).json({
      ...result,
      mode: "live",
      ariUrl: config.ariUrl,
      username: config.username,
      botExtension: config.botExtension
    });
  })
);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected error";
  logger.warn({ err, correlationId: (req as express.Request & { correlationId?: string }).correlationId }, "request failed");
  res.status(message.includes("Invalid") ? 401 : 400).json({ message, correlationId: res.getHeader("x-correlation-id") });
});

app.listen(port, () => {
  logger.info({ port, mockMode: isMockMode() }, "Voice AI Bot backend started");
});
