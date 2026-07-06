import type { DialogflowConfig } from "../../types.js";
import { decryptSecret } from "../../common/crypto/encryption.js";

export interface VoiceProvider {
  transcribeAudio(input: {
    audioBuffer: Buffer;
    encoding: string;
    sampleRateHertz: number;
    languageCode: string;
    sessionId: string;
  }): Promise<{ text: string; confidence?: number; rawResponse: unknown }>;
  synthesizeSpeech(input: {
    text: string;
    languageCode: string;
    voiceName?: string;
    audioEncoding?: "MP3" | "LINEAR16";
  }): Promise<{ audioBuffer: Buffer; audioFormat: string; rawResponse: unknown }>;
  detectIntent(input: {
    text?: string;
    audioBuffer?: Buffer;
    sessionId: string;
    languageCode: string;
  }): Promise<{ intentName?: string; fulfillmentText?: string; confidence?: number; rawResponse: unknown }>;
}

export class MockVoiceProvider implements VoiceProvider {
  async transcribeAudio(_input: {
    audioBuffer: Buffer;
    encoding: string;
    sampleRateHertz: number;
    languageCode: string;
    sessionId: string;
  }): ReturnType<VoiceProvider["transcribeAudio"]> {
    return { text: "ต้องการตรวจสอบสถานะรายการ", confidence: 0.71, rawResponse: { provider: "mock-stt" } };
  }

  async synthesizeSpeech(input: { text: string; languageCode: string; voiceName?: string; audioEncoding?: "MP3" | "LINEAR16" }): ReturnType<VoiceProvider["synthesizeSpeech"]> {
    return {
      audioBuffer: Buffer.from(`mock-audio:${input.text}`),
      audioFormat: "audio/wav",
      rawResponse: { provider: "mock-tts", voiceName: input.voiceName ?? "th-TH-Standard-A" }
    };
  }

  async detectIntent(input: { text?: string; audioBuffer?: Buffer; sessionId: string; languageCode: string }): ReturnType<VoiceProvider["detectIntent"]> {
    return {
      intentName: /billing/i.test(input.text ?? "") ? "billing" : "order_status",
      fulfillmentText: "Dialogflow mock ตรวจพบความต้องการของผู้โทร",
      confidence: 0.71,
      rawResponse: { provider: "mock-dialogflow", sessionId: input.sessionId }
    };
  }
}

export class GoogleDialogflowVoiceProvider extends MockVoiceProvider {
  constructor(private readonly config: DialogflowConfig) {
    super();
  }

  private getServiceAccount(): GoogleServiceAccount {
    if (!this.config.encryptedServiceAccountJson) {
      throw new Error("Dialogflow service account JSON is not uploaded");
    }
    return parseServiceAccountJson(decryptSecret(this.config.encryptedServiceAccountJson));
  }

  async getAccessToken() {
    return getGoogleAccessToken(this.getServiceAccount());
  }

  async transcribeAudio(input: {
    audioBuffer: Buffer;
    encoding: string;
    sampleRateHertz: number;
    languageCode: string;
    sessionId: string;
  }) {
    const token = await this.getAccessToken();
    const response = await fetch("https://speech.googleapis.com/v1/speech:recognize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: {
          encoding: input.encoding,
          sampleRateHertz: input.sampleRateHertz,
          languageCode: input.languageCode,
          enableAutomaticPunctuation: true
        },
        audio: { content: input.audioBuffer.toString("base64") }
      })
    });
    const json = await response.json() as {
      results?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }> }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(json.error?.message ?? `Speech-to-Text returned HTTP ${response.status}`);
    }
    const best = json.results?.[0]?.alternatives?.[0];
    return {
      text: best?.transcript ?? "",
      confidence: best?.confidence,
      rawResponse: json
    };
  }

  async detectIntent(input: { text?: string; audioBuffer?: Buffer; sessionId: string; languageCode: string }) {
    if (!this.config.projectId || !this.config.agentId) {
      throw new Error("Dialogflow project ID and agent ID are required");
    }
    const token = await this.getAccessToken();
    const location = this.config.location || "global";
    const endpoint = location === "global" ? "https://dialogflow.googleapis.com/v3" : `https://${location}-dialogflow.googleapis.com/v3`;
    const response = await fetch(
      `${endpoint}/projects/${encodeURIComponent(this.config.projectId)}/locations/${encodeURIComponent(location)}/agents/${encodeURIComponent(this.config.agentId)}/sessions/${encodeURIComponent(input.sessionId)}:detectIntent`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          queryInput: {
            text: { text: input.text ?? "" },
            languageCode: input.languageCode
          }
        })
      }
    );
    const json = await response.json() as {
      queryResult?: {
        intent?: { displayName?: string };
        responseMessages?: Array<{ text?: { text?: string[] } }>;
        match?: { confidence?: number };
      };
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(json.error?.message ?? `Dialogflow returned HTTP ${response.status}`);
    }
    return {
      intentName: json.queryResult?.intent?.displayName,
      fulfillmentText: json.queryResult?.responseMessages?.flatMap((message) => message.text?.text ?? []).join(" "),
      confidence: json.queryResult?.match?.confidence,
      rawResponse: json
    };
  }

  async synthesizeSpeech(input: { text: string; languageCode: string; voiceName?: string; audioEncoding?: "MP3" | "LINEAR16" }) {
    const token = await this.getAccessToken();
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: { text: input.text },
        voice: {
          languageCode: input.languageCode,
          name: input.voiceName || this.config.voiceName || "th-TH-Standard-A"
        },
        audioConfig: { audioEncoding: input.audioEncoding ?? "MP3", sampleRateHertz: 8000 }
      })
    });
    const json = await response.json() as { audioContent?: string; error?: { message?: string } };
    if (!response.ok || !json.audioContent) {
      throw new Error(json.error?.message ?? `Text-to-Speech returned HTTP ${response.status}`);
    }
    return {
      audioBuffer: Buffer.from(json.audioContent, "base64"),
      audioFormat: (input.audioEncoding ?? "MP3") === "LINEAR16" ? "audio/l16" : "audio/mpeg",
      rawResponse: { provider: "google-tts", voiceName: input.voiceName || this.config.voiceName }
    };
  }
}

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

export function parseServiceAccountJson(value: string): GoogleServiceAccount {
  const parsed = JSON.parse(value) as Partial<GoogleServiceAccount>;
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error("Service account JSON must include client_email, private_key, and project_id");
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    project_id: parsed.project_id,
    token_uri: parsed.token_uri
  };
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken(account: GoogleServiceAccount) {
  const { createSign } = await import("node:crypto");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  const assertion = `${unsignedJwt}.${base64Url(signer.sign(account.private_key))}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const response = await fetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const json = await response.json() as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Google OAuth returned HTTP ${response.status}`);
  }
  return json.access_token;
}
