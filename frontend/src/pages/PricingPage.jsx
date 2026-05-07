import { useState } from "react";
import "../styles/pages.css";
import { LogoIcon, MenuIcon } from "../components/Icons";

export default function PricingPage({ onBack, onSelectPlan, onGoToHowItWorks, onGoToFeatures, onGoToAbout }) {
  const [billing, setBilling] = useState("monthly"); // "monthly" | "yearly"
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = ["How it works", "Features", "Pricing", "About"]; 

  const plans = [
    {
      id: "lite",
      name: "Lite",
      monthly: 19,
      yearly: 15,
      tagline: "Great for getting started with visual learning.",
      features: [
        "Personal learning paths",
        "Basic progress tracking",
        "Email summaries",
        "Up to 3 active paths",
      ],
      featured: false,
    },
    {
      id: "plus",
      name: "Plus",
      monthly: 39,
      yearly: 32,
      tagline: "Most learners choose Plus for daily use.",
      features: [
        "Unlimited paths",
        "Adaptive difficulty",
        "Export to Notion & PDF",
        "Priority updates",
      ],
      featured: true,
    },
    {
      id: "team",
      name: "Team",
      monthly: 89,
      yearly: 72,
      tagline: "For classrooms and teams building together.",
      features: [
        "Shared workspaces",
        "Team analytics",
        "Admin controls",
        "Up to 25 members",
      ],
      featured: false,
    },
  ];

  const suffix = billing === "monthly" ? "/ month" : "/ month (billed yearly)";

  return (
    <div className="page-enter">
      {/* NAV (keeps marketing tabs visible, highlights Pricing) */}
      <nav className="np-nav">
        <div className="np-logo" onClick={onBack} style={{ cursor: "pointer" }}>
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <ul className="np-nav-links">
          {navItems.map(l => (
            <li key={l}>
              <a
                href="#"
                className={l === "Pricing" ? "np-nav-link-active" : undefined}
                onClick={e => {
                  e.preventDefault();
                  if (l === "How it works" && onGoToHowItWorks) onGoToHowItWorks();
                  if (l === "Features" && onGoToFeatures) onGoToFeatures();
                  if (l === "About" && onGoToAbout) onGoToAbout();
                  // Other non-pricing tabs go back to landing page
                  if (l !== "Pricing" && l !== "About" && l !== "Features" && l !== "How it works" && onBack) onBack();
                }}
              >
                {l}
              </a>
            </li>
          ))}
        </ul>
        <div className="np-nav-right">
          <button className="btn-blue" onClick={() => onSelectPlan && onSelectPlan()}>Get Started</button>
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
            className={l === "Pricing" ? "np-nav-link-active" : undefined}
            onClick={e => {
              e.preventDefault();
              setMobileNavOpen(false);
              if (l === "How it works" && onGoToHowItWorks) onGoToHowItWorks();
              if (l === "Features" && onGoToFeatures) onGoToFeatures();
              if (l === "About" && onGoToAbout) onGoToAbout();
              if (l !== "Pricing" && l !== "About" && l !== "Features" && l !== "How it works" && onBack) onBack();
            }}
          >
            {l}
          </a>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <div className="pricing-wrap">
        <div className="pricing-header">
          <h1 className="pricing-title">Choose your NeuroPath plan</h1>
          <p className="pricing-sub">No contracts, no surprise fees. Upgrade or cancel anytime.</p>
          <div className="billing-toggle">
            <button
              type="button"
              className={`billing-option${billing === "monthly" ? " active" : ""}`}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`billing-option${billing === "yearly" ? " active" : ""}`}
              onClick={() => setBilling("yearly")}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="pricing-grid">
          {plans.map(plan => {
            const price = billing === "monthly" ? plan.monthly : plan.yearly;
            return (
              <div
                key={plan.id}
                className={`pricing-card${plan.featured ? " featured" : ""}`}
              >
                <div>
                  <div className="plan-badge" />
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-price-row">
                    <span className="plan-price">${price}</span>
                    <span className="plan-period">{suffix}</span>
                  </div>
                  <p className="plan-tagline">{plan.tagline}</p>
                  <ul className="plan-features">
                    {plan.features.map(f => (
                      <li key={f} className="plan-feature">
                        <span className="plan-check">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="plan-cta">
                  <button
                    className="btn-plan"
                    type="button"
                    onClick={() => onSelectPlan && onSelectPlan(plan.id)}
                  >
                    Choose {plan.name}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
