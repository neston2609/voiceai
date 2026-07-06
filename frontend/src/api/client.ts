import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("voicebot.accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["x-correlation-id"] = crypto.randomUUID();
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
