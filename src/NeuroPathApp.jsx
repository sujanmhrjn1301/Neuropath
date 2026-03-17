import { useState } from "react";

/* ─────────────────────────── SHARED STYLES ─────────────────────────── */
const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --blue:        #1B4EF8;
    --blue-hover:  #3B5BFC;
    --blue-light:  #EEF2FF;
    --dark:        #0D0F1A;
    --gray:        #6B7280;
    --gray-light:  #F3F4F6;
    --gray-border: #E5E7EB;
    --white:       #FFFFFF;
    --font-display: 'Bricolage Grotesque', sans-serif;
    --font-body:    'DM Sans', sans-serif;
  }

  html { scroll-behavior: smooth; }
  body { font-family: var(--font-body); background: var(--white); color: var(--dark); -webkit-font-smoothing: antialiased; }

  /* ── SHARED NAV ── */
  .np-nav {
    position: sticky; top: 0; z-index: 200;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--gray-border);
    height: 60px; padding: 0 40px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .np-logo { display: flex; align-items: center; gap: 9px; cursor: pointer; text-decoration: none; }
  .np-logo-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--blue);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .np-logo-text { font-family: var(--font-display); font-weight: 700; font-size: 17px; color: var(--dark); }
  .np-nav-links { display: flex; align-items: center; gap: 30px; list-style: none; }
  .np-nav-links a { font-size: 14px; font-weight: 500; color: var(--gray); text-decoration: none; transition: color .2s; cursor: pointer; }
  .np-nav-links a:hover { color: var(--dark); }
  .np-nav-right { display: flex; align-items: center; gap: 10px; }

  .np-mobile-menu-toggle {
    display: none;
    width: 34px; height: 34px; border-radius: 8px;
    border: 1px solid var(--gray-border);
    background: #fff;
    align-items: center; justify-content: center;
    cursor: pointer;
  }
  .np-mobile-menu-toggle-bar {
    width: 16px; height: 2px; border-radius: 2px;
    background: var(--dark);
    display: block;
  }
  .np-mobile-menu-toggle-bar + .np-mobile-menu-toggle-bar { margin-top: 3px; }
  .np-mobile-menu { display: none; }

  .btn-ghost {
    background: none; border: none; cursor: pointer;
    font-family: var(--font-body); font-size: 14px; font-weight: 500;
    color: var(--dark); padding: 8px 14px; border-radius: 8px; transition: background .2s;
  }
  .btn-ghost:hover { background: var(--gray-light); }

  .btn-blue {
    background: var(--blue); color: #fff; border: none; cursor: pointer;
    font-family: var(--font-body); font-size: 14px; font-weight: 600;
    padding: 9px 18px; border-radius: 8px;
    box-shadow: 0 2px 8px rgba(27,78,248,.25);
    transition: background .2s, transform .15s, box-shadow .2s;
  }
  .btn-blue:hover { background: var(--blue-hover); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(27,78,248,.35); }
  .btn-blue:active { transform: translateY(0); }

  /* ── AVATAR ── */
  .avatar {
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--blue-light); border: 2px solid var(--gray-border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 15px; transition: border-color .2s;
  }
  .avatar:hover { border-color: var(--blue); }

  /* ── PAGE TRANSITIONS ── */
  @keyframes pageIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .page-enter { animation: pageIn .45s ease both; }

  /* ── FADE UP helpers ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fu  { animation: fadeUp .6s ease both; }
  .d1  { animation-delay: .05s; }
  .d2  { animation-delay: .15s; }
  .d3  { animation-delay: .25s; }
  .d4  { animation-delay: .35s; }
  .d5  { animation-delay: .45s; }

  @media (max-width: 860px) {
    .np-nav { padding: 0 20px; }
    .np-nav-links { display: none; }
    .np-mobile-menu-toggle { display: flex; }
    .np-mobile-menu {
      position: absolute; top: 60px; right: 20px;
      background: #fff; border: 1px solid var(--gray-border); border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,.18);
      padding: 8px 0; width: 190px;
      display: none; flex-direction: column;
      z-index: 190;
    }
    .np-mobile-menu.open { display: flex; }
    .np-mobile-menu a {
      padding: 10px 18px;
      font-size: 14px; font-weight: 500; color: var(--gray);
      text-decoration: none; cursor: pointer;
      transition: background .15s, color .15s;
    }
    .np-mobile-menu a:hover { background: var(--gray-light); color: var(--dark); }
  }
`;

/* ─────────────────────────── LANDING STYLES ─────────────────────────── */
const landingStyles = `
  /* HERO */
  .lp-hero {
    min-height: calc(100vh - 60px);
    max-width: 1140px; margin: 0 auto;
    padding: 80px 40px 60px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--blue-light); color: var(--blue);
    font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    padding: 5px 12px; border-radius: 20px; margin-bottom: 20px;
    border: 1px solid rgba(27,78,248,.15);
  }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--blue); }
  .lp-h1 {
    font-family: var(--font-display); font-size: clamp(38px,5vw,62px);
    font-weight: 800; line-height: 1.08; letter-spacing: -.03em;
    color: var(--dark); margin-bottom: 20px;
  }
  .lp-h1 .accent { color: var(--blue); }
  .lp-sub { font-size: 16px; line-height: 1.65; color: var(--gray); max-width: 380px; margin-bottom: 36px; }

  .search-wrap {
    display: flex; align-items: center;
    background: #fff; border: 1.5px solid var(--gray-border);
    border-radius: 12px; padding: 4px 4px 4px 14px;
    max-width: 420px; margin-bottom: 18px;
    box-shadow: 0 2px 12px rgba(0,0,0,.06);
    transition: border-color .2s, box-shadow .2s;
  }
  .search-wrap:focus-within { border-color: var(--blue); box-shadow: 0 2px 20px rgba(27,78,248,.12); }
  .search-input {
    flex: 1; border: none; outline: none;
    font-family: var(--font-body); font-size: 14px; color: var(--dark); background: transparent;
  }
  .search-input::placeholder { color: #9CA3AF; }
  .btn-gen {
    background: var(--blue); color: #fff; border: none; cursor: pointer;
    font-family: var(--font-body); font-size: 14px; font-weight: 600;
    padding: 10px 20px; border-radius: 8px;
    transition: background .2s;
  }
  .btn-gen:hover { background: var(--blue-hover); }

  .popular-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .pop-label { font-size: 13px; color: var(--gray); }
  .pop-tag {
    font-size: 13px; font-weight: 500; color: var(--blue);
    padding: 3px 8px; border-radius: 6px; cursor: pointer; transition: background .15s;
  }
  .pop-tag:hover { background: var(--blue-light); }

  /* GRAPH CARD */
  .graph-card {
    background: #fff; border: 1px solid var(--gray-border); border-radius: 20px;
    padding: 32px; box-shadow: 0 8px 40px rgba(0,0,0,.08);
    position: relative; overflow: hidden;
    min-height: 300px; display: flex; flex-direction: column; justify-content: space-between;
    animation: floatCard 4s ease-in-out infinite;
  }
  .graph-card::before {
    content: ''; position: absolute; top: -60px; right: -60px;
    width: 240px; height: 240px;
    background: radial-gradient(circle, rgba(27,78,248,.07) 0%, transparent 70%);
    border-radius: 50%; pointer-events: none;
  }
  .graph-canvas { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 220px; }
  .graph-caption { font-size: 12px; color: #9CA3AF; font-style: italic; margin-top: 14px; }
  @keyframes floatCard { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-6px) } }
  @keyframes nodePulse { 0%,100%{ opacity:.65 } 50%{ opacity:1 } }

  /* PROCESS */
  .process { background: var(--gray-light); padding: 96px 40px; }
  .process-inner { max-width: 1140px; margin: 0 auto; }
  .sec-label { text-align:center; font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--blue); margin-bottom:12px; }
  .sec-title { font-family:var(--font-display); font-size:clamp(26px,4vw,42px); font-weight:800; letter-spacing:-.025em; text-align:center; color:var(--dark); margin-bottom:14px; }
  .sec-sub { text-align:center; color:var(--gray); font-size:15px; line-height:1.65; max-width:460px; margin:0 auto 52px; }

  .cards-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  .feat-card {
    background:#fff; border:1px solid var(--gray-border); border-radius:16px; padding:30px 26px;
    transition: transform .25s, box-shadow .25s, border-color .25s;
  }
  .feat-card:hover { transform:translateY(-4px); box-shadow:0 16px 48px rgba(0,0,0,.09); border-color:rgba(27,78,248,.2); }
  .feat-icon {
    width:46px; height:46px; border-radius:12px; background:var(--blue);
    display:flex; align-items:center; justify-content:center;
    margin-bottom:18px; box-shadow:0 4px 14px rgba(27,78,248,.28);
  }
  .feat-title { font-family:var(--font-display); font-size:17px; font-weight:700; color:var(--dark); margin-bottom:10px; }
  .feat-desc { font-size:14px; line-height:1.7; color:var(--gray); margin-bottom:18px; }
  .learn-more { font-size:13px; font-weight:600; color:var(--blue); text-decoration:none; display:inline-flex; align-items:center; gap:4px; transition:gap .2s; }
  .learn-more:hover { gap:9px; }

  /* CTA */
  .cta-section { background:#F8F9FF; padding:96px 40px; text-align:center; border-top:1px solid var(--gray-border); }
  .cta-title { font-family:var(--font-display); font-size:clamp(26px,4vw,44px); font-weight:800; letter-spacing:-.025em; color:var(--dark); margin-bottom:14px; }
  .cta-sub { font-size:16px; color:var(--gray); max-width:460px; margin:0 auto 32px; }
  .cta-btns { display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
  .btn-lg {
    cursor:pointer; font-family:var(--font-body); font-size:15px; font-weight:600;
    padding:14px 28px; border-radius:10px; transition:all .2s;
  }
  .btn-lg-blue { background:var(--blue); color:#fff; border:none; box-shadow:0 4px 20px rgba(27,78,248,.28); }
  .btn-lg-blue:hover { background:var(--blue-hover); transform:translateY(-2px); box-shadow:0 6px 24px rgba(27,78,248,.4); }
  .btn-lg-outline { background:#fff; color:var(--dark); border:1.5px solid var(--gray-border); }
  .btn-lg-outline:hover { border-color:var(--blue); background:var(--blue-light); }
  .cta-note { font-size:13px; color:#9CA3AF; }

  /* FOOTER */
  .np-footer {
    background:#fff; border-top:1px solid var(--gray-border);
    padding:26px 40px;
    display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;
  }
  .footer-links { display:flex; gap:24px; list-style:none; }
  .footer-links a { font-size:14px; color:var(--gray); text-decoration:none; transition:color .2s; cursor:pointer; }
  .footer-links a:hover { color:var(--dark); }
  .social-row { display:flex; gap:10px; }
  .social-btn {
    width:34px; height:34px; border-radius:8px; border:1px solid var(--gray-border);
    display:flex; align-items:center; justify-content:center; cursor:pointer;
    background:#fff; color:var(--gray); transition:border-color .2s, color .2s, background .2s;
  }
  .social-btn:hover { border-color:var(--blue); color:var(--blue); background:var(--blue-light); }
  .footer-copy { width:100%; text-align:center; font-size:12px; color:#9CA3AF; padding-top:14px; border-top:1px solid var(--gray-border); margin-top:6px; }

  @media(max-width:860px){
    .lp-hero { grid-template-columns:1fr; padding:56px 20px; }
    .cards-grid { grid-template-columns:1fr; }
    .process,.cta-section { padding:60px 20px; }
    .np-footer { padding:22px 20px; }
  }
`;

