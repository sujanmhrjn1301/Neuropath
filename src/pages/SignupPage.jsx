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
          <h1 className="login-title">Create Account</h1>
          <p className="login-sub">Join NeuroPath and start learning today.</p>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Full Name</label>
              <input
                className="login-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
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
                minLength="6"
              />
            </div>
            
            <div className="login-field">
              <label className="login-label">Main Goal (Optional)</label>
              <input
                className="login-input"
                type="text"
                value={mainGoal}
                onChange={e => setMainGoal(e.target.value)}
                placeholder="e.g., Get an AI/ML Internship"
              />
            </div>
            
            <div className="login-field">
              <label className="login-label">Learning Preference (Optional)</label>
              <select 
                className="login-input" 
                value={learningPreference} 
                onChange={e => setLearningPreference(e.target.value)}
                style={{ padding: '0 16px', background: '#fff' }}
              >
                <option value="">Select a preference...</option>
                <option value="Visual learner">Visual learner</option>
                <option value="Uses analogies">Uses analogies</option>
                <option value="Theory first">Theory first</option>
                <option value="Hands-on practice">Hands-on practice</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-login-primary"
              disabled={loading || !name.trim() || !email.trim() || !password.trim()}
              style={{ marginTop: '24px' }}
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="login-footer">
            Already have an account? <span className="login-link" onClick={onLogin} style={{ cursor: "pointer" }}>Log In</span>
          </div>
        </div>
      </div>
    </div>
  );
}
