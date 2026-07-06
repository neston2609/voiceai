import { v4 as uuid } from "uuid";
import { defaultOrgId, type Store } from "../../data.js";
import { maskRecord } from "../../common/crypto/encryption.js";
import type { CallExecutionLog, CallSession, FlowNode, Transcript } from "../../types.js";
import { createAiProviderAdapter } from "../ai-providers/adapters.js";
import { MockTelephonyProvider } from "../telephony/providers.js";
import { GoogleDialogflowVoiceProvider } from "../voice/providers.js";

const now = () => new Date().toISOString();

export async function simulateCall(
  store: Store,
  input: { flowId: string; callerNumber: string; calledNumber: string; utterance: string; dtmf?: string },
  correlationId: string
) {
  const flow = store.flows.find((item) => item.id === input.flowId) ?? store.flows[0];
  const session: CallSession = {
    id: `se_${uuid().slice(0, 8)}`,
    organizationId: defaultOrgId,
    callId: `call_${uuid().slice(0, 8)}`,
    channelId: `live_test_channel_${uuid().slice(0, 8)}`,
    callerNumber: input.callerNumber,
    calledNumber: input.calledNumber,
    flowVersionId: flow.activeVersionId,
    status: "ACTIVE",
    startedAt: now(),
    metadataJson: {}
  };
  store.sessions.unshift(session);

  const voicebotNode = flow.graphJson.nodes.find((item) => item.type === "voiceBot");
  const aiProviderId = typeof voicebotNode?.data.aiProviderId === "string" ? voicebotNode.data.aiProviderId : undefined;
  const promptId = typeof voicebotNode?.data.promptId === "string" ? voicebotNode.data.promptId : undefined;
  const dialogflowConfigId = typeof voicebotNode?.data.dialogflowConfigId === "string" ? voicebotNode.data.dialogflowConfigId : undefined;
  const aiProvider = store.aiProviders.find((item) => item.id === aiProviderId && item.isActive) ?? store.aiProviders.find((item) => item.isActive) ?? store.aiProviders[0];
  const dialogflow = store.dialogflowConfigs.find((item) => item.id === dialogflowConfigId && item.isActive) ?? store.dialogflowConfigs.find((item) => item.isActive);
  const prompt = store.prompts.find((item) => item.id === promptId && item.isActive) ?? store.prompts.find((item) => item.isActive) ?? store.prompts[0];
  if (aiProvider.type === "MOCK") {
    throw new Error("Live mode requires a real AI provider. Configure OpenAI, Gemini, Claude, or Custom HTTP.");
  }
  const ai = createAiProviderAdapter(aiProvider);
  const voice = dialogflow?.encryptedServiceAccountJson ? new GoogleDialogflowVoiceProvider(dialogflow) : undefined;
  const tel = new MockTelephonyProvider();
  const languageCode = dialogflow?.languageCode || prompt.language || "th-TH";
  const logs: CallExecutionLog[] = [];
  const transcripts: Transcript[] = [];

  const writeLog = (node: FlowNode, eventType: string, outputJson: Record<string, unknown>, status: CallExecutionLog["status"] = "OK") => {
    const log: CallExecutionLog = {
      id: uuid(),
      organizationId: defaultOrgId,
      callSessionId: session.id,
      sequence: logs.length + 1,
      nodeId: node.id,
      nodeType: node.type,
      eventType,
      inputJson: { callerNumber: input.callerNumber, calledNumber: input.calledNumber },
      outputJson,
      latencyMs: Number(outputJson.latencyMs ?? 0),
      status,
      correlationId,
      createdAt: now()
    };
    logs.push(log);
    store.executionLogs.push(log);
  };

  const graph = flow.graphJson;
  const node = (id: string) => graph.nodes.find((item) => item.id === id) ?? graph.nodes[0];
  await tel.answer(session.channelId);
  writeLog(node("start"), "call.started", { answered: true, channelId: session.channelId });

  const stt = input.utterance
    ? { text: input.utterance, confidence: 0.92, rawResponse: { provider: "typed-simulator", languageCode } }
    : voice ? await voice.transcribeAudio({
      audioBuffer: Buffer.from(input.utterance),
      encoding: "LINEAR16",
      sampleRateHertz: 8000,
      languageCode,
      sessionId: session.id
    }) : { text: "", confidence: undefined, rawResponse: { provider: "not-configured", message: "Dialogflow service account JSON is not uploaded" } };
  const detectedIntent = voice ? await voice.detectIntent({
    text: input.utterance || stt.text,
    sessionId: session.id,
    languageCode
  }).catch((error: unknown) => ({
    intentName: "dialogflow_error",
    fulfillmentText: error instanceof Error ? error.message : "Dialogflow detectIntent failed",
    confidence: undefined,
    rawResponse: { error: error instanceof Error ? error.message : "Dialogflow detectIntent failed" }
  })) : {
    intentName: "dialogflow_not_configured",
    fulfillmentText: "Dialogflow service account JSON is not uploaded",
    confidence: undefined,
    rawResponse: { provider: "not-configured" }
  };
  transcripts.push({
    id: uuid(),
    organizationId: defaultOrgId,
    callSessionId: session.id,
    speaker: "caller",
    text: input.utterance || stt.text,
    confidence: stt.confidence,
    createdAt: now()
  });

  const response = await ai.generateResponse({
    systemPrompt: prompt.systemPrompt,
    userText: input.utterance,
    conversationHistory: detectedIntent.fulfillmentText ? [{ role: "system", content: `Dialogflow: ${detectedIntent.fulfillmentText}` }] : [],
    model: aiProvider.defaultModel,
    temperature: typeof aiProvider.configJson.temperature === "number" ? aiProvider.configJson.temperature : 0.4,
    maxTokens: typeof aiProvider.configJson.maxTokens === "number" ? aiProvider.configJson.maxTokens : 300,
    metadata: { dialogflowIntent: detectedIntent.intentName }
  });
  store.providerLogs.push({
    id: uuid(),
    organizationId: defaultOrgId,
    callSessionId: session.id,
    providerId: aiProvider.id,
    model: aiProvider.defaultModel,
    requestJsonMasked: maskRecord({ userText: input.utterance, providerType: aiProvider.type, dialogflowConfigId: dialogflow?.id }),
    responseJson: response.rawResponse as Record<string, unknown>,
    latencyMs: response.latencyMs,
    status: "OK",
    createdAt: now()
  });
  transcripts.push({
    id: uuid(),
    organizationId: defaultOrgId,
    callSessionId: session.id,
    speaker: "bot",
    text: response.text,
    createdAt: now()
  });
  writeLog(node("voicebot"), "voicebot.completed", {
    sttText: input.utterance || stt.text,
    confidence: stt.confidence,
    languageCode,
    dialogflowIntent: detectedIntent.intentName,
    dialogflowText: detectedIntent.fulfillmentText,
    aiText: response.text,
    latencyMs: response.latencyMs
  });

  const dtmf = input.dtmf || "1";
  writeLog(node("ivr"), "dtmf.received", { digit: dtmf, route: dtmf === "0" ? "operator" : "condition", latencyMs: 110 });

  const confidence = stt.confidence ?? 0;
  const shouldTransfer = confidence < 0.8 || dtmf === "0";
  writeLog(
    node("condition"),
    "branch.evaluated",
    { expression: "confidence < 0.80", confidence, nextNode: shouldTransfer ? "transfer" : "hangup", latencyMs: 4 },
    "BRANCH"
  );

  if (shouldTransfer) {
    await tel.transfer(session.channelId, { type: "queue", value: "sales" });
    writeLog(node("transfer"), "transfer.completed", { destination: "queue:sales", result: "answered", latencyMs: 620 });
    session.finalResult = "Escalated";
  } else {
    writeLog(node("hangup"), "call.ended", { reason: "resolved", latencyMs: 0 }, "END");
    session.finalResult = "Bot resolved";
  }

  session.status = "COMPLETED";
  session.endedAt = now();
  session.durationSeconds = 134;
  store.transcripts.push(...transcripts);

  return {
    session,
    logs,
    transcripts,
    providerLogs: store.providerLogs.filter((log) => log.callSessionId === session.id)
  };
}
