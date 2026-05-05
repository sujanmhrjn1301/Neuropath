import React, { useState, useEffect, useRef } from "react";
import { LogoIcon } from "./Icons";
import "../styles/pages.css";

export default function ChatFlow({ initialGoal, initialDifficulty, initialCommitment, onFinish, isDebugMode, setIsDebugMode }) {
  // -- Input phase --
  const [inputGoal, setInputGoal] = useState(initialGoal || "");
  const [difficulty, setDifficulty] = useState(initialDifficulty || "Beginner");
  const [commitment, setCommitment] = useState(initialCommitment || "30 - 60 mins (Steady)");

  // -- Chat phase --
  const [phase, setPhase] = useState(initialGoal ? "setup" : "input"); // "input" | "setup" | "generate" | "done"
  const [messages, setMessages] = useState(initialGoal ? [{ role: "user", content: initialGoal }] : []);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [generatedPathId, setGeneratedPathId] = useState(null);

  const messagesEndRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (initialGoal && !initialized.current) {
      initialized.current = true;
      initChat(initialGoal, initialDifficulty || "Beginner", initialCommitment || "30 - 60 mins (Steady)");
    }
  }, [initialGoal]);

  const initChat = async (goal, diff, comm) => {
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/auth/me/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal: `${goal} (${diff}, ${comm})` })
      });
      triggerBackendChat("HIDDEN_PROMPT: Hello, I am ready to start my assessment. Please ask me questions to gauge my experience.", "setup", [{ role: "user", content: goal }]);
    } catch (e) { console.error(e); }
  };

  const triggerBackendChat = async (userText, currentPhase, baseMessages) => {
    setChatDisabled(true);
    setLoading(true);

    const currentMessages = baseMessages || messages;
    if (userText && !userText.startsWith("HIDDEN_PROMPT:")) {
      setMessages(prev => [...prev, { role: "user", content: userText }]);
    }

    const endpoint = currentPhase === "setup" ? "/api/chat/knowledge-setup" : "/api/chat/generate-path";
    const token = localStorage.getItem("token");

    const requestMessages = currentMessages
      .filter(m => !m.content.startsWith("HIDDEN_PROMPT:"))
      .map(m => ({ role: m.role, content: m.content }));

    let finalUserText = userText;
    if (userText?.startsWith("HIDDEN_PROMPT:")) finalUserText = userText.replace("HIDDEN_PROMPT:", "").trim();
    if (finalUserText) requestMessages.push({ role: "user", content: finalUserText });

    try {
      const response = await fetch(`${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: requestMessages, provider: "openrouter", use_openrouter: true, debug_mode: isDebugMode })
      });

      if (!response.body) throw new Error("No stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = "";
      let hasStarted = false;
      let lastWordCount = 0;
      let buffer = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.replace("data: ", "").trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.text) {
              if (!hasStarted) { hasStarted = true; setLoading(false); }
              aiMessage += data.text;
              const wc = aiMessage.trim().split(/\s+/).length;
              if (wc === 1 || wc - lastWordCount >= 5) {
                lastWordCount = wc;
                setMessages(prev => { const n = [...prev]; n[n.length - 1].content = aiMessage; return n; });
              }
            } else if (data.status === "complete") {
              setMessages(prev => { const n = [...prev]; n[n.length - 1].content = aiMessage; return n; });
              if (data.path_id) { setGeneratedPathId(data.path_id); }
              if (currentPhase === "setup") {
                setPhase("generate");
                setTimeout(() => triggerBackendChat("HIDDEN_PROMPT: Excellent, my knowledge profile has been updated. Please propose a syllabus outline for me.", "generate", null), 1000);
              } else if (currentPhase === "generate") {
                setMessages(prev => [...prev, { role: "assistant", content: "✨ Your personalized learning path has been created! Click below to explore it." }]);
                setPhase("done");
              }
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setChatDisabled(false); }
  };

  const handleStartChat = (e) => {
    e.preventDefault();
    if (!inputGoal.trim()) return;
    const goal = inputGoal.trim();
    setMessages([{ role: "user", content: goal }]);
    setPhase("setup");
    initialized.current = true;
    initChat(goal, difficulty, commitment);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || chatDisabled) return;
    const text = inputValue;
    setInputValue("");
    triggerBackendChat(text, phase, null);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", background: "#fff" }}>
      {/* Topbar inside the chat flow to control debug and show status */}
      <header style={{ height: "72px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", borderBottom: "1px solid #f8fafc", flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>
          {phase === "input" ? "New Path" : phase === "done" ? "Path Ready!" : "Assessing Your Knowledge"}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {phase !== "input" && (
            <button onClick={() => setIsDebugMode(!isDebugMode)} style={{ background: isDebugMode ? "#ef4444" : "#f8fafc", color: isDebugMode ? "#fff" : "#64748b", border: `1px solid ${isDebugMode ? "#ef4444" : "#e2e8f0"}`, borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>
              {isDebugMode ? "⚡ DEBUG ON" : "🪲 DEBUG"}
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      {phase === "input" ? (
        /* ── GOAL INPUT FORM ── */
        <div style={{ flex: 1, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", background: "#f8fafc" }}>
          <div style={{ width: "100%", maxWidth: "600px" }}>
            <h1 style={{ fontSize: "36px", fontWeight: "800", letterSpacing: "-0.03em", color: "#1e293b", textAlign: "center", marginBottom: "8px" }}>Where do you want to go?</h1>
            <p style={{ textAlign: "center", color: "#64748b", fontSize: "15px", marginBottom: "40px" }}>Let our AI build your personalized roadmap.</p>
            <form onSubmit={handleStartChat} style={{ background: "#fff", borderRadius: "16px", padding: "28px", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b", display: "block", marginBottom: "8px" }}>Your Learning Goal</label>
              <textarea
                value={inputGoal}
                onChange={e => setInputGoal(e.target.value)}
                placeholder="e.g., Master React, build a SaaS product, learn machine learning..."
                style={{ width: "100%", minHeight: "100px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "14px", resize: "vertical", fontSize: "14px", color: "#1e293b", lineHeight: "1.6", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = "#5A72F6"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
              <div style={{ display: "flex", gap: "24px", marginTop: "20px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Difficulty Level</div>
                  <div style={{ display: "flex" }}>
                    {["Beginner", "Intermediate", "Expert"].map((d, i) => (
                      <button key={d} type="button" onClick={() => setDifficulty(d)}
                        style={{
                          flex: 1, padding: "10px 0", border: "1.5px solid #e2e8f0", background: difficulty === d ? "#eff6ff" : "#fff", color: difficulty === d ? "#5A72F6" : "#64748b", fontSize: "13px", fontWeight: difficulty === d ? "600" : "400", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                          borderRadius: i === 0 ? "8px 0 0 8px" : i === 2 ? "0 8px 8px 0" : "0", marginRight: i < 2 ? "-1px" : "0", zIndex: difficulty === d ? 1 : 0, position: "relative"
                        }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Daily Commitment</div>
                  <select value={commitment} onChange={e => setCommitment(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", color: "#1e293b", outline: "none", background: "#fff", fontFamily: "inherit" }}>
                    <option>15 - 30 mins (Light)</option>
                    <option>30 - 60 mins (Steady)</option>
                    <option>1 - 2 hrs (Intensive)</option>
                    <option>2+ hrs (Full-time)</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={!inputGoal.trim()}
                style={{ width: "100%", marginTop: "24px", padding: "14px", background: inputGoal.trim() ? "#5A72F6" : "#e2e8f0", color: inputGoal.trim() ? "#fff" : "#94a3b8", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "600", cursor: inputGoal.trim() ? "pointer" : "not-allowed", transition: "all 0.2s", fontFamily: "inherit" }}>
                ✦ Generate My Path
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── CHAT VIEW ── */
        <>
          <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "100%", maxWidth: "780px", padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <h1 style={{ fontSize: "30px", fontWeight: "800", letterSpacing: "-0.03em", color: "#1e293b", margin: "0 0 8px" }}>
                  {phase === "setup" ? "Assessing Your Knowledge" : phase === "generate" ? "Building Your Path" : "Your Path is Ready!"}
                </h1>
                <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
                  {phase === "setup" ? "Answer a few questions so we can tailor the content for you." : phase === "generate" ? "Sit tight while our AI designs your personalized syllabus." : "Your custom learning roadmap has been created."}
                </p>
              </div>

              {messages.filter(m => !m.content.startsWith("HIDDEN_PROMPT:") && !(m.role === "assistant" && m.content.trim().startsWith("{") && m.content.includes("user_profile")))
                .map((msg, i, arr) => {
                  const isLast = i === arr.length - 1;
                  const isEmpty = msg.role === "assistant" && msg.content === "";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: "12px", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row", maxWidth: "85%" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: msg.role === "user" ? "#f1f5f9" : "#5A72F6", color: msg.role === "user" ? "#5A72F6" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "17px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                        {msg.role === "user" ? "👤" : <LogoIcon />}
                      </div>
                      <div style={{ background: msg.role === "user" ? "#5A72F6" : "#fff", color: msg.role === "user" ? "#fff" : "#1e293b", padding: "14px 18px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", lineHeight: "1.65", whiteSpace: "pre-wrap", fontSize: "15px", boxShadow: msg.role === "user" ? "0 4px 12px rgba(90,114,246,0.2)" : "0 2px 10px rgba(0,0,0,0.04)", border: msg.role === "user" ? "none" : "1px solid #f1f5f9" }}>
                        {isEmpty && loading && isLast ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div className="spinner" style={{ width: "16px", height: "16px", margin: 0, borderTopColor: "#5A72F6" }} />
                            <span style={{ color: "#94a3b8", fontSize: "14px", fontWeight: "500" }}>{phase === "generate" ? "Building syllabus..." : "Thinking..."}</span>
                          </div>
                        ) : msg.content}
                      </div>
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input bar */}
          <div style={{ padding: "0 40px 32px", flexShrink: 0 }}>
            <div style={{ maxWidth: "780px", margin: "0 auto" }}>
              {phase !== "done" ? (
                <form onSubmit={handleSend} style={{ position: "relative", display: "flex" }}>
                  <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
                    placeholder="Type your response..." disabled={chatDisabled}
                    style={{ flex: 1, padding: "16px 60px 16px 22px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "15px", outline: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.03)", background: "#fff", fontFamily: "inherit", transition: "all 0.2s" }}
                    onFocus={e => { e.target.style.borderColor = "#5A72F6"; e.target.style.boxShadow = "0 4px 20px rgba(90,114,246,0.08)"; }}
                    onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "0 4px 16px rgba(0,0,0,0.03)"; }} />
                  <button type="submit" disabled={chatDisabled || !inputValue.trim()}
                    style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: (chatDisabled || !inputValue.trim()) ? "#f1f5f9" : "#5A72F6", color: (chatDisabled || !inputValue.trim()) ? "#94a3b8" : "#fff", border: "none", borderRadius: "10px", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", cursor: (chatDisabled || !inputValue.trim()) ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                  </button>
                </form>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <button onClick={() => onFinish(generatedPathId)} style={{ padding: "14px 40px", background: "#5A72F6", color: "#fff", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 16px rgba(90,114,246,0.3)", fontFamily: "inherit" }}>
                    ✦ View My New Path
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
