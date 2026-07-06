import crypto from "node:crypto";
import dgram, { type RemoteInfo } from "node:dgram";
import os from "node:os";
import { v4 as uuid } from "uuid";
import type { Store } from "../../data.js";
import { defaultOrgId } from "../../data.js";
import { maskRecord } from "../../common/crypto/encryption.js";
import type { CallSession, TelephonyConnection } from "../../types.js";
import { createAiProviderAdapter } from "../ai-providers/adapters.js";
import { retrieveKnowledgeContext } from "../knowledge/knowledge.service.js";
import { registerSipConnection } from "./sip-registration.js";
import { GoogleDialogflowVoiceProvider } from "../voice/providers.js";

type ParsedSip = {
  method: string;
  requestUri: string;
  headers: Record<string, string>;
  body: string;
};

const activeCalls = new Set<string>();

function parseSip(message: string): ParsedSip {
  const [head, ...bodyParts] = message.split(/\r?\n\r?\n/);
  const lines = head.split(/\r?\n/);
  const [method, requestUri] = (lines.shift() ?? "").split(/\s+/);
  const headers: Record<string, string> = {};
  for (const line of lines) {
    const index = line.indexOf(":");
    if (index > -1) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
  }
  return { method, requestUri, headers, body: bodyParts.join("\r\n\r\n") };
}

function header(parsed: ParsedSip, name: string) {
  return parsed.headers[name.toLowerCase()] ?? "";
}

function parseSdp(sdp: string) {
  const connectionLine = sdp.match(/^c=IN IP4 (.+)$/m);
  const mediaLine = sdp.match(/^m=audio (\d+) RTP\/AVP ([\d\s]+)$/m);
  const payloads = mediaLine?.[2]?.trim().split(/\s+/).map(Number) ?? [];
  const payloadType = payloads.includes(0) ? 0 : payloads.includes(8) ? 8 : payloads[0];
  return {
    address: connectionLine?.[1]?.trim() ?? "",
    port: mediaLine ? Number(mediaLine[1]) : 0,
    payloadType
  };
}

function getLocalAddressFor(remoteAddress: string) {
  const remoteParts = remoteAddress.split(".").slice(0, 3).join(".");
  for (const details of Object.values(os.networkInterfaces()).flat()) {
    if (!details || details.family !== "IPv4" || details.internal) continue;
    if (details.address.startsWith(`${remoteParts}.`)) return details.address;
  }
  return Object.values(os.networkInterfaces()).flat().find((item) => item?.family === "IPv4" && !item.internal)?.address ?? "127.0.0.1";
}

function withToTag(to: string, tag: string) {
  return /;tag=/i.test(to) ? to : `${to};tag=${tag}`;
}

function sipResponse(parsed: ParsedSip, status: number, reason: string, localSdp?: string, toTag = crypto.randomBytes(5).toString("hex")) {
  const headers = [
    `SIP/2.0 ${status} ${reason}`,
    `Via: ${header(parsed, "via")}`,
    `From: ${header(parsed, "from")}`,
    `To: ${withToTag(header(parsed, "to"), toTag)}`,
    `Call-ID: ${header(parsed, "call-id")}`,
    `CSeq: ${header(parsed, "cseq")}`,
    "Server: VoiceAI-Bot/1.0",
    localSdp ? "Content-Type: application/sdp" : undefined,
    `Content-Length: ${Buffer.byteLength(localSdp ?? "")}`,
    "",
    localSdp ?? ""
  ].filter((line): line is string => line !== undefined);
  return headers.join("\r\n");
}

function sipBye(parsed: ParsedSip, localAddress: string, localPort: number, toTag: string) {
  const remoteTarget = parsed.requestUri || `sip:${header(parsed, "from").match(/sip:([^>;]+)/i)?.[1] ?? "unknown"}`;
  return [
    `BYE ${remoteTarget} SIP/2.0`,
    `Via: SIP/2.0/UDP ${localAddress}:${localPort};branch=z9hG4bK-${crypto.randomBytes(9).toString("hex")};rport`,
    "Max-Forwards: 70",
    `From: ${withToTag(header(parsed, "to"), toTag)}`,
    `To: ${header(parsed, "from")}`,
    `Call-ID: ${header(parsed, "call-id")}`,
    "CSeq: 2 BYE",
    "User-Agent: VoiceAI-Bot/1.0",
    "Content-Length: 0",
    "",
    ""
  ].join("\r\n");
}