/* ─────────────────────────── MAIN PAGE STYLES ─────────────────────────── */
const mainStyles = `
  /* MAIN PAGE */
  .mp-wrap {
    min-height: calc(100vh - 60px);
    background: var(--gray-light);
    display: flex; flex-direction: column; align-items: center;
    padding: 72px 20px 60px;
  }
  .mp-heading {
    font-family: var(--font-display); font-size: clamp(28px,4.5vw,46px);
    font-weight: 800; letter-spacing: -.028em; text-align: center;
    color: var(--dark); margin-bottom: 10px;
  }
  .mp-sub { font-size: 15px; color: var(--gray); text-align: center; margin-bottom: 40px; }

  .mp-card {
    background: #fff; border: 1px solid var(--gray-border); border-radius: 18px;
    padding: 32px; width: 100%; max-width: 540px;
    box-shadow: 0 4px 24px rgba(0,0,0,.07);
  }
  .mp-field-label {
    font-size: 13px; font-weight: 600; color: var(--dark); margin-bottom: 10px; letter-spacing: .01em;
  }
  .mp-textarea {
    width: 100%; min-height: 90px; border: 1.5px solid var(--gray-border);
    border-radius: 10px; padding: 14px; resize: vertical;
    font-family: var(--font-body); font-size: 14px; color: var(--dark);
    line-height: 1.6; outline: none; transition: border-color .2s, box-shadow .2s;
  }
  .mp-textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(27,78,248,.08); }
  .mp-textarea::placeholder { color: #9CA3AF; }

  .mp-row { display: flex; gap: 24px; margin-top: 24px; align-items: flex-start; flex-wrap: wrap; }
  .mp-col { flex: 1; min-width: 160px; }
  .mp-col-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--gray); margin-bottom: 10px; }

  /* Difficulty toggle */
  .diff-group { display: flex; gap: 0; }
  .diff-btn {
    flex: 1; padding: 9px 0; border: 1.5px solid var(--gray-border);
    background: #fff; cursor: pointer; font-family: var(--font-body); font-size: 13px;
    font-weight: 500; color: var(--gray); transition: all .18s;
    margin-right: -1px;
  }
  .diff-btn:first-child { border-radius: 8px 0 0 8px; }
  .diff-btn:last-child  { border-radius: 0 8px 8px 0; margin-right: 0; }
  .diff-btn.active {
    background: var(--blue-light); border-color: var(--blue);
    color: var(--blue); font-weight: 600; z-index: 1;
  }
  .diff-btn:not(.active):hover { background: var(--gray-light); }

  /* Commitment dropdown */
  .mp-select {
    width: 100%; padding: 9px 36px 9px 12px; border: 1.5px solid var(--gray-border);
    border-radius: 8px; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%236B7280' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E") no-repeat right 12px center;
    appearance: none; -webkit-appearance: none;
    font-family: var(--font-body); font-size: 13px; color: var(--dark);
    outline: none; cursor: pointer; transition: border-color .2s;
  }
  .mp-select:focus { border-color: var(--blue); }

  /* Generate button */
  .btn-generate-main {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; margin-top: 26px;
    background: var(--blue); color: #fff; border: none; cursor: pointer;
    font-family: var(--font-body); font-size: 15px; font-weight: 600;
    padding: 15px; border-radius: 10px;
    box-shadow: 0 4px 18px rgba(27,78,248,.28);
    transition: background .2s, transform .15s, box-shadow .2s;
  }
  .btn-generate-main:hover { background:var(--blue-hover); transform:translateY(-2px); box-shadow:0 6px 24px rgba(27,78,248,.4); }
  .btn-generate-main:active { transform:translateY(0); }
  .btn-generate-main:disabled { opacity:.6; cursor:not-allowed; transform:none; }

  .mp-hint { font-size: 11.5px; color: #9CA3AF; text-align: center; margin-top: 10px; }

  /* Popular starting points */
  .mp-popular { margin-top: 36px; text-align: center; }
  .mp-popular-label { font-size: 11px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--gray); margin-bottom: 14px; }
  .mp-tags { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .mp-tag {
    padding: 8px 16px; border: 1px solid var(--gray-border); border-radius: 20px;
    background: #fff; font-family: var(--font-body); font-size: 13px; font-weight: 500;
    color: var(--dark); cursor: pointer; transition: border-color .2s, color .2s, background .2s;
  }
  .mp-tag:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-light); }

  /* Trust footer line */
  .mp-trust { margin-top: 48px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: center; }
  .mp-trust-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray); }
  .mp-trust-icon { color: var(--blue); font-size: 15px; }
  .mp-copy { margin-top: 24px; font-size: 12px; color: #9CA3AF; }

  /* Loading state */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,.35);
    border-top-color: #fff; border-radius: 50%;
    animation: spin .7s linear infinite;
  }

  @media(max-width:540px){
    .mp-card { padding: 24px 18px; }
    .mp-row { gap: 16px; }
  }
`;

