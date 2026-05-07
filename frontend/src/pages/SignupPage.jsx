import { useState } from "react";
import "../styles/pages.css";
import { LogoIcon } from "../components/Icons";

export default function SignupPage({ onBack, onSignupSuccess, onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [learningPreference, setLearningPreference] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password,
          main_goal: mainGoal,
          learning_preference: learningPreference
        })
      });
      const data = await response.json();

      if (response.ok) {
        alert(data.message + " Please sign in.");
        if (onSignupSuccess) onSignupSuccess();
      } else {
        alert(data.detail || 'Registration failed.');
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
            <h1 className="left-panel-title" style={{ fontSize: "18px", fontWeight: "700" }}>Join the future of learning</h1>
            <p className="left-panel-sub" style={{ margin: "0 auto" }}>Create your account and start your journey today.</p>
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
        <div className="signup-form-container fu d2">
          <div className="form-header">
            <h2 className="form-title">Create Account</h2>
            <p className="form-sub">Start your personalized learning path today.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Full Name</label>
              <input
                className="login-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Email</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
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
                minLength="6"
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="login-field" style={{ flex: 1.2 }}>
                <label className="login-label">Main Goal (Optional)</label>
                <input
                  className="login-input"
                  type="text"
                  value={mainGoal}
                  onChange={e => setMainGoal(e.target.value)}
                  placeholder="e.g., Get an Internship"
                />
              </div>

              <div className="login-field" style={{ flex: 1 }}>
                <label className="login-label">Preference (Optional)</label>
                <select
                  className="login-input"
                  value={learningPreference}
                  onChange={e => setLearningPreference(e.target.value)}
                  style={{
                    appearance: 'none',
                    background: 'var(--gray-light) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M2 4l4 4 4-4\' stroke=\'%236B7280\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E") no-repeat right 12px center'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Visual learner">Visual</option>
                  <option value="Uses analogies">Analogies</option>
                  <option value="Theory first">Theory</option>
                  <option value="Hands-on practice">Hands-on</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-login-primary"
              disabled={loading || !name.trim() || !email.trim() || !password.trim()}
              style={{ marginTop: '8px' }}
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="login-footer" style={{ marginTop: "16px" }}>
            Already have an account? <span className="login-link" onClick={onLogin} style={{ cursor: "pointer" }}>Log In</span>
          </div>
        </div>
      </div>
    </div>
  );
}
