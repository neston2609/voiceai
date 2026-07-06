import { v4 as uuid } from "uuid";
import { defaultOrgId, type Store } from "../../data.js";
import { maskRecord } from "../../common/crypto/encryption.js";
import type { CallExecutionLog, CallSession, FlowNode, Transcript } from "../../types.js";
import { createAiProviderAdapter } from "../ai-providers/adapters.js";
import { retrieveKnowledgeContext } from "../knowledge/knowledge.service.js";
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
  const voice = dialogflow?.encryptedServiceAccountJson ? new GoogleDialogflowVoiceProvider(dialogflow) : undefined;
  const tel = new MockTelephonyProvider();
  const languageCode = dialogflow?.languageCode || prompt.language || "th-TH";
  const logs: CallExecutionLog[] = [];
  const transcripts: Transcript[] = [];
  const callerHears: Array<{
    sequence: number;
    nodeId: string;
    label: string;
    text: string;
    audioBase64?: string;
    audioFormat?: string;
    ttsStatus: "ready" | "not-configured" | "failed";
    ttsError?: string;
  }> = [];

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
  const synthesizeForCaller = async (sourceNode: FlowNode, label: string, text?: string) => {
    const cleanText = text?.trim();
    if (!cleanText) return;
    const preview: (typeof callerHears)[number] = {
      sequence: callerHears.length + 1,
      nodeId: sourceNode.id,
      label,
      text: cleanText,
      ttsStatus: voice ? "failed" : "not-configured"
    };
    if (voice) {
      try {
        const audio = await voice.synthesizeSpeech({
          text: cleanText,
          languageCode,
          voiceName: dialogflow?.voiceName
        });
        preview.audioBase64 = audio.audioBuffer.toString("base64");
        preview.audioFormat = audio.audioFormat;
        preview.ttsStatus = "ready";
      } catch (error) {
        preview.ttsError = error instanceof Error ? error.message : "Text-to-Speech failed";
      }
    }
    callerHears.push(preview);
    transcripts.push({
      id: uuid(),
      organizationId: defaultOrgId,
      callSessionId: session.id,
      speaker: "bot",
      text: cleanText,
      createdAt: now()
    });
  };

  try {
  if (aiProvider.type === "MOCK") {
    throw new Error("Live mode requires a real AI provider. Configure OpenAI, Gemini, Claude, or Custom HTTP.");
  }
  const ai = createAiProviderAdapter(aiProvider);

  await tel.answer(session.channelId);
  writeLog(node("start"), "call.started", { answered: true, channelId: session.channelId });

  const greeting = typeof voicebotNode?.data.greeting === "string"
    ? voicebotNode.data.greeting
    : "สวัสดีค่ะ ยินดีต้อนรับ ต้องการให้ช่วยเรื่องอะไรคะ";
  if (voicebotNode) {
    await synthesizeForCaller(voicebotNode, "Greeting", greeting);
  }

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

  const nodeModel = typeof voicebotNode?.data.model === "string" && voicebotNode.data.model.trim() ? voicebotNode.data.model.trim() : aiProvider.defaultModel;
  const nodeKnowledgeIds = Array.isArray(voicebotNode?.data.knowledgeBaseIds)
    ? voicebotNode.data.knowledgeBaseIds.filter((item): item is string => typeof item === "string")
    : undefined;
  const knowledgeBaseIds = nodeKnowledgeIds?.length ? nodeKnowledgeIds : prompt.knowledgeBaseIds;
  const knowledgeContext = retrieveKnowledgeContext(store.knowledgeBases, knowledgeBaseIds, input.utterance || stt.text);
  const systemPrompt = knowledgeContext
    ? `${prompt.systemPrompt}\n\nUse the following knowledge base context when relevant. If the answer is not in the context, say that you do not have enough information and continue politely.\n\n${knowledgeContext}`
    : prompt.systemPrompt;

  const response = await ai.generateResponse({
    systemPrompt,
    userText: input.utterance,
    conversationHistory: detectedIntent.fulfillmentText ? [{ role: "system", content: `Dialogflow: ${detectedIntent.fulfillmentText}` }] : [],
    model: nodeModel,
    temperature: typeof aiProvider.configJson.temperature === "number" ? aiProvider.configJson.temperature : 0.4,
    maxTokens: typeof aiProvider.configJson.maxTokens === "number" ? aiProvider.configJson.maxTokens : 300,
    metadata: { dialogflowIntent: detectedIntent.intentName }
  });
  store.providerLogs.push({
    id: uuid(),
    organizationId: defaultOrgId,
    callSessionId: session.id,
    providerId: aiProvider.id,
    model: nodeModel,
    requestJsonMasked: maskRecord({ userText: input.utterance, providerType: aiProvider.type, dialogflowConfigId: dialogflow?.id, knowledgeBaseIds }),
    responseJson: response.rawResponse as Record<string, unknown>,
    latencyMs: response.latencyMs,
    status: "OK",
    createdAt: now()
  });
  transcripts.push({
    id: uuid(),
    organizationId: defaultOrgId,
    callSessionId: session.id,
    speaker: "system",
    text: `AI response generated with ${aiProvider.name}`,
    createdAt: now()
  });
  await synthesizeForCaller(node("voicebot"), "AI answer", response.text);
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
    await synthesizeForCaller(node("transfer"), "Transfer notice", "กรุณารอสักครู่ค่ะ ฉันจะโอนสายไปยังเจ้าหน้าที่");
    await tel.transfer(session.channelId, { type: "queue", value: "sales" });
    writeLog(node("transfer"), "transfer.completed", { destination: "queue:sales", result: "answered", latencyMs: 620 });
    session.finalResult = "Escalated";
  } else {
    const hangupNode = node("hangup");
    const finalMessage = typeof hangupNode.data.finalMessage === "string" ? hangupNode.data.finalMessage : "ขอบคุณที่โทรมาค่ะ";
    await synthesizeForCaller(node("hangup"), "Final message", finalMessage);
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
    providerLogs: store.providerLogs.filter((log) => log.callSessionId === session.id),
    callerHears,
    callPreview: {
      flowId: flow.id,
      flowName: flow.name,
      calledNumber: input.calledNumber,
      languageCode,
      voiceName: dialogflow?.voiceName,
      aiProvider: aiProvider.name,
      model: nodeModel,
      dialogflowStatus: voice ? "configured" : "missing-credential",
      finalResult: session.finalResult,
      summary: callerHears.map((item) => item.text).join(" ")
    }
  };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed";
    session.status = "FAILED";
    session.endedAt = now();
    session.failureReason = message;
    writeLog(node("start"), "simulation.failed", { message }, "ERROR");
    throw error;
  }
}
