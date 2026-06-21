import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export default function SyllabusRenderer({ content }) {
  if (!content) return null;

  const startTag = "<syllabus_proposal>";
  const endTag = "</syllabus_proposal>";

  const startIndex = content.indexOf(startTag);
  if (startIndex === -1) {
    return <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>;
  }

  const beforeText = content.substring(0, startIndex);
  const proposalStart = startIndex + startTag.length;

  const endIndex = content.indexOf(endTag, proposalStart);
  const proposalText = endIndex === -1 ? content.substring(proposalStart) : content.substring(proposalStart, endIndex);
  const afterText = endIndex === -1 ? "" : content.substring(endIndex + endTag.length);

  // Parse cards inside proposalText
  const cards = [];
  const cardRegex = /<card>([\s\S]*?)(?:<\/card>|$)/g;
  let match;
  while ((match = cardRegex.exec(proposalText)) !== null) {
    const cardContent = match[1];
    if (!cardContent.trim()) continue;

    const titleMatch = cardContent.match(/<title>([\s\S]*?)(?:<\/title>|$)/);
    const goalMatch = cardContent.match(/<(?:instructional_goal|description)>([\s\S]*?)(?:<\/(?:instructional_goal|description)>|$)/);
    const typeMatch = cardContent.match(/<activity_type>([\s\S]*?)(?:<\/activity_type>|$)/);

    const title = titleMatch ? titleMatch[1].trim() : "";
    const instructionalGoal = goalMatch ? goalMatch[1].trim() : "";
    const activityType = typeMatch ? typeMatch[1].trim() : "";

    if (title || instructionalGoal || activityType) {
      cards.push({ title, instructionalGoal, activityType });
    }
  }

  return (
    <div style={{ width: "100%" }}>
      {beforeText && <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{beforeText}</ReactMarkdown>}

      <div className="syllabus-proposal-container" style={{ display: "flex", flexDirection: "column", gap: "16px", margin: "20px 0" }}>
        {cards.map((card, idx) => (
          <SyllabusCard key={idx} card={card} />
        ))}
      </div>

      {afterText && <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{afterText}</ReactMarkdown>}
    </div>
  );
}

function SyllabusCard({ card }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="syllabus-card" style={{
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "14px",
      padding: "20px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
      transition: "all 0.2s ease-in-out",
      cursor: card.instructionalGoal ? "pointer" : "default"
    }} onClick={() => card.instructionalGoal && setIsOpen(!isOpen)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          {card.activityType && (
            <span className="activity-badge" style={{
              display: "inline-block",
              background: "rgba(90, 114, 246, 0.08)",
              color: "#5A72F6",
              fontSize: "12px",
              fontWeight: "700",
              padding: "4px 12px",
              borderRadius: "9999px",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              {card.activityType}
            </span>
          )}
          {card.title && (
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1e293b", letterSpacing: "-0.01em" }}>
              {card.title}
            </h4>
          )}
        </div>

        {card.instructionalGoal && (
          <button style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px",
            borderRadius: "6px",
            transition: "all 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        )}
      </div>

      {card.instructionalGoal && (
        <div style={{
          maxHeight: isOpen ? "500px" : "0px",
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          marginTop: isOpen ? "14px" : "0",
          borderTop: isOpen ? "1px solid #f1f5f9" : "none",
          paddingTop: isOpen ? "14px" : "0"
        }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.65" }}>
            {card.instructionalGoal}
          </p>
        </div>
      )}
    </div>
  );
}
