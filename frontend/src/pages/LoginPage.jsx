import { useState } from "react";
import "../styles/pages.css";
import { LogoIcon } from "../components/Icons";

export default function LoginPage({ onBack, onLoginSuccess, onSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      const urlEncodedData = new URLSearchParams();
      urlEncodedData.append('username', email);
      urlEncodedData.append('password', password);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: urlEncodedData
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        if (onLoginSuccess) onLoginSuccess(data.access_token);
      } else {
        alert(data.detail || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      alert('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container page-enter">
      {/* LEFT PANEL - BRANDING */}
      <div className="login-left-panel" style={{ alignItems: "center", textAlign: "center" }}>
        <div className="left-panel-content" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="left-panel-logo" style={{ flexDirection: "column", alignItems: "center", gap: "20px", justifyContent: "center" }}>
            <div className="left-panel-logo-icon" style={{ width: "100px", height: "100px" }}>
              <LogoIcon size={100} strokeWidth={2} />
            </div>
            <span style={{ fontSize: "42px", fontWeight: "800", fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}>NeuroPath</span>
          </div>

          <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="left-panel-title" style={{ fontSize: "18px", fontWeight: "700" }}>Master any path with AI precision</h1>
            <p className="left-panel-sub" style={{ margin: "0 auto" }}>The world's most advanced AI roadmap generator.</p>
          </div>

          <div className="left-panel-shapes" style={{ justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" fill="none" className="panel-shape"><path d="M12 3L4 19H20L12 3Z" /></svg>
            <svg viewBox="0 0 24 24" fill="none" className="panel-shape"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
            <svg viewBox="0 0 24 24" fill="none" className="panel-shape"><circle cx="12" cy="12" r="8" /></svg>
            <svg viewBox="0 0 24 24" fill="none" className="panel-shape" style={{ transform: "rotate(45deg)" }}><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
            <svg viewBox="0 0 24 24" fill="none" className="panel-shape"><path d="M12 2L2 22L12 18L22 22L12 2Z" /></svg>
            <svg viewBox="0 0 24 24" fill="none" className="panel-shape"><path d="M4 12L12 4L20 12L12 20L4 12Z" /></svg>
          </div>
        </div>

        <div className="left-panel-footer" style={{ justifyContent: "center" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }}></div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - FORM */}
      <div className="login-right-panel">
        <div className="login-form-container fu d2">
          <div className="form-header">
            <h2 className="form-title">Sign In</h2>
            <p className="form-sub">Welcome back! Please enter your details.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Email</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Password</label>
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="login-meta-row">
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="checkbox" id="remember" style={{ width: "16px", height: "16px", borderRadius: "4px", accentColor: "var(--blue)" }} />
                <span>Remember me</span>
              </label>
              <span className="login-link" style={{ fontSize: "13px" }}>Forgot password?</span>
            </div>

            <button
              type="submit"
              className="btn-login-primary"
              disabled={loading || !email.trim() || !password.trim()}
              style={{ padding: "14px", fontSize: "15px", fontWeight: "700" }}
            >
              {loading ? "Signing you in..." : "Sign In"}
            </button>
          </form>

          <div className="login-footer" style={{ marginTop: "40px" }}>
            Don't have an account? <span className="login-link" onClick={onSignUp} style={{ cursor: "pointer" }}>Sign up</span>
          </div>
        </div>
      </div>
    </div>
  );
}
