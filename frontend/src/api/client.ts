import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"
});

function createCorrelationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("voicebot.accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["x-correlation-id"] = createCorrelationId();
  return config;
});

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("voicebot.accessToken", accessToken);
  localStorage.setItem("voicebot.refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("voicebot.accessToken");
  localStorage.removeItem("voicebot.refreshToken");
}
