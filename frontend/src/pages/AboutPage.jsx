import "../styles/about.css";
import { LogoIcon, MenuIcon } from "../components/Icons";

const NAV_ITEMS = ["How it works", "Features", "Pricing", "About"]; 

export default function AboutPage({ onBackToLanding, onGoToHowItWorks, onGoToFeatures, onGoToPricing, onTryNeuroPath }) {
  return (
    <div className="page-enter">
      {/* NAV (shared marketing nav with About highlighted) */}
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
                className={label === "About" ? "np-nav-link-active" : undefined}
                onClick={e => {
                  e.preventDefault();
                  if (label === "How it works" && onGoToHowItWorks) onGoToHowItWorks();
                  if (label === "Features" && onGoToFeatures) onGoToFeatures();
                  if (label === "Pricing" && onGoToPricing) onGoToPricing();
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
            className={label === "About" ? "np-nav-link-active" : undefined}
            onClick={e => {
              e.preventDefault();
              const menu = document.querySelector(".np-mobile-menu");
              if (menu) menu.classList.remove("open");
              if (label === "How it works" && onGoToHowItWorks) onGoToHowItWorks();
              if (label === "Features" && onGoToFeatures) onGoToFeatures();
              if (label === "Pricing" && onGoToPricing) onGoToPricing();
              if (label !== "Pricing" && label !== "About" && label !== "Features" && label !== "How it works" && onBackToLanding) onBackToLanding();
            }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <main className="about-wrap">
        <div className="about-inner fu d2">
          <div className="fu d1">
            <p className="about-kicker">About NeuroPath</p>
            <h1 className="about-title">Mapping human knowledge, one learner at a time.</h1>
            <p className="about-subtitle">
              NeuroPath is an AI-native learning studio. We turn complex topics into interactive maps so that
              motivated learners can see where they are, where they are going, and what truly moves the needle.
            </p>
          </div>

          <div className="about-grid">
            <section className="about-body fu d2">
              <h2 className="about-section-title">Why we built NeuroPath</h2>
              <p>
                Most learning tools still think in chapters and playlists. But real understanding is a graph: concepts
                connect, branch, and reinforce each other. NeuroPath was created to make that invisible structure visible.
              </p>
              <p>
                By combining large language models with high-quality learning signals, we generate visual paths that adapt
                to your goal, background, and time constraints. Instead of guessing what to learn next, you always know
                the next best node.
              </p>
              <p>
                Our mission is simple: reduce the distance between curiosity and competence for millions of learners around
                the world.
              </p>
            </section>

            <aside className="about-highlight-card fu d3">
              <div className="about-pill">Built for visual learners</div>
              <p className="about-body">
                NeuroPath blends curriculum design, knowledge graphs, and AI to keep you in a deep-work state more often.
              </p>
              <div className="about-metrics">
                <div className="about-metric">
                  <div className="about-metric-label">Focus blocks</div>
                  <div className="about-metric-value">30–120 min</div>
                </div>
                <div className="about-metric">
                  <div className="about-metric-label">Learning modes</div>
                  <div className="about-metric-value">Explore · Practice · Review</div>
                </div>
              </div>
              <p className="about-footer-note">
                Early access features may evolve as we learn from our first cohort of learners.
              </p>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
