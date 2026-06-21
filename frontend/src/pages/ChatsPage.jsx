import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import "../styles/pages.css";
import { LogoIcon } from "../components/Icons";
import MCQCard from "../components/MCQCard";
import SyllabusRenderer from "../components/SyllabusRenderer";

export default function ChatsPage({ initialGoal, initialDifficulty, initialCommitment, onFinish, onLogout, user, metadata }) {
  // -- History --
  const [history, setHistory] = useState([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // -- Input phase --
  const [inputGoal, setInputGoal] = useState(initialGoal || "");
  const [difficulty, setDifficulty] = useState(initialDifficulty || "Beginner");
  const [commitment, setCommitment] = useState(initialCommitment || "30 - 60 mins (Steady)");

  // -- Chat phase --
  const [phase, setPhase] = useState(initialGoal ? "setup" : "input"); 
  const [messages, setMessages] = useState(initialGoal ? [{ role: "user", content: initialGoal }] : []);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [generatedPathId, setGeneratedPathId] = useState(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [activeMCQ, setActiveMCQ] = useState(null);
  
  const messagesEndRef = useRef(null);
  const activeRequestRef = useRef(0);
  const initialized = useRef(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    fetchHistory();
    if (initialGoal && !initialized.current) {
      initialized.current = true;
      initChat(initialGoal, initialDifficulty || "Beginner", initialCommitment || "30 - 60 mins (Steady)");
    }
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/learning-paths", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const initChat = async (goal, diff, comm) => {
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/auth/me/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal: `${goal} (${diff}, ${comm})` })
      });
      triggerBackendChat("HIDDEN_PROMPT: Hello, I am ready to start my assessment. Please ask me questions to gauge my experience. Once we move to the syllabus phase, please format each module as a separate markdown code block for a clean blueprint look.", "setup", [{ role: "user", content: goal }]);
    } catch (e) { console.error(e); }
  };

  const triggerBackendChat = async (userText, currentPhase, baseMessages) => {
    const currentRequestId = ++activeRequestRef.current;
    setChatDisabled(true);
    setLoading(true);
    setHasStarted(false);
    setStatusMessage(
      (currentPhase === "generate" && researchEnabled) 
        ? "Researching live market..." 
        : (currentPhase === "generate" ? "Generating Map..." : "Thinking...")
    );

    const currentMessages = baseMessages || messages;
    if (userText && !userText.startsWith("HIDDEN_PROMPT:")) {
      setMessages(prev => [...prev,
      { role: "user", content: userText },
      { role: "assistant", content: "" }
      ]);
    } else if (userText?.startsWith("HIDDEN_PROMPT:")) {
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content) {
          return prev;
        }
        return [...prev, { role: "assistant", content: "" }];
      });
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
        body: JSON.stringify({
          messages: requestMessages,
          provider: "openrouter",
          use_openrouter: true,
          debug_mode: isDebugMode,
          use_research: researchEnabled
        })
      });

      if (!response.body) throw new Error("No stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = "";
      let lastWordCount = 0;
      let buffer = "";

      let firstChunkReceived = false;
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
            if (data.is_new_message) {
              aiMessage = "";
              lastWordCount = 0;
              setMessages(prev => [...prev, { role: "assistant", content: "", isThinking: true }]);
              continue;
            }

            if (data.text) {
              const isFirst = !firstChunkReceived;
              if (isFirst) {
                firstChunkReceived = true;
                setHasStarted(true);
              }
              aiMessage += data.text;
              const wc = aiMessage.trim().split(/\s+/).length;
              if (isFirst || wc === 1 || wc - lastWordCount >= 5) {
                lastWordCount = wc;
                setMessages(prev => {
                  const n = [...prev];
                  if (n.length > 0 && n[n.length - 1].role === "assistant") {
                    n[n.length - 1].content = aiMessage;
                    n[n.length - 1].isThinking = false;
                    if (currentPhase === "generate") {
                      n[n.length - 1].status = "Generating Map...";
                      setStatusMessage("Generating Map...");
                    }
                  }
                  return n;
                });
              }
            } else if (data.status === "researching") {
              setStatusMessage(data.message);
              setMessages(prev => {
                const n = [...prev];
                if (n.length > 0 && n[n.length - 1].role === "assistant") {
                  n[n.length - 1].isThinking = true;
                  n[n.length - 1].status = data.message;
                }
                return n;
              });
            } else if (data.status === "complete") {
              let updatedMessages = [];
              setMessages(prev => { 
                const n = [...prev]; 
                if (n.length > 0 && n[n.length - 1].role === "assistant") {
                  n[n.length - 1].content = aiMessage; 
                  n[n.length - 1].isThinking = false;
                  n[n.length - 1].status = data.message || "Summary Updated";
                }
                updatedMessages = n;
                return n; 
              });
              if (data.path_id) { setGeneratedPathId(data.path_id); fetchHistory(); }
              if (currentPhase === "setup") {
                setPhase("generate");
                setTimeout(() => {
                  setStatusMessage("Generating Map...");
                  triggerBackendChat("HIDDEN_PROMPT: Excellent, my knowledge profile has been updated. Please propose a syllabus outline for me.", "generate", updatedMessages);
                }, 1000);
              } else if (currentPhase === "generate") {
                setPhase("done");
              }
            } else if (data.status === "error" || data.type === "error") {
              const errMsg = data.message || data.data || "Unknown Error";
              setMessages(prev => {
                const n = [...prev];
                if (n.length > 0 && n[n.length - 1].role === "assistant") {
                  n[n.length - 1].content = "❌ **Error:** " + errMsg;
                } else {
                  n.push({ role: "assistant", content: "❌ **Error:** " + errMsg });
                }
                return n;
              });
            } else if (data.type === "mcq") {
              try {
                const mcqData = JSON.parse(data.data);
                setActiveMCQ(mcqData.questions);
                setLoading(false);
              } catch (e) { console.error("MCQ Parse error:", e); }
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (err) { 
      console.error("Stream Error:", err);
      setMessages(prev => {
        const n = [...prev];
        const last = n[n.length - 1];
        if (last && last.role === "assistant") {
          last.content = "❌ **Connection Error:** " + err.message + ". Please try again.";
          last.isThinking = false;
        } else {
          n.push({ role: "assistant", content: "❌ **Connection Error:** " + err.message, isThinking: false });
        }
        return n;
      });
    } finally {
      if (activeRequestRef.current === currentRequestId) {
        setLoading(false);
        setChatDisabled(false);
      }
    }
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
    setActiveMCQ(null);
    triggerBackendChat(text, phase, null);
  };

  const handleMCQSelect = (question, answer) => {
    setActiveMCQ(null);
    triggerBackendChat(answer, "setup", null);
  };

  const handleMCQSkip = () => setActiveMCQ(null);
  const handleHistoryClick = (path) => onFinish(path.id);
  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div style={{ height: "100vh", display: "flex", background: "#fff", overflow: "hidden", fontFamily: "inherit" }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: "72px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", background: "#5A72F6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, boxShadow: "0 2px 8px rgba(90, 114, 246, 0.2)" }}>
              <LogoIcon />
            </div>
            <span style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", letterSpacing: "-0.02em" }}>NeuroPath</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={() => onFinish(null)} style={{ background: "#fff", color: "#5A72F6", border: "1.5px solid #5A72F6", borderRadius: "8px", padding: "10px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 12h6M12 9v6"></path></svg>
              Dashboard
            </button>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, fontWeight: "600", fontSize: "14px", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${metadata.avatar_seed}`} alt="avatar" style={{ width: "95%", height: "95%" }} />
            </div>
          </div>
        </header>

        {phase === "input" ? (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", background: "#f8fafc" }}>
            <div style={{ width: "100%", maxWidth: "600px" }}>
              <h1 style={{ fontSize: "36px", fontWeight: "800", letterSpacing: "-0.03em", color: "#1e293b", textAlign: "center", marginBottom: "8px" }}>Where do you want to go?</h1>
              <p style={{ textAlign: "center", color: "#64748b", fontSize: "15px", marginBottom: "40px" }}>Let our AI build your personalized roadmap.</p>
              <form onSubmit={handleStartChat} style={{ background: "#fff", borderRadius: "16px", padding: "28px", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b", display: "block", marginBottom: "8px" }}>Your Learning Goal</label>
                <textarea value={inputGoal} onChange={e => setInputGoal(e.target.value)} placeholder="e.g., Master React, build a SaaS product, learn machine learning..." style={{ width: "100%", minHeight: "100px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "14px", resize: "vertical", fontSize: "14px", color: "#1e293b", lineHeight: "1.6", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                <button type="submit" disabled={!inputGoal.trim()} style={{ width: "100%", marginTop: "24px", padding: "14px", background: inputGoal.trim() ? "#5A72F6" : "#e2e8f0", color: inputGoal.trim() ? "#fff" : "#94a3b8", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "600", cursor: inputGoal.trim() ? "pointer" : "not-allowed", transition: "all 0.2s", fontFamily: "inherit" }}>
                  ✦ Generate My Path
                </button>
              </form>
            </div>
          </div>
        ) : (
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

                {phase === "generate" && loading && !hasStarted && (
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "60px 40px", textAlign: "center", marginTop: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", animation: "pulseOpacity 2s infinite ease-in-out" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
                      <div className="spinner" style={{ width: "48px", height: "48px", borderWidth: "4px" }} />
                    </div>
                    <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", margin: "0 0 12px" }}>Generating Your Neural Map</h2>
                    <p style={{ color: "#64748b", fontSize: "15px", maxWidth: "400px", margin: "0 auto", lineHeight: "1.6" }}>We're designing a personalized syllabus based on your profile. This usually takes 5-10 seconds...</p>
                  </div>
                )}

                {messages.filter(m => !m.content?.startsWith("HIDDEN_PROMPT:") && !(m.role === "assistant" && m.content?.trim().startsWith("{"))).map((msg, i, arr) => {
                  const isLast = i === arr.length - 1;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: "12px", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row", maxWidth: "85%" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: msg.role === "user" ? "#f8fafc" : "#5A72F6", color: msg.role === "user" ? "#5A72F6" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "17px", overflow: "hidden", border: msg.role === "user" ? "1px solid #e2e8f0" : "none" }}>
                        {msg.role === "user" ? <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${metadata.avatar_seed}`} alt="avatar" style={{ width: "95%", height: "95%" }} /> : <LogoIcon />}
                      </div>
                      <div style={{ background: msg.role === "user" ? "#5A72F6" : "#f8fafc", color: msg.role === "user" ? "#fff" : "#1e293b", padding: "8px 14px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "0 22px 22px 22px", fontSize: "15px", boxShadow: msg.role === "user" ? "0 4px 12px rgba(90,114,246,0.2)" : "none", border: "none" }}>
                        <div className="markdown-content" style={{ width: "100%" }}>
                          {msg.role === "user" ? <span style={{ color: "#fff" }}>{msg.content}</span> : (
                            <>
                              <SyllabusRenderer content={msg.content} />
                              {isLast && loading && (
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: msg.content ? "12px" : "0", paddingTop: msg.content ? "12px" : "0", borderTop: msg.content ? "1px solid #f1f5f9" : "none" }}>
                                  <div className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2.5px", borderTopColor: "#5A72F6", opacity: 0.8 }} />
                                  <span style={{ color: "#94a3b8", fontSize: "14px" }}>
                                    {msg.status || statusMessage || (phase === "generate" ? "Generating Map..." : "Thinking...")}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div style={{ padding: "0 40px 32px", flexShrink: 0 }}>
              <div style={{ maxWidth: "780px", margin: "0 auto", position: "relative" }}>
                {activeMCQ && (
                  <div className="mcq-docked-container">
                    <MCQCard questions={activeMCQ} onSelect={handleMCQSelect} onSkip={handleMCQSkip} />
                  </div>
                )}

                {phase !== "done" ? (
                  <form onSubmit={handleSend} style={{ position: "relative", display: "flex", flex: 1 }}>
                    <button type="button" onClick={() => setResearchEnabled(!researchEnabled)} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", background: researchEnabled ? "rgba(90, 114, 246, 0.1)" : "transparent", color: researchEnabled ? "#5A72F6" : "#94a3b8", border: researchEnabled ? "1px solid rgba(90, 114, 246, 0.2)" : "1px solid #e2e8f0", borderRadius: "14px", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    </button>

                    <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="Type your response..." disabled={chatDisabled} style={{ flex: 1, padding: "16px 60px 16px 54px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "15px", outline: "none", background: "#fff", fontFamily: "inherit" }} />

                    {phase === "setup" && !activeMCQ && !loading && (
                      <button type="button" onClick={() => triggerBackendChat("HIDDEN_PROMPT: I've provided all my details. Please synthesize my profile and build my roadmap now.", "setup", null)} style={{ position: "absolute", right: "56px", top: "50%", transform: "translateY(-50%)", background: "rgba(90, 114, 246, 0.1)", color: "#5A72F6", border: "1px solid rgba(90, 114, 246, 0.2)", borderRadius: "10px", padding: "6px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer", zIndex: 10 }}>✦ Finish</button>
                    )}

                    <button type="submit" disabled={chatDisabled || !inputValue.trim()} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: (chatDisabled || !inputValue.trim()) ? "#f1f5f9" : "#5A72F6", color: (chatDisabled || !inputValue.trim()) ? "#94a3b8" : "#fff", border: "none", borderRadius: "10px", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", cursor: (chatDisabled || !inputValue.trim()) ? "not-allowed" : "pointer" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                    </button>
                  </form>
                ) : (
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <button onClick={() => onFinish(generatedPathId)} style={{ padding: "16px 48px", background: "#5A72F6", color: "#fff", border: "none", borderRadius: "14px", fontSize: "17px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 24px rgba(90, 114, 246, 0.35)" }}>✦ View My New Path</button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
