import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { api } from "./api/client";
import { Shell } from "./components/Shell";
import { pageMeta } from "./data/mock";
import { useAppStore } from "./store/appStore";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FlowListPage } from "./pages/FlowListPage";
import { LoginPage } from "./pages/LoginPage";
import { SimulateCallPage } from "./pages/SimulateCallPage";
import { SessionsPage } from "./pages/SessionsPage";
import { CallDetailPage } from "./pages/CallDetailPage";
import { AsteriskPage, DialogflowPage, GenericAdminPage, KnowledgeBasesPage, PromptsPage, ProvidersPage, UsersPage } from "./pages/ConfigurationPages";

const queryClient = new QueryClient();
const FlowBuilderPage = lazy(() => import("./pages/FlowBuilderPage").then((module) => ({ default: module.FlowBuilderPage })));

function ScreenRouter() {
  const screen = useAppStore((state) => state.screen);
  if (screen === "dashboard") return <DashboardPage />;
  if (screen === "flows") return <FlowListPage />;
  if (screen === "builder") return <Suspense fallback={<div className="page">Loading builder</div>}><FlowBuilderPage /></Suspense>;
  if (screen === "simulate") return <SimulateCallPage />;
  if (screen === "sessions") return <SessionsPage />;
  if (screen === "detail") return <CallDetailPage />;
  if (screen === "providers") return <ProvidersPage />;
  if (screen === "knowledge") return <KnowledgeBasesPage />;
  if (screen === "prompts") return <PromptsPage />;
  if (screen === "dialogflow") return <DialogflowPage />;
  if (screen === "asterisk") return <AsteriskPage />;
  if (screen === "users") return <UsersPage />;
  return <GenericAdminPage title={pageMeta[screen][1]} />;
}

export default function App() {
  const { user, setUser } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem("voicebot.accessToken");
    if (!token) return;
    api.get("/auth/me").then((response) => setUser(response.data.user)).catch(() => setUser(null));
  }, [setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      {!user ? <LoginPage /> : user.mustChangePassword ? <ChangePasswordPage /> : <Shell><ScreenRouter /></Shell>}
    </QueryClientProvider>
  );
}
