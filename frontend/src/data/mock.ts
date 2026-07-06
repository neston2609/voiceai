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
  prompts: ["AI configuration", "Prompts"],
  dialogflow: ["Voice configuration", "Dialogflow"],
  asterisk: ["Voice configuration", "FreePBX / Asterisk"],
  users: ["Administration", "Users & roles"],
  audit: ["Administration", "Audit logs"],
  settings: ["Administration", "System settings"],
  backup: ["Administration", "Backup & maintenance"]
};

export const kpis = [
  { label: "Total calls", value: "3,842", sub: "this week", delta: "+12%", tone: "green" },
  { label: "Bot resolved", value: "71%", sub: "2,728 calls", delta: "+4%", tone: "green" },
  { label: "Avg duration", value: "1m 52s", sub: "per call", delta: "-8s", tone: "green" },
  { label: "AI response", value: "0.9s", sub: "p50 latency", delta: "+0.1s", tone: "red" }
];

export const callChart = [
  { day: "Mon", resolved: 96, escalated: 34, failed: 12 },
  { day: "Tue", resolved: 110, escalated: 28, failed: 9 },
  { day: "Wed", resolved: 88, escalated: 40, failed: 16 },
  { day: "Thu", resolved: 120, escalated: 24, failed: 8 },
  { day: "Fri", resolved: 104, escalated: 36, failed: 14 },
  { day: "Sat", resolved: 70, escalated: 20, failed: 6 },
  { day: "Sun", resolved: 82, escalated: 26, failed: 10 }
];

export const flows = [
  { name: "Inbound Support Bot", desc: "Main support line - AI + IVR + escalate", status: "Published", tone: "green", nodes: 12, ver: "3", updated: "2d ago" },
  { name: "Billing IVR", desc: "Payments and invoice self-service", status: "Published", tone: "green", nodes: 9, ver: "2", updated: "5d ago" },
  { name: "After-hours Router", desc: "Business hours to voicemail or queue", status: "Draft", tone: "amber", nodes: 6, ver: "1", updated: "1h ago" },
  { name: "Sales Qualifier", desc: "Lead capture with CRM webhook", status: "Draft", tone: "amber", nodes: 8, ver: "1", updated: "3d ago" },
  { name: "Outage Notice", desc: "Static message and callback opt-in", status: "Published", tone: "green", nodes: 4, ver: "1", updated: "1w ago" },
  { name: "Survey Bot", desc: "Post-call CSAT collection", status: "Archived", tone: "gray", nodes: 5, ver: "2", updated: "2w ago" }
];

export const palette = [
  { cat: "Basic", items: [{ label: "Start", icon: Play, tone: "green" }, { label: "Hangup", icon: Phone, tone: "red" }] },
  { cat: "AI & Voice", items: [{ label: "Voice Bot", icon: Bot, tone: "teal" }] },
  { cat: "IVR", items: [{ label: "IVR Menu", icon: Hash, tone: "indigo" }, { label: "DTMF Input", icon: Wrench, tone: "indigo" }] },
  { cat: "Logic", items: [{ label: "Condition", icon: GitBranch, tone: "amber" }, { label: "Business Hours", icon: Clock, tone: "amber" }] },
  { cat: "Integration", items: [{ label: "Webhook / API", icon: Activity, tone: "violet" }] },
  { cat: "Routing", items: [{ label: "Transfer", icon: Phone, tone: "indigo" }, { label: "Fallback", icon: Shield, tone: "indigo" }] }
];

export const providerCards = [
  { name: "OpenAI", short: "AI", model: "gpt-4o", state: "Active", tone: "green", logo: "#0B7A5E" },
  { name: "Gemini", short: "G", model: "gemini-1.5-pro", state: "Standby", tone: "gray", logo: "#3B6CF6" },
  { name: "Claude", short: "C", model: "claude-3.5", state: "Standby", tone: "gray", logo: "#C96442" },
  { name: "Custom API", short: "{}", model: "Not configured", state: "Not set", tone: "gray", logo: "#54607A" }
];

export const prompts = [
  { name: "Support Bot - System", meta: "v4 - active", tag: "System", tone: "indigo" },
  { name: "Support Bot - Fallback", meta: "v2", tag: "Fallback", tone: "amber" },
  { name: "Billing IVR - System", meta: "v3", tag: "System", tone: "indigo" },
  { name: "Sales Qualifier", meta: "v1 - draft", tag: "Draft", tone: "gray" }
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
