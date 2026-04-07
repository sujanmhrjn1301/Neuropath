import { useState } from "react";
import "../styles/pages.css";
import { LogoIcon } from "../components/Icons";

export default function MainPage({ initialGoal, onBack }) {
  const [goal, setGoal] = useState(initialGoal || "");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [commitment, setCommitment] = useState("30 - 60 mins (Steady)");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="page-enter">
      {/* NAV */}
      <nav className="np-nav">
        <div className="np-logo" onClick={onBack} style={{ cursor: "pointer" }}>
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <div className="np-nav-right">
          <span style={{ fontSize: 14, color: "var(--gray)", marginRight: 6 }}>My Paths</span>
          <div className="avatar">👤</div>
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