/* ─────────────────────────── SHARED ICONS ─────────────────────────── */
function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="4" fill="white" />
      <circle cx="3" cy="4" r="2" fill="white" opacity="0.7" />
      <circle cx="15" cy="4" r="2" fill="white" opacity="0.7" />
      <circle cx="15" cy="14" r="2" fill="white" opacity="0.7" />
      <circle cx="3" cy="14" r="2" fill="white" opacity="0.7" />
      <line x1="9" y1="5" x2="3" y2="4" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="9" y1="5" x2="15" y2="4" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="9" y1="13" x2="15" y2="14" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="9" y1="13" x2="3" y2="14" stroke="white" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg style={{ marginRight: 8, flexShrink: 0 }} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
      <path d="M11 11l3 3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="4" width="12" height="2" rx="1" fill="#111827" />
      <rect x="3" y="8" width="12" height="2" rx="1" fill="#111827" />
      <rect x="3" y="12" width="8" height="2" rx="1" fill="#111827" />
    </svg>
  );
}

/* ─────────────────────────── KNOWLEDGE GRAPH SVG ─────────────────────────── */
function KnowledgeGraph() {
  return (
    <svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 300 }}>
      <defs>
        <radialGradient id="g1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1B4EF8" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#1B4EF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="120" r="52" fill="url(#g1)" />
      <line x1="160" y1="120" x2="72" y2="58"  stroke="#C7D2FE" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="160" y1="120" x2="248" y2="68"  stroke="#C7D2FE" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="160" y1="120" x2="252" y2="178" stroke="#C7D2FE" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="160" y1="120" x2="68"  y2="175" stroke="#C7D2FE" strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx="160" cy="120" r="26" fill="#1B4EF8" />
      <text x="160" y="127" textAnchor="middle" fontSize="20">💡</text>
      {[
        { cx: 72,  cy: 58,  icon: "🧬", delay: "0s"   },
        { cx: 248, cy: 68,  icon: "⚛️", delay: "0.8s" },
        { cx: 252, cy: 178, icon: "🔗", delay: "1.6s" },
        { cx: 68,  cy: 175, icon: "📊", delay: "2.4s" },
      ].map(({ cx, cy, icon, delay }) => (
        <g key={cx} style={{ animation: `nodePulse 3s ease-in-out ${delay} infinite` }}>
          <circle cx={cx} cy={cy} r="20" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5" />
          <text x={cx} y={cy + 7} textAnchor="middle" fontSize="16">{icon}</text>
        </g>
      ))}
    </svg>
  );
}

