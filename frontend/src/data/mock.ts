import {
  Activity,
  Bot,
  Boxes,
  Brain,
  Clock,
  Database,
  GitBranch,
  Grid2X2,
  Hash,
  List,
  MessageSquare,
  Mic,
  Phone,
  Play,
  Settings,
  Shield,
  Sparkles,
  BookOpen,
  Users,
  Wrench,
  type LucideIcon
} from "lucide-react";
import type { Screen } from "../store/appStore";

export const navGroups: Array<{ title: string; items: Array<{ id: Screen; label: string; icon: LucideIcon; badge?: string }> }> = [
  { title: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: Grid2X2 }] },
  {
    title: "Flow Builder",
    items: [
      { id: "flows", label: "Flows", icon: GitBranch },
      { id: "builder", label: "Open builder", icon: Boxes },
      { id: "simulate", label: "Simulation", icon: Play }
    ]
  },
  { title: "Operations", items: [{ id: "sessions", label: "Call sessions", icon: List, badge: "7" }] },
  {
    title: "AI configuration",
    items: [
      { id: "providers", label: "AI providers", icon: Sparkles },
      { id: "knowledge", label: "Knowledge bases", icon: BookOpen },
      { id: "prompts", label: "Prompts", icon: MessageSquare }
    ]
  },
  {
    title: "Voice configuration",
    items: [
      { id: "dialogflow", label: "Dialogflow", icon: Mic },
      { id: "asterisk", label: "FreePBX / Asterisk", icon: Phone }
    ]
  },
  {
    title: "Administration",
    items: [
      { id: "users", label: "Users & roles", icon: Users },
      { id: "audit", label: "Audit logs", icon: Shield },
      { id: "settings", label: "System settings", icon: Settings },
      { id: "backup", label: "Backup & maintenance", icon: Database }
    ]
  }
];

export const pageMeta: Record<Screen, [string, string]> = {
  dashboard: ["Overview", "Dashboard"],
  flows: ["Flow Builder", "Flows"],
  builder: ["Flow Builder", "Inbound Support Bot"],
  simulate: ["Flow Builder", "Simulate call"],
  sessions: ["Operations", "Call sessions"],
  detail: ["Operations", "Call detail"],
  providers: ["AI configuration", "AI providers"],
  knowledge: ["AI configuration", "Knowledge bases"],
  prompts: ["AI configuration", "Prompts"],
  dialogflow: ["Voice configuration", "Dialogflow"],
  asterisk: ["Voice configuration", "FreePBX / Asterisk"],
  users: ["Administration", "Users & roles"],
  audit: ["Administration", "Audit logs"],
  settings: ["Administration", "System settings"],
  backup: ["Administration", "Backup & maintenance"]
};

export const palette = [
  { cat: "Basic", items: [{ label: "Start", icon: Play, tone: "green" }, { label: "Hangup", icon: Phone, tone: "red" }] },
  { cat: "AI & Voice", items: [{ label: "Voice Bot", icon: Bot, tone: "teal" }] },
  { cat: "IVR", items: [{ label: "IVR Menu", icon: Hash, tone: "indigo" }, { label: "DTMF Input", icon: Wrench, tone: "indigo" }] },
  { cat: "Logic", items: [{ label: "Condition", icon: GitBranch, tone: "amber" }, { label: "Business Hours", icon: Clock, tone: "amber" }] },
  { cat: "Integration", items: [{ label: "Webhook / API", icon: Activity, tone: "violet" }] },
  { cat: "Routing", items: [{ label: "Transfer", icon: Phone, tone: "indigo" }, { label: "Fallback", icon: Shield, tone: "indigo" }] }
];

export const users = [
  { initials: "RA", name: "Rania A.", email: "rania@northwind.io", role: "SUPER_ADMIN", tone: "violet", last: "now", status: "Active" },
  { initials: "DK", name: "Daniel K.", email: "daniel@northwind.io", role: "ADMIN", tone: "indigo", last: "12m ago", status: "Active" },
  { initials: "MP", name: "Maria P.", email: "maria@northwind.io", role: "FLOW_DESIGNER", tone: "teal", last: "1h ago", status: "Active" },
  { initials: "JT", name: "Jamal T.", email: "jamal@northwind.io", role: "OPERATOR", tone: "amber", last: "3h ago", status: "Active" },
  { initials: "SL", name: "Sofia L.", email: "sofia@northwind.io", role: "VIEWER", tone: "gray", last: "2d ago", status: "Invited" }
];

export const nodeTone: Record<string, string> = {
  green: "var(--green)",
  teal: "var(--teal)",
  indigo: "var(--indigo)",
  amber: "var(--amber)",
  red: "var(--red)",
  violet: "var(--violet)",
  gray: "var(--ink3)"
};
