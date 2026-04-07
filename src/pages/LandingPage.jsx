import { useState } from "react";
import "../styles/landing.css";
import { LogoIcon, MenuIcon, SearchIcon, KnowledgeGraph } from "../components/Icons";

export default function LandingPage({ onGetStarted, onLogin, onPricing, onFeatures, onHowItWorks, onAbout }) {
  const [searchVal, setSearchVal] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleGenerate = () => {
    if (searchVal.trim()) onGetStarted(searchVal.trim());
    else onGetStarted("");
  };

  const cards = [
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2L14 8H20L15.5 12L17 18L11 14.5L5 18L6.5 12L2 8H8L11 2Z" fill="white" /></svg>,
      title: "Path Generation",
      desc: "Input any topic and our AI builds a custom visual roadmap tailored to your existing knowledge and desired depth.",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="3" fill="white" />
          {[[3,11],[19,11],[11,3],[11,19]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2" fill="white" opacity="0.8"/>)}
          <line x1="5" y1="11" x2="8" y2="11" stroke="white" strokeWidth="1.5"/>
          <line x1="14" y1="11" x2="17" y2="11" stroke="white" strokeWidth="1.5"/>
          <line x1="11" y1="5" x2="11" y2="8" stroke="white" strokeWidth="1.5"/>
          <line x1="11" y1="14" x2="11" y2="17" stroke="white" strokeWidth="1.5"/>
        </svg>
      ),
      title: "Interactive Learning",
      desc: "Engage with dynamic nodes that adapt to your pace, providing instant visualizations, quizzes, and summaries on the fly.",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="10" cy="10" r="6" stroke="white" strokeWidth="2"/>
          <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="7" y1="10" x2="13" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="10" y1="7" x2="10" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      title: "Deep Dives",
      desc: "Zoom into specific concepts for comprehensive explanations, source citations, and high-fidelity video tutorials.",
    },
  ];

  const navItems = ["How it works", "Features", "Pricing", "About"]; 

  return (
    <div className="page-enter">
      {/* NAV */}
      <nav className="np-nav">
        <div className="np-logo">
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <ul className="np-nav-links">
          {navItems.map(l => (
            <li key={l}>
              <a
                href="#"
                onClick={e => {
                  e.preventDefault();
                  if (l === "How it works" && onHowItWorks) onHowItWorks();
                  if (l === "Features" && onFeatures) onFeatures();
                  if (l === "Pricing" && onPricing) onPricing();
                  if (l === "About" && onAbout) onAbout();
                }}
              >
                {l}
              </a>
            </li>
          ))}
        </ul>
        <div className="np-nav-right">
          <button
            className="btn-ghost"
            onClick={() => onLogin && onLogin()}
          >
            Log In
          </button>
          <button className="btn-blue" onClick={() => onGetStarted("")}>Try NeuroPath</button>
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
        {navItems.map(l => (
          <a
            key={l}
            href="#"
            onClick={e => {
              e.preventDefault();
              setMobileNavOpen(false);
              if (l === "How it works" && onHowItWorks) onHowItWorks();
              if (l === "Features" && onFeatures) onFeatures();
              if (l === "Pricing" && onPricing) onPricing();
              if (l === "About" && onAbout) onAbout();
            }}
          >
            {l}
          </a>
        ))}
      </div>

      {/* HERO */}
      <section>
        <div className="lp-hero">
          <div>
            <div className="badge fu d1"><span className="badge-dot" />Personalized Learning</div>
            <h1 className="lp-h1 fu d2">Learn anything,<br /><span className="accent">visually.</span></h1>
            <p className="lp-sub fu d3">
              NeuroPath uses AI to transform complex topics into interactive learning maps, making deep understanding faster and more intuitive than ever before.
            </p>
            <div className="search-wrap fu d4">
              <SearchIcon />
              <input
                className="search-input"
                placeholder="What do you want to learn today?"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGenerate()}
              />
              <button className="btn-gen" onClick={handleGenerate}>Generate</button>
            </div>
            <div className="popular-row fu d5">
              <span className="pop-label">Popular:</span>
              {["Quantum Computing", "French Revolution", "Neuroplasticity"].map(t => (
                <span key={t} className="pop-tag" onClick={() => setSearchVal(t)}>{t}</span>
              ))}
            </div>
          </div>
          <div className="graph-card fu d3">
            <div className="graph-canvas"><KnowledgeGraph /></div>
            <p className="graph-caption">Generating visual roadmap for "Machine Learning Fundamentals"...</p>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="process">
        <div className="process-inner">
          <p className="sec-label">The Process</p>
          <h2 className="sec-title">Master any subject in three steps</h2>
          <p className="sec-sub">Our AI orchestrates your learning journey by breaking down barriers between concepts.</p>
          <div className="cards-grid">
            {cards.map((c, i) => (
              <div key={i} className="feat-card">
                <div className="feat-icon">{c.icon}</div>
                <h3 className="feat-title">{c.title}</h3>
                <p className="feat-desc">{c.desc}</p>
                <a href="#" className="learn-more">Learn more →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2 className="cta-title">Ready to visualize your knowledge?</h2>
        <p className="cta-sub">Join thousands of learners mapping their way to mastery. Start exploring any topic for free today.</p>
        <div className="cta-btns">
          <button className="btn-lg btn-lg-blue" onClick={() => onGetStarted("")}>Start Learning For Free</button>
          <button className="btn-lg btn-lg-outline" onClick={() => onGetStarted("Machine Learning Fundamentals")}>
            View Demo Path
          </button>
        </div>
        <p className="cta-note">No credit card required. Unlimited public paths.</p>
      </section>

      {/* FOOTER */}
      <footer className="np-footer">
        <div className="np-logo">
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <ul className="footer-links">
          {["Privacy","Terms","Contact","Careers"].map(l => (
            <li key={l}><a href="#">{l}</a></li>
          ))}
        </ul>
        <div className="social-row">
          <button className="social-btn">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7.5 1.5c-2 2-2 8 0 12M7.5 1.5c2 2 2 8 0 12M1.5 7.5h12" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>
          <button className="social-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 1.5l4.2 5.2L1.5 12.5h1.4L6.4 7.6l3.6 4.9H13L8.6 6.5 13 1.5h-1.4L7.8 6l-3.4-4.5H1.5Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div className="footer-copy">© 2026 NeuroPath AI Inc. All rights reserved. Mapping human knowledge, one node at a time.</div>
      </footer>
    </div>
  );
}
