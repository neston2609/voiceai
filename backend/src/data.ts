import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import type {
  AiProviderConfig,
  CallExecutionLog,
  CallFlow,
  CallSession,
  DialogflowConfig,
  Organization,
  PromptTemplate,
  ProviderRequestLog,
  Transcript,
  User
} from "./types.js";

const now = () => new Date().toISOString();
export const defaultOrgId = "org_default";
export const defaultUserId = "usr_admin";
const asteriskConfigPath = path.join(process.cwd(), "runtime-data", "asterisk-configs.json");
const aiProviderConfigPath = path.join(process.cwd(), "runtime-data", "ai-providers.json");
const dialogflowConfigPath = path.join(process.cwd(), "runtime-data", "dialogflow-configs.json");

type StoredAsteriskConfig = {
  id: string;
  organizationId: string;
  name: string;
  ariUrl: string;
  username: string;
  encryptedPassword?: string;
  appName: string;
  botExtension: string;
  status: string;
  updatedAt: string;
};

export interface Store {
  organizations: Organization[];
  users: User[];
  aiProviders: AiProviderConfig[];
  dialogflowConfigs: DialogflowConfig[];
  prompts: PromptTemplate[];
  flows: CallFlow[];
  sessions: CallSession[];
  executionLogs: CallExecutionLog[];
  transcripts: Transcript[];
  providerLogs: ProviderRequestLog[];
  asteriskConfigs: StoredAsteriskConfig[];
  auditLogs: Array<Record<string, unknown>>;
}

export const sampleGraph = {
  nodes: [
    { id: "start", type: "start" as const, label: "Start", data: { trigger: "inbound_call" } },
    {
      id: "voicebot",
      type: "voiceBot" as const,
      label: "Greet and understand intent",
        data: {
        aiProviderId: "prov_mock",
        model: "gpt-4o",
        promptId: "prompt_support",
        dialogflowConfigId: "df_mock",
        greeting: "สวัสดีค่ะ ยินดีต้อนรับ ต้องการให้ช่วยเรื่องอะไรคะ",
        maxRetry: 3,
        sttConfidenceThreshold: 0.8,
        fallbackRoute: "ivr"
      }
    },
    {
      id: "ivr",
      type: "ivrMenu" as const,
      label: "Main IVR",
      data: { message: "กด 1 เพื่อตรวจสอบสถานะ กด 2 เรื่องการชำระเงิน หรือกด 0 เพื่อติดต่อเจ้าหน้าที่", allowedDigits: ["1", "2", "0"] }
    },
    { id: "condition", type: "condition" as const, label: "Confidence check", data: { expression: "confidence < 0.80" } },
    { id: "transfer", type: "transfer" as const, label: "Transfer to sales", data: { transferType: "queue", destination: "sales" } },
    { id: "fallback", type: "fallback" as const, label: "Fallback IVR", data: { message: "ขอโทษค่ะ ฉันจะโอนสายไปยังเมนูหลัก" } },
    { id: "hangup", type: "hangup" as const, label: "Hangup", data: { finalMessage: "ขอบคุณที่โทรมาค่ะ" } }
  ],
  edges: [
    { id: "e_start_voicebot", source: "start", target: "voicebot" },
    { id: "e_voicebot_ivr", source: "voicebot", target: "ivr", label: "fallback" },
    { id: "e_voicebot_transfer", source: "voicebot", target: "transfer", label: "resolved" },
    { id: "e_ivr_condition", source: "ivr", target: "condition", label: "digit 1" },
    { id: "e_transfer_condition", source: "transfer", target: "condition", label: "answered" },
    { id: "e_condition_fallback", source: "condition", target: "fallback", label: "low confidence" },
    { id: "e_condition_hangup", source: "condition", target: "hangup", label: "complete" }
  ]
};

