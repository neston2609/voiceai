import crypto from "node:crypto";
import dgram, { type RemoteInfo } from "node:dgram";
import type { TelephonyConnection } from "../../types.js";
import { decryptSecret } from "../../common/crypto/encryption.js";

type RegisterResult = {
  ok: boolean;
  statusCode?: number;
  message: string;
  registeredAt?: string;
};

type SipRegisterOptions = {
  onRequest?: (message: string, socket: dgram.Socket, remote: RemoteInfo) => void;
};

const sockets = new Map<string, dgram.Socket>();

function randomBranch() {
  return `z9hG4bK-${crypto.randomBytes(9).toString("hex")}`;
}

function randomTag() {
  return crypto.randomBytes(6).toString("hex");
}

function parseStatus(response: string) {
  const match = response.match(/^SIP\/2\.0\s+(\d{3})\s+(.+)$/m);
  return { code: match ? Number(match[1]) : 0, reason: match?.[2]?.trim() ?? "Unknown response" };
}

function parseHeader(response: string, name: string) {
  const regex = new RegExp(`^${name}:\\s*(.+)$`, "im");
  return response.match(regex)?.[1]?.trim();
}

function parseDigestChallenge(header?: string) {
  if (!header) return undefined;
  const challenge = Object.fromEntries(
    Array.from(header.matchAll(/(\w+)="?([^",]+)"?/g)).map((match) => [match[1], match[2]])
  );
  if (!challenge.realm || !challenge.nonce) return undefined;
  return challenge as { realm: string; nonce: string; qop?: string; algorithm?: string; opaque?: string };
}

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function buildDigestAuthorization(input: {
  username: string;
  password: string;
  method: string;
  uri: string;
  challenge: { realm: string; nonce: string; qop?: string; opaque?: string };
}) {
  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");
  const ha1 = md5(`${input.username}:${input.challenge.realm}:${input.password}`);
  const ha2 = md5(`${input.method}:${input.uri}`);
  const qop = input.challenge.qop?.split(",").map((item) => item.trim()).includes("auth") ? "auth" : undefined;
  const response = qop
    ? md5(`${ha1}:${input.challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${input.challenge.nonce}:${ha2}`);
  const parts = [
    `Digest username="${input.username}"`,
    `realm="${input.challenge.realm}"`,
    `nonce="${input.challenge.nonce}"`,
    `uri="${input.uri}"`,
    `response="${response}"`,
    "algorithm=MD5"
  ];
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  if (input.challenge.opaque) parts.push(`opaque="${input.challenge.opaque}"`);
  return parts.join(", ");
}

function buildRegisterMessage(connection: TelephonyConnection, localAddress: string, localPort: number, cseq: number, authorization?: string) {
  const uri = `sip:${connection.host}`;
  const extension = connection.extension || connection.username;
  const fromTag = randomTag();
  const callId = `${crypto.randomBytes(10).toString("hex")}@voiceai`;
  const lines = [
    `REGISTER ${uri} SIP/2.0`,
    `Via: SIP/2.0/UDP ${localAddress}:${localPort};branch=${randomBranch()};rport`,
    "Max-Forwards: 70",
    `From: <sip:${extension}@${connection.host}>;tag=${fromTag}`,
    `To: <sip:${extension}@${connection.host}>`,
    `Call-ID: ${callId}`,
    `CSeq: ${cseq} REGISTER`,
    `Contact: <sip:${extension}@${localAddress}:${localPort};transport=udp>`,
    `Expires: 300`,
    `User-Agent: VoiceAI-Bot/1.0`,
    authorization ? `Authorization: ${authorization}` : undefined,
    "Content-Length: 0",
    "",
    ""
  ].filter((line): line is string => Boolean(line));
  return lines.join("\r\n");
}

export function getSipSocket(connectionId: string) {
  return sockets.get(connectionId);
}

function sendAndWait(socket: dgram.Socket, message: string, port: number, host: string) {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for SIP response from ${host}:${port}`));
    }, 6000);
    const onMessage = (buffer: Buffer) => {
      if (!buffer.toString("utf8").startsWith("SIP/2.0")) return;
      cleanup();
      resolve(buffer.toString("utf8"));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
    };
    socket.on("message", onMessage);
    const packet = Buffer.from(message);
    socket.send(packet, 0, packet.length, port, host, (error) => {
      if (error) {
        cleanup();
        reject(error);
      }
    });
  });
}

async function getLocalAddressFor(host: string, port: number) {
  const socket = dgram.createSocket("udp4");
  try {
    await new Promise<void>((resolve) => socket.bind(0, resolve));
    socket.connect(port, host);
    const local = socket.address();
    return typeof local === "object" ? local.address : "127.0.0.1";
  } finally {
    socket.close();
  }
}

export async function registerSipConnection(connection: TelephonyConnection, options: SipRegisterOptions = {}): Promise<RegisterResult> {
  if (connection.type !== "SIP") {
    return { ok: false, message: "SIP registration is only available for SIP connections." };
  }
  if (connection.transport !== "UDP") {
    return { ok: false, message: "Current SIP register implementation supports UDP transport." };
  }
  if (!connection.encryptedPassword) {
    return { ok: false, message: "SIP password is not configured." };
  }

  sockets.get(connection.id)?.close();
  const socket = dgram.createSocket("udp4");
  sockets.set(connection.id, socket);
  await new Promise<void>((resolve) => socket.bind(0, resolve));
  const local = socket.address();
  const localPort = typeof local === "object" ? local.port : 0;
  const port = connection.port || 5060;
  const localAddress = await getLocalAddressFor(connection.host, port);
  const first = buildRegisterMessage(connection, localAddress, localPort, 1);
  const firstResponse = await sendAndWait(socket, first, port, connection.host);
  const firstStatus = parseStatus(firstResponse);

  if (firstStatus.code === 200) {
    return { ok: true, statusCode: 200, message: `SIP extension ${connection.extension} registered at ${connection.host}:${port}.`, registeredAt: new Date().toISOString() };
  }

  if (![401, 407].includes(firstStatus.code)) {
    return { ok: false, statusCode: firstStatus.code, message: `SIP registrar returned ${firstStatus.code} ${firstStatus.reason}.` };
  }

  const challenge = parseDigestChallenge(parseHeader(firstResponse, firstStatus.code === 407 ? "Proxy-Authenticate" : "WWW-Authenticate"));
  if (!challenge) {
    return { ok: false, statusCode: firstStatus.code, message: "SIP registrar requested authentication but did not include a digest challenge." };
  }

  const password = decryptSecret(connection.encryptedPassword);
  const authorization = buildDigestAuthorization({
    username: connection.username,
    password,
    method: "REGISTER",
    uri: `sip:${connection.host}`,
    challenge
  });
  const second = buildRegisterMessage(connection, localAddress, localPort, 2, authorization);
  const secondResponse = await sendAndWait(socket, second, port, connection.host);
  const secondStatus = parseStatus(secondResponse);
  if (secondStatus.code !== 200) {
    return { ok: false, statusCode: secondStatus.code, message: `SIP registration failed: ${secondStatus.code} ${secondStatus.reason}.` };
  }
  if (options.onRequest) {
    socket.on("message", (buffer, remote) => {
      const text = buffer.toString("utf8");
      if (text.startsWith("SIP/2.0")) return;
      options.onRequest?.(text, socket, remote);
    });
  }
  return { ok: true, statusCode: 200, message: `SIP extension ${connection.extension} registered at ${connection.host}:${port}.`, registeredAt: new Date().toISOString() };
}
