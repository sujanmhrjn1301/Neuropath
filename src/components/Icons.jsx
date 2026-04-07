export function LogoIcon() {
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

export function SearchIcon() {
  return (
    <svg style={{ marginRight: 8, flexShrink: 0 }} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
      <path d="M11 11l3 3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="4" width="12" height="2" rx="1" fill="#111827" />
      <rect x="3" y="8" width="12" height="2" rx="1" fill="#111827" />
      <rect x="3" y="12" width="8" height="2" rx="1" fill="#111827" />
    </svg>
  );
}

export function KnowledgeGraph() {
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