/* ─────────────────────────── LANDING PAGE ─────────────────────────── */
function LandingPage({ onGetStarted }) {
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

  return (
    <div className="page-enter">
      {/* NAV */}
      <nav className="np-nav">
        <div className="np-logo">
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <ul className="np-nav-links">
          {["How it works", "Features", "Pricing", "About"].map(l => (
            <li key={l}><a href="#">{l}</a></li>
          ))}
        </ul>
        <div className="np-nav-right">
          <button className="btn-ghost">Log In</button>
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
        {["How it works", "Features", "Pricing", "About"].map(l => (
          <a
            key={l}
            href="#"
            onClick={() => setMobileNavOpen(false)}
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
          <button className="btn-lg btn-lg-outline" onClick={() => onGetStarted("Machine Learning Fundamentals")}>View Demo Path</button>
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
          {["Privacy","Terms","Contact","Careers"].map(l=><li key={l}><a href="#">{l}</a></li>)}
        </ul>
        <div className="social-row">
          <button className="social-btn">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1.5c-2 2-2 8 0 12M7.5 1.5c2 2 2 8 0 12M1.5 7.5h12" stroke="currentColor" strokeWidth="1.3"/></svg>
          </button>
          <button className="social-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 1.5l4.2 5.2L1.5 12.5h1.4L6.4 7.6l3.6 4.9H13L8.6 6.5 13 1.5h-1.4L7.8 6l-3.4-4.5H1.5Z" fill="currentColor"/></svg>
          </button>
        </div>
        <div className="footer-copy">© 2026 NeuroPath AI Inc. All rights reserved. Mapping human knowledge, one node at a time.</div>
      </footer>
    </div>
  );
}

/* ─────────────────────────── MAIN APP PAGE ─────────────────────────── */
function MainPage({ initialGoal, onBack }) {
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
    setTimeout(() => setLoading(false), 2000); // simulate async
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
              <><div className="spinner" /> Generating your path...</>
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
        <div className="mp-trust fu d5">
          <div className="mp-trust-item">
            <span className="mp-trust-icon">✓</span>Verified Sources
          </div>
          <div className="mp-trust-item">
            <span className="mp-trust-icon">✓</span>Real-time Updates
          </div>
        </div>
        <p className="mp-copy">© 2026 NeuroPath AI. All rights reserved.</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── ROOT APP ─────────────────────────── */
export default function App() {
  const [page, setPage] = useState("landing");   // "landing" | "main"
  const [prefillGoal, setPrefillGoal] = useState("");

  const goToMain = (goal = "") => {
    setPrefillGoal(goal);
    setPage("main");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToLanding = () => {
    setPage("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <style>{sharedStyles + landingStyles + mainStyles}</style>
      {page === "landing"
        ? <LandingPage onGetStarted={goToMain} />
        : <MainPage initialGoal={prefillGoal} onBack={goToLanding} />
      }
    </>
  );
}
