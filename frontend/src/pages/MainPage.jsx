import { useState } from "react";
import "../styles/pages.css";
import { LogoIcon } from "../components/Icons";

export default function MainPage({ initialGoal, onBack, onGenerate, onGoToDashboard, user, onLogout }) {
  const [goal, setGoal] = useState(initialGoal || "");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [commitment, setCommitment] = useState("30 - 60 mins (Steady)");
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const POPULAR = ["Machine Learning", "Digital Photography", "Public Speaking", "Investment Banking"];
  const DIFFICULTY = ["Beginner", "Intermediate", "Expert"];
  const COMMITMENTS = [
    "< 15 mins (Light)",
    "15 - 30 mins (Casual)",
    "30 - 60 mins (Steady)",
    "1 - 2 hrs (Intensive)",
    "2+ hrs (Immersive)",
  ];

  const handleGenerate = () => {
    if (!goal.trim()) return;
    if (onGenerate) onGenerate(goal, difficulty, commitment);
  };

  return (
    <div className="page-enter" onClick={() => setShowDropdown(false)}>
      {/* NAV */}
      <nav className="np-nav">
        <div className="np-logo" onClick={onBack} style={{ cursor: "pointer" }}>
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <div className="np-nav-right" style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative" }}>
          <button
            onClick={onGoToDashboard}
            style={{
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#475569",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => { e.target.style.background = "#e2e8f0"; }}
            onMouseOut={(e) => { e.target.style.background = "#f1f5f9"; }}
          >
            Go to Dashboard
          </button>
          
          <div 
            onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "12px", transition: "background 0.2s" }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
              {user ? user.name : "Guest"}
            </span>
            <div className="avatar" style={{ border: showDropdown ? "2px solid #5A72F6" : "2px solid transparent" }}>👤</div>
          </div>

          {/* DROPDOWN MENU */}
          {showDropdown && (
            <div style={{
              position: "absolute",
              top: "50px",
              right: "0",
              width: "200px",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
              border: "1px solid #e2e8f0",
              padding: "8px",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              gap: "2px"
            }}>
              <div className="dropdown-item" onClick={() => {}}>👤 My Account</div>
              <div className="dropdown-item" onClick={onGoToDashboard}>🎯 My Paths</div>
              <div className="dropdown-item" onClick={onGoToDashboard}>📊 Dashboard</div>
              <div className="dropdown-item" onClick={() => {}}>⚙️ Settings</div>
              <div style={{ height: "1px", background: "#f1f5f9", margin: "4px 0" }} />
              <div className="dropdown-item" onClick={onLogout} style={{ color: "#ef4444" }}>🚪 Logout</div>
            </div>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="mp-wrap">
        <h1 className="mp-heading fu d1">Where do you want to go?</h1>
        <p className="mp-sub fu d2">Let our AI build your personalized roadmap.</p>

        <div className="mp-card fu d3">
          {/* Learning goal textarea */}
          <p className="mp-field-label">Your Learning Goal</p>
          <textarea
            className="mp-textarea"
            placeholder="e.g., Master Quantum Computing fundamentals or become a Senior UI Designer"
            value={goal}
            onChange={e => setGoal(e.target.value)}
          />

          {/* Difficulty + Commitment row */}
          <div className="mp-row">
            <div className="mp-col">
              <p className="mp-col-label">Difficulty Level</p>
              <div className="diff-group">
                {DIFFICULTY.map(d => (
                  <button
                    key={d}
                    className={`diff-btn${difficulty === d ? " active" : ""}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="mp-col">
              <p className="mp-col-label">Daily Commitment</p>
              <select
                className="mp-select"
                value={commitment}
                onChange={e => setCommitment(e.target.value)}
              >
                {COMMITMENTS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Generate button */}
          <button
            className="btn-generate-main"
            onClick={handleGenerate}
            disabled={loading || !goal.trim()}
          >
            {loading ? (
              <>
                <div className="spinner" /> Generating your path...
              </>
            ) : (
              <>✦ Generate My Path</>
            )}
          </button>
          <p className="mp-hint">NeuroPath analyzes 10,000+ resources to curate the most efficient sequence for your goal.</p>
        </div>

        {/* Popular starting points */}
        <div className="mp-popular fu d4">
          <p className="mp-popular-label">Popular Starting Points</p>
          <div className="mp-tags">
            {POPULAR.map(t => (
              <button key={t} className="mp-tag" onClick={() => setGoal(t)}>{t}</button>
            ))}
          </div>
        </div>

        {/* Trust signals */}
        {/* <div className="mp-trust fu d5">
          <div className="mp-trust-item">
            <span className="mp-trust-icon">✓</span>Verified Sources
          </div>
          <div className="mp-trust-item">
            <span className="mp-trust-icon">✓</span>Real-time Updates
          </div>
        </div>
        <p className="mp-copy">© 2026 NeuroPath AI. All rights reserved.</p> */}
      </div>
    </div>
  );
}