export async function createStore(): Promise<Store> {
  const createdAt = now();
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@local";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be set");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const defaultAsteriskConfigs: StoredAsteriskConfig[] = [
    {
      id: "ari_mock",
      organizationId: defaultOrgId,
      name: "FreePBX ARI",
      ariUrl: process.env.ASTERISK_ARI_URL ?? "http://freepbx.local:8088/ari",
      username: process.env.ASTERISK_ARI_USERNAME ?? "voicebot",
      encryptedPassword: undefined,
      appName: process.env.ASTERISK_APP_NAME ?? "voicebot-app",
      botExtension: "7777",
      status: "not-tested",
      updatedAt: createdAt
    }
  ];

  let asteriskConfigs = defaultAsteriskConfigs;
  try {
    asteriskConfigs = JSON.parse(await readFile(asteriskConfigPath, "utf8")) as StoredAsteriskConfig[];
  } catch {
    asteriskConfigs = defaultAsteriskConfigs;
  }

  const defaultAiProviders: AiProviderConfig[] = [
    {
      id: "prov_mock",
      organizationId: defaultOrgId,
      name: "OpenAI - ChatGPT",
      type: "OPENAI",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o",
      configJson: { temperature: 0.4, maxTokens: 300, timeoutMs: 8000 },
      isActive: true,
      createdAt,
      updatedAt: createdAt
    }
  ];

  let aiProviders = defaultAiProviders;
  try {
    aiProviders = JSON.parse(await readFile(aiProviderConfigPath, "utf8")) as AiProviderConfig[];
  } catch {
    aiProviders = defaultAiProviders;
  }

  const defaultDialogflowConfigs: DialogflowConfig[] = [
    {
      id: "df_mock",
      organizationId: defaultOrgId,
      name: "Dialogflow Thai Voice Bot",
      projectId: "",
      location: "global",
      agentId: "",
      languageCode: "th-TH",
      voiceName: "th-TH-Standard-A",
      isActive: true,
      status: "not-configured",
      createdAt,
      updatedAt: createdAt
    }
  ];

  let dialogflowConfigs = defaultDialogflowConfigs;
  try {
    dialogflowConfigs = JSON.parse(await readFile(dialogflowConfigPath, "utf8")) as DialogflowConfig[];
  } catch {
    dialogflowConfigs = defaultDialogflowConfigs;
  }

  return {
    organizations: [{ id: defaultOrgId, name: "Default Organization", slug: "default", isActive: true, createdAt, updatedAt: createdAt }],
    users: [
      {
        id: defaultUserId,
        organizationId: defaultOrgId,
        email: adminEmail,
        passwordHash,
        fullName: "Local Admin",
        role: "SUPER_ADMIN",
        isActive: true,
        mustChangePassword: process.env.DEFAULT_ADMIN_MUST_CHANGE === "true",
        failedLoginCount: 0,
        createdAt,
        updatedAt: createdAt
      }
    ],
    aiProviders,
    dialogflowConfigs,
    prompts: [
      {
        id: "prompt_support",
        organizationId: defaultOrgId,
        name: "Support Bot - System",
        systemPrompt: "คุณคือผู้ช่วยเสียงภาษาไทยสำหรับรับสายลูกค้า ตอบให้กระชับ สุภาพ และโอนหาเจ้าหน้าที่เมื่อไม่มั่นใจหรือผู้โทรร้องขอ",
        fallbackPrompt: "ขอโทษค่ะ ฉันยังไม่เข้าใจ สามารถโอนสายไปยังเมนูหลักหรือเจ้าหน้าที่ได้ค่ะ",
        language: "th-TH",
        version: 4,
        isActive: true,
        createdAt,
        updatedAt: createdAt
      }
    ],
    flows: [
      {
        id: "flow_inbound_support",
        organizationId: defaultOrgId,
        name: "Inbound Support Bot",
        description: "Main support line with AI, IVR fallback, and transfer.",
        status: "PUBLISHED",
        activeVersionId: "flowver_support_v3",
        graphJson: sampleGraph,
        createdBy: defaultUserId,
        createdAt,
        updatedAt: createdAt
      }
    ],
    sessions: [],
    executionLogs: [],
    transcripts: [],
    providerLogs: [],
    asteriskConfigs,
    auditLogs: [
      {
        id: uuid(),
        organizationId: defaultOrgId,
        userId: defaultUserId,
        action: "seed.default_admin",
        entityType: "User",
        entityId: defaultUserId,
        correlationId: "seed",
        createdAt
      }
    ]
  };
}

export async function persistAsteriskConfigs(configs: StoredAsteriskConfig[]) {
  await mkdir(path.dirname(asteriskConfigPath), { recursive: true });
  await writeFile(asteriskConfigPath, `${JSON.stringify(configs, null, 2)}\n`, "utf8");
}

export async function persistAiProviders(configs: AiProviderConfig[]) {
  await mkdir(path.dirname(aiProviderConfigPath), { recursive: true });
  await writeFile(aiProviderConfigPath, `${JSON.stringify(configs, null, 2)}\n`, "utf8");
}

export async function persistDialogflowConfigs(configs: DialogflowConfig[]) {
  await mkdir(path.dirname(dialogflowConfigPath), { recursive: true });
  await writeFile(dialogflowConfigPath, `${JSON.stringify(configs, null, 2)}\n`, "utf8");
}