function buildSdp(address: string, port: number, payloadType: number) {
  const codec = payloadType === 8 ? "PCMA" : "PCMU";
  return [
    "v=0",
    `o=voiceai ${Date.now()} ${Date.now()} IN IP4 ${address}`,
    "s=VoiceAI Bot",
    `c=IN IP4 ${address}`,
    "t=0 0",
    `m=audio ${port} RTP/AVP ${payloadType}`,
    `a=rtpmap:${payloadType} ${codec}/8000`,
    "a=sendrecv",
    ""
  ].join("\r\n");
}

function decodePcmu(sample: number) {
  sample = ~sample & 0xff;
  const sign = sample & 0x80;
  const exponent = (sample >> 4) & 0x07;
  const mantissa = sample & 0x0f;
  let value = ((mantissa << 4) + 0x08) << exponent;
  value -= 0x84;
  return sign ? -value : value;
}

function encodePcmu(sample: number) {
  const bias = 0x84;
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  sample = Math.min(sample + bias, 32635);
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function encodePcma(sample: number) {
  let sign = 0x00;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  sample = Math.min(sample, 32635);
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = exponent === 0 ? (sample >> 4) & 0x0f : (sample >> (exponent + 3)) & 0x0f;
  const encoded = sign | (exponent << 4) | mantissa;
  return encoded ^ 0x55;
}

function decodePcma(sample: number) {
  sample ^= 0x55;
  const sign = sample & 0x80;
  const exponent = (sample & 0x70) >> 4;
  const mantissa = sample & 0x0f;
  let value = exponent === 0 ? (mantissa << 4) + 8 : ((mantissa << 4) + 0x108) << (exponent - 1);
  return sign ? value : -value;
}

function rtpPayloadToPcm(packet: Buffer, payloadType: number) {
  const payload = packet.subarray(12);
  const pcm = Buffer.alloc(payload.length * 2);
  for (let index = 0; index < payload.length; index++) {
    const sample = payloadType === 8 ? decodePcma(payload[index]) : decodePcmu(payload[index]);
    pcm.writeInt16LE(sample, index * 2);
  }
  return pcm;
}

async function collectCallerAudio(rtpSocket: dgram.Socket, payloadType: number) {
  const chunks: Buffer[] = [];
  const started = Date.now();
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5500);
    rtpSocket.on("message", (packet) => {
      if (packet.length > 12) chunks.push(rtpPayloadToPcm(packet, payloadType));
      if (Date.now() - started > 5500) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  return Buffer.concat(chunks);
}

async function sendPcmAsRtp(input: { socket: dgram.Socket; remoteAddress: string; remotePort: number; payloadType: number; pcm: Buffer }) {
  let sequence = Math.floor(Math.random() * 65535);
  let timestamp = Math.floor(Math.random() * 1_000_000);
  const ssrc = crypto.randomBytes(4).readUInt32BE(0);
  for (let offset = 0; offset < input.pcm.length; offset += 320) {
    const frame = input.pcm.subarray(offset, offset + 320);
    const payload = Buffer.alloc(Math.ceil(frame.length / 2));
    for (let i = 0; i < payload.length; i++) {
      const sample = frame.readInt16LE(i * 2);
      payload[i] = input.payloadType === 8 ? encodePcma(sample) : encodePcmu(sample);
    }
    const header = Buffer.alloc(12);
    header[0] = 0x80;
    header[1] = input.payloadType;
    header.writeUInt16BE(sequence++ & 0xffff, 2);
    header.writeUInt32BE(timestamp, 4);
    header.writeUInt32BE(ssrc, 8);
    timestamp += payload.length;
    const packet = Buffer.concat([header, payload]);
    input.socket.send(packet, input.remotePort, input.remoteAddress);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function findNode(flow: NonNullable<Store["flows"][number]>, id: string) {
  return flow.graphJson.nodes.find((node) => node.id === id) ?? flow.graphJson.nodes[0];
}

export async function startSipVoiceBot(connection: TelephonyConnection, store: Store) {
  return registerSipConnection(connection, {
    onRequest: (message, sipSocket, remote) => {
      const parsed = parseSip(message);
      if (parsed.method === "BYE") {
        sipSocket.send(Buffer.from(sipResponse(parsed, 200, "OK")), remote.port, remote.address);
        activeCalls.delete(header(parsed, "call-id"));
        return;
      }
      if (parsed.method !== "INVITE") return;
      void handleInvite(parsed, sipSocket, remote, connection, store);
    }
  });
}

async function handleInvite(parsed: ParsedSip, sipSocket: dgram.Socket, remote: RemoteInfo, connection: TelephonyConnection, store: Store) {
  const callId = header(parsed, "call-id");
  if (activeCalls.has(callId)) return;
  activeCalls.add(callId);
  const remoteRtp = parseSdp(parsed.body);
  const toTag = crypto.randomBytes(5).toString("hex");
  if (!remoteRtp.address || !remoteRtp.port || ![0, 8].includes(remoteRtp.payloadType)) {
    sipSocket.send(Buffer.from(sipResponse(parsed, 488, "Not Acceptable Here", undefined, toTag)), remote.port, remote.address);
    activeCalls.delete(callId);
    return;
  }

  const rtpSocket = dgram.createSocket("udp4");
  await new Promise<void>((resolve) => rtpSocket.bind(0, resolve));
  const rtpAddress = rtpSocket.address();
  const localRtpPort = typeof rtpAddress === "object" ? rtpAddress.port : 0;
  const localAddress = getLocalAddressFor(remote.address);
  const sipAddress = sipSocket.address();
  const localSipPort = typeof sipAddress === "object" ? sipAddress.port : connection.port || 5060;
  sipSocket.send(Buffer.from(sipResponse(parsed, 100, "Trying", undefined, toTag)), remote.port, remote.address);
  sipSocket.send(Buffer.from(sipResponse(parsed, 180, "Ringing", undefined, toTag)), remote.port, remote.address);
  sipSocket.send(Buffer.from(sipResponse(parsed, 200, "OK", buildSdp(localAddress, localRtpPort, remoteRtp.payloadType), toTag)), remote.port, remote.address);

  const flow = store.flows.find((item) => item.id === connection.flowId) ?? store.flows.find((item) => item.status === "PUBLISHED") ?? store.flows[0];
  const voicebotNode = flow.graphJson.nodes.find((node) => node.type === "voiceBot");
  const promptId = typeof voicebotNode?.data.promptId === "string" ? voicebotNode.data.promptId : undefined;
  const aiProviderId = typeof voicebotNode?.data.aiProviderId === "string" ? voicebotNode.data.aiProviderId : undefined;
  const dialogflowConfigId = typeof voicebotNode?.data.dialogflowConfigId === "string" ? voicebotNode.data.dialogflowConfigId : undefined;
  const aiProvider = store.aiProviders.find((item) => item.id === aiProviderId && item.isActive) ?? store.aiProviders.find((item) => item.isActive);
  const prompt = store.prompts.find((item) => item.id === promptId && item.isActive) ?? store.prompts.find((item) => item.isActive);
  const dialogflow = store.dialogflowConfigs.find((item) => item.id === dialogflowConfigId && item.isActive) ?? store.dialogflowConfigs.find((item) => item.isActive);
  if (!aiProvider || !prompt || !dialogflow?.encryptedServiceAccountJson) {
    sipSocket.send(Buffer.from(sipBye(parsed, localAddress, localSipPort, toTag)), remote.port, remote.address);
    rtpSocket.close();
    activeCalls.delete(callId);
    return;
  }

  const session: CallSession = {
    id: `se_${uuid().slice(0, 8)}`,
    organizationId: defaultOrgId,
    callId,
    channelId: `sip_${connection.extension}_${uuid().slice(0, 6)}`,
    callerNumber: header(parsed, "from"),
    calledNumber: connection.extension,
    flowVersionId: flow.activeVersionId,
    status: "ACTIVE" as const,
    startedAt: new Date().toISOString(),
    metadataJson: { telephonyConnectionId: connection.id, sip: true }
  };
  store.sessions.unshift(session);

  try {
    const voice = new GoogleDialogflowVoiceProvider(dialogflow);
    const languageCode = dialogflow.languageCode || prompt.language || "th-TH";
    const greeting = typeof voicebotNode?.data.greeting === "string" ? voicebotNode.data.greeting : "สวัสดีค่ะ ยินดีต้อนรับ ต้องการให้ช่วยเรื่องอะไรคะ";
    const greetingAudio = await voice.synthesizeSpeech({ text: greeting, languageCode, voiceName: dialogflow.voiceName, audioEncoding: "LINEAR16" });
    await sendPcmAsRtp({ socket: rtpSocket, remoteAddress: remoteRtp.address, remotePort: remoteRtp.port, payloadType: remoteRtp.payloadType, pcm: greetingAudio.audioBuffer });

    const callerPcm = await collectCallerAudio(rtpSocket, remoteRtp.payloadType);
    if (!callerPcm.length) {
      throw new Error("No caller RTP audio was received before STT.");
    }
    const stt = await voice.transcribeAudio({ audioBuffer: callerPcm, encoding: "LINEAR16", sampleRateHertz: 8000, languageCode, sessionId: session.id });
    store.transcripts.push({ id: uuid(), organizationId: defaultOrgId, callSessionId: session.id, speaker: "caller", text: stt.text, confidence: stt.confidence, createdAt: new Date().toISOString() });

    const detectedIntent = await voice.detectIntent({ text: stt.text, sessionId: session.id, languageCode }).catch((error: unknown) => ({
      fulfillmentText: error instanceof Error ? error.message : "Dialogflow detectIntent failed",
      intentName: "dialogflow_error"
    }));
    const nodeModel = typeof voicebotNode?.data.model === "string" && voicebotNode.data.model.trim()
      ? voicebotNode.data.model.trim()
      : aiProvider.defaultModel?.trim();
    if (!nodeModel) {
      throw new Error("Select an AI model in Flow Builder before receiving SIP calls.");
    }
    const nodeKnowledgeIds = Array.isArray(voicebotNode?.data.knowledgeBaseIds) ? voicebotNode.data.knowledgeBaseIds.filter((item): item is string => typeof item === "string") : prompt.knowledgeBaseIds;
    const knowledgeContext = retrieveKnowledgeContext(store.knowledgeBases, nodeKnowledgeIds, stt.text);
    const systemPrompt = knowledgeContext ? `${prompt.systemPrompt}\n\nKnowledge base context:\n${knowledgeContext}` : prompt.systemPrompt;
    const response = await createAiProviderAdapter(aiProvider).generateResponse({
      systemPrompt,
      userText: stt.text,
      conversationHistory: detectedIntent.fulfillmentText ? [{ role: "system", content: `Dialogflow: ${detectedIntent.fulfillmentText}` }] : [],
      model: nodeModel,
      temperature: typeof aiProvider.configJson.temperature === "number" ? aiProvider.configJson.temperature : 0.4,
      maxTokens: typeof aiProvider.configJson.maxTokens === "number" ? aiProvider.configJson.maxTokens : 300,
      metadata: { telephonyConnectionId: connection.id, dialogflowIntent: detectedIntent.intentName }
    });
    store.providerLogs.push({
      id: uuid(),
      organizationId: defaultOrgId,
      callSessionId: session.id,
      providerId: aiProvider.id,
      model: nodeModel,
      requestJsonMasked: maskRecord({ userText: stt.text, providerType: aiProvider.type, knowledgeBaseIds: nodeKnowledgeIds }),
      responseJson: response.rawResponse as Record<string, unknown>,
      latencyMs: response.latencyMs,
      status: "OK",
      createdAt: new Date().toISOString()
    });
    store.transcripts.push({ id: uuid(), organizationId: defaultOrgId, callSessionId: session.id, speaker: "bot", text: response.text, createdAt: new Date().toISOString() });
    const answerAudio = await voice.synthesizeSpeech({ text: response.text, languageCode, voiceName: dialogflow.voiceName, audioEncoding: "LINEAR16" });
    await sendPcmAsRtp({ socket: rtpSocket, remoteAddress: remoteRtp.address, remotePort: remoteRtp.port, payloadType: remoteRtp.payloadType, pcm: answerAudio.audioBuffer });
    session.status = "COMPLETED";
    session.finalResult = "Bot resolved";
    session.endedAt = new Date().toISOString();
    sipSocket.send(Buffer.from(sipBye(parsed, localAddress, localSipPort, toTag)), remote.port, remote.address);
  } catch (error) {
    session.status = "FAILED";
    session.failureReason = error instanceof Error ? error.message : "SIP voice bridge failed";
    session.endedAt = new Date().toISOString();
    sipSocket.send(Buffer.from(sipBye(parsed, localAddress, localSipPort, toTag)), remote.port, remote.address);
  } finally {
    rtpSocket.close();
    activeCalls.delete(callId);
  }
}
