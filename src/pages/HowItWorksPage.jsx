import "../styles/how-it-works.css";
import { LogoIcon, MenuIcon } from "../components/Icons";

const NAV_ITEMS = ["How it works", "Features", "Pricing", "About"]; 

export default function HowItWorksPage({ onBackToLanding, onGoToFeatures, onGoToPricing, onGoToAbout, onTryNeuroPath }) {
  return (
    <div className="page-enter">
      {/* NAV (shared marketing nav with How it works highlighted) */}
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
                className={label === "How it works" ? "np-nav-link-active" : undefined}
                onClick={e => {
                  e.preventDefault();
                  if (label === "Features" && onGoToFeatures) onGoToFeatures();
                  if (label === "Pricing" && onGoToPricing) onGoToPricing();
                  if (label === "About" && onGoToAbout) onGoToAbout();
                  // "How it works" is current page, so no-op
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
            onClick={() => {
              const menu = document.querySelector(".np-mobile-menu");
              if (!menu) return;
              menu.classList.toggle("open");
            }}
            aria-label="Toggle navigation menu"
          >
            <MenuIcon />
          </button>
        </div>
      </nav>

      {/* Simple mobile menu (reuses same labels) */}
      <div className="np-mobile-menu">
        {NAV_ITEMS.map(label => (
          <a
            key={label}
            href="#"
            className={label === "How it works" ? "np-nav-link-active" : undefined}
            onClick={e => {
              e.preventDefault();
              const menu = document.querySelector(".np-mobile-menu");
              if (menu) menu.classList.remove("open");
              if (label === "Features" && onGoToFeatures) onGoToFeatures();
              if (label === "Pricing" && onGoToPricing) onGoToPricing();
              if (label === "About" && onGoToAbout) onGoToAbout();
            }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <main className="hiw-wrap">
        <div className="hiw-inner fu d2">
          <header className="fu d1">
            <p className="hiw-kicker">How it works</p>
            <h1 className="hiw-title">From idea to visual learning path in minutes.</h1>
            <p className="hiw-subtitle">
              NeuroPath turns any topic into an adaptive, visual roadmap. Here&apos;s what happens behind the scenes every
              time you type a goal into the box.
            </p>
          </header>

          <section className="hiw-steps-grid">
            <div className="hiw-step-list fu d2">
              <article className="hiw-step">
                <div className="hiw-step-label">Step 1</div>
                <h2 className="hiw-step-title">You describe what you want to learn</h2>
                <p className="hiw-step-body">
                  Start with a topic, outcome, or even a rough idea (for example: 
                  
                  "machine learning fundamentals" or "how the brain forms memories"). NeuroPath reads your goal, time
                  budget, and preferred depth to understand where you&apos;re headed.
                </p>
              </article>

              <article className="hiw-step">
                <div className="hiw-step-label">Step 2</div>
                <h2 className="hiw-step-title">We generate a knowledge graph</h2>
                <p className="hiw-step-body">
                  Our models decompose your topic into connected concepts, prerequisites, and supporting resources. The
                  result is a visual map of nodes and edges that shows how ideas build on each other.
                </p>
              </article>

              <article className="hiw-step">
                <div className="hiw-step-label">Step 3</div>
                <h2 className="hiw-step-title">Nodes become sessions you can complete</h2>
                <p className="hiw-step-body">
                  Nodes are grouped into focused learning blocks that fit your schedule. Each session blends short
                  explanations, active recall, and optional deep dives so you leave with real understanding, not just
                  bookmarks.
                </p>
              </article>
            </div>

            <aside className="hiw-aside-card fu d3">
              <div className="hiw-aside-pill">Under the hood</div>
              <h2 className="hiw-aside-title">Built for visual, time-boxed learning</h2>
              <p className="hiw-aside-body">
                NeuroPath combines curriculum design, knowledge graphs, and AI to keep you in a deep-work state more
                often. Your paths update as you learn, so the map always reflects your current understanding.
              </p>

              <div className="hiw-aside-metric-row">
                <div className="hiw-aside-metric">
                  <div className="hiw-aside-metric-label">Session length</div>
                  <div className="hiw-aside-metric-value">30–120 min</div>
                </div>
                <div className="hiw-aside-metric">
                  <div className="hiw-aside-metric-label">Modes</div>
                  <div className="hiw-aside-metric-value">Explore · Practice · Review</div>
                </div>
              </div>

              <p className="hiw-footer-note">
                Ready to see it in action? Click Try NeuroPath to generate your first path.
              </p>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
