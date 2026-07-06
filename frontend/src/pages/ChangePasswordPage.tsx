import { useState } from "react";
import type { FormEvent } from "react";
import { api, saveTokens } from "../api/client";
import { useAppStore } from "../store/appStore";

export function ChangePasswordPage() {
  const { setUser } = useAppStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const { data } = await api.post("/auth/change-password", { currentPassword, newPassword });
      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Password change failed");
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1 style={{ fontSize: 18, margin: "0 0 6px" }}>Change password</h1>
        <p className="subtle" style={{ fontSize: 13, margin: "0 0 20px" }}>
          Your admin account must change password before configuring the system.
        </p>
        <label className="label">Current password</label>
        <input className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        <div style={{ height: 14 }} />
        <label className="label">New password</label>
        <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        {message ? <div className="badge amber" style={{ marginTop: 14 }}>{message}</div> : null}
        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "10px 12px" }}>
          Save password
        </button>
      </form>
    </div>
  );
}
