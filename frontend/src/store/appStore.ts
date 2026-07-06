import { create } from "zustand";
import type { AuthUser, CallSession, ExecutionLog } from "../types/domain";

export type Screen =
  | "dashboard"
  | "flows"
  | "builder"
  | "simulate"
  | "sessions"
  | "detail"
  | "providers"
  | "knowledge"
  | "prompts"
  | "dialogflow"
  | "asterisk"
  | "users"
  | "audit"
  | "settings"
  | "backup";

interface AppState {
  user: AuthUser | null;
  screen: Screen;
  selectedSession?: CallSession;
  selectedFlowId?: string;
  latestLogs: ExecutionLog[];
  setUser: (user: AuthUser | null) => void;
  setScreen: (screen: Screen) => void;
  setSelectedSession: (session?: CallSession) => void;
  setSelectedFlowId: (flowId?: string) => void;
  setLatestLogs: (logs: ExecutionLog[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  screen: "dashboard",
  latestLogs: [],
  setUser: (user) => set({ user }),
  setScreen: (screen) => set({ screen }),
  setSelectedSession: (selectedSession) => set({ selectedSession }),
  setSelectedFlowId: (selectedFlowId) => set({ selectedFlowId }),
  setLatestLogs: (latestLogs) => set({ latestLogs })
}));
