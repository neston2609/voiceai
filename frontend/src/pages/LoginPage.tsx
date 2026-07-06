import { useState } from "react";
import type { FormEvent } from "react";
import { Mic } from "lucide-react";
import { api, saveTokens } from "../api/client";
import { useAppStore } from "../store/appStore";

function loginErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string }; status?: number } }).response;
    if (response?.status === 401) return "Invalid email or password.";
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Login failed";
}

export function LoginPage() {
  const setUser = useAppStore((state) => state.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="inline" style={{ gap: 11, marginBottom: 24 }}>
          <div className="brand-mark">
            <Mic size={19} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>VoiceFlowAI</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Bot Flow Builder
            </div>
          </div>
        </div>
        <label className="label">Email</label>
        <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} type="text" autoComplete="username" />
        <div style={{ height: 14 }} />
        <label className="label">Password</label>
        <input className="input" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        {error ? <div className="badge red" style={{ marginTop: 14 }}>{error}</div> : null}
        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "10px 12px" }} disabled={loading}>
          {loading ? "Signing in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
