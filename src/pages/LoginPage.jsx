import { useState } from "react";
import "../styles/pages.css";
import { LogoIcon } from "../components/Icons";

export default function LoginPage({ onBack, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (onLoginSuccess) onLoginSuccess();
    }, 800);
  };

  return (
    <div className="page-enter">
      {/* NAV */}
      <nav className="np-nav">
        <div className="np-logo" onClick={onBack} style={{ cursor: "pointer" }}>
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="login-wrap">
        <div className="login-card fu d3">
          <h1 className="login-title">Welcome</h1>
          <p className="login-sub">Sign in to access your personalized learning paths.</p>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Email</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              />
            </div>

            <div className="login-meta-row">
              <span>
                <input type="checkbox" id="remember" style={{ marginRight: 6 }} />
                <label htmlFor="remember">Remember me</label>
              </span>
              <span className="login-link">Forgot password?</span>
            </div>

            <button
              type="submit"
              className="btn-login-primary"
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? "Signing you in..." : "Log In"}
            </button>
          </form>

          <div className="login-footer">
            Don’t have an account? <span className="login-link">Sign up</span>
          </div>
        </div>
      </div>
    </div>
  );
}
