import { useState } from "react";
import "../styles/features.css";
import { LogoIcon, MenuIcon } from "../components/Icons";

const NAV_ITEMS = ["How it works", "Features", "Pricing", "About"]; 

export default function FeaturesPage({ onBackToLanding, onGoToHowItWorks, onGoToPricing, onGoToAbout, onTryNeuroPath }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="page-enter">
      {/* NAV (shared marketing nav with Features highlighted) */}
      <nav className="np-nav">
        <div
          className="np-logo"
          onClick={onBackToLanding}
          style={{ cursor: "pointer" }}
        >
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <ul className="np-nav-links">
          {NAV_ITEMS.map(label => (
            <li key={label}>
              <a
                href="#"
                className={label === "Features" ? "np-nav-link-active" : undefined}
                onClick={e => {
                  e.preventDefault();
                  if (label === "How it works" && onGoToHowItWorks) onGoToHowItWorks();
                  if (label === "Pricing" && onGoToPricing) onGoToPricing();
                  if (label === "About" && onGoToAbout) onGoToAbout();
                  if (label !== "Pricing" && label !== "About" && label !== "Features" && label !== "How it works" && onBackToLanding) onBackToLanding();
                }}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="np-nav-right">
          <button
            className="btn-blue"
            onClick={() => {
              if (onTryNeuroPath) onTryNeuroPath();
            }}
          >
            Try NeuroPath
          </button>
          <button
            className="np-mobile-menu-toggle"
            onClick={() => setMobileNavOpen(open => !open)}
            aria-label="Toggle navigation menu"
          >
            <MenuIcon />
          </button>
        </div>
      </nav>

      {/* Mobile slide-out nav */}
      <div className={`np-mobile-menu${mobileNavOpen ? " open" : ""}`}>
        {NAV_ITEMS.map(label => (
          <a
            key={label}
            href="#"
            className={label === "Features" ? "np-nav-link-active" : undefined}
            onClick={e => {
              e.preventDefault();
              setMobileNavOpen(false);
              if (label === "How it works" && onGoToHowItWorks) onGoToHowItWorks();
              if (label === "Pricing" && onGoToPricing) onGoToPricing();
              if (label === "About" && onGoToAbout) onGoToAbout();
              if (label !== "Pricing" && label !== "About" && label !== "Features" && label !== "How it works" && onBackToLanding) onBackToLanding();
            }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <main className="features-wrap">
        <div className="features-inner fu d2">
          <header className="fu d1">
            <p className="features-kicker">Product</p>
            <h1 className="features-title">Features designed for deep, visual learning.</h1>
            <p className="features-subtitle">
              NeuroPath combines knowledge graphs, adaptive difficulty, and time-aware planning so every session moves
              you meaningfully closer to your goal.
            </p>
          </header>

          <section className="features-grid">
            <article className="feature-card fu d2">
              <div className="feature-label">Paths</div>
              <h2 className="feature-title">Interactive learning maps</h2>
              <p className="feature-body">
                See your topic as a graph, not a list. NeuroPath breaks concepts into connected nodes so you always know
                what came before, what comes next, and where to dive deeper.
              </p>
              <div className="feature-tag-row">
                <span className="feature-tag">Knowledge graph</span>
                <span className="feature-tag">Dynamic nodes</span>
              </div>
            </article>

            <article className="feature-card fu d3">
              <div className="feature-label">Adaptation</div>
              <h2 className="feature-title">Difficulty that matches you</h2>
              <p className="feature-body">
                Start from your current level and let NeuroPath tune the depth and pace. Beginner overviews or
                expert-level deep dives, all from the same topic.
              </p>
              <div className="feature-tag-row">
                <span className="feature-tag">Beginner → Expert</span>
                <span className="feature-tag">Adaptive</span>
              </div>
            </article>

            <article className="feature-card fu d4">
              <div className="feature-label">Focus</div>
              <h2 className="feature-title">Time-boxed learning blocks</h2>
              <p className="feature-body">
                Turn spare 30 minutes or a full 2-hour block into progress. NeuroPath structures nodes into sessions
                sized to your daily commitment.
              </p>
              <div className="feature-tag-row">
                <span className="feature-tag">30–120 min</span>
                <span className="feature-tag">Session-based</span>
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
