import { useState, useEffect, useRef } from "react";
import "../styles/pages.css";
import { LogoIcon } from "../components/Icons";

export default function SetupChatPage({ goal, difficulty, commitment, onBack, onFinish }) {
  const [messages, setMessages] = useState(goal ? [{ role: "user", content: goal }] : []);
  const initialized = useRef(false);
  const [inputValue, setInputValue] = useState("");
  const [phase, setPhase] = useState("setup"); // "setup" | "generate" | "done"
  const [loading, setLoading] = useState(true);
  const [chatDisabled, setChatDisabled] = useState(true);
  const [generatedPathId, setGeneratedPathId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Boot
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initializeChat = async () => {
      // 1. Update Goal in DB
      try {
        const token = localStorage.getItem('token');
        await fetch('/api/auth/me/goal', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ goal: `${goal} (${difficulty}, ${commitment})` })
        });

        // 2. Trigger first hidden message to knowledge-setup
        triggerBackendChat("HIDDEN_PROMPT: Hello, I am ready to start my assessment. Please ask me questions to gauge my experience.", "setup");
      } catch (err) {
        console.error("Failed to init", err);
      }
    };
    initializeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isDebugMode, setIsDebugMode] = useState(false);

  const triggerBackendChat = async (userText, currentPhase) => {
    setChatDisabled(true);
    setLoading(true);

    // Add user message to UI state (filter out hidden prefix for display if we ever wanted to show it, but we won't show HIDDEN)
    if (userText) {
      setMessages(prev => [...prev, { role: "user", content: userText }]);
    }

    const endpoint = currentPhase === "setup"
      ? "/api/chat/knowledge-setup"
      : "/api/chat/generate-path";

    try {
      const token = localStorage.getItem('token');

      // Filter out hidden prompts from the history being sent so the AI doesn't see "HIDDEN_PROMPT:" strings in history
      const requestMessages = messages
        .filter(m => !m.content.startsWith("HIDDEN_PROMPT:"))
        .map(m => ({ role: m.role, content: m.content }));

      let finalUserText = userText;
      if (userText && userText.startsWith("HIDDEN_PROMPT:")) {
        finalUserText = userText.replace("HIDDEN_PROMPT:", "").trim();
      }

      if (finalUserText) {
        requestMessages.push({ role: "user", content: finalUserText });
      }

      const response = await fetch(`${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: requestMessages,
          provider: "openrouter",
          use_openrouter: true,
          debug_mode: isDebugMode
        })
      });

      if (!response.body) throw new Error("No readable stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = "";
      let hasStarted = false;
      let lastWordCount = 0;

      // Add a blank AI message to stream into
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the partial line in the buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.replace('data: ', '').trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              console.error("Backend AI Error:", data.error);
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = "Error connecting to AI: " + data.error;
                return newMsgs;
              });
            } else if (data.text) {
              if (!hasStarted) {
                hasStarted = true;
                setLoading(false); // Hide the spinner as soon as text starts flowing
              }
              aiMessage += data.text;

              // Count words in the current accumulated message
              const words = aiMessage.trim().split(/\s+/);
              const currentWordCount = words.length;

              // Only update UI every 5 words (or if the first word just arrived)
              if (currentWordCount === 1 || currentWordCount - lastWordCount >= 5) {
                lastWordCount = currentWordCount;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = aiMessage;
                  return newMsgs;
                });
              }
            } else if (data.status === "complete") {
              // Ensure final message is set correctly
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = aiMessage;
                return newMsgs;
              });

              if (data.path_id) {
                setGeneratedPathId(data.path_id);
              }

              if (currentPhase === "setup") {
                setPhase("generate");
                setTimeout(() => {
                  triggerBackendChat("HIDDEN_PROMPT: Excellent, my knowledge profile has been updated. Please propose a syllabus outline for me.", "generate");
                }, 1000);
              } else if (currentPhase === "generate") {
                setMessages(prev => [...prev, {
                  role: "assistant",
                  content: "✨ Your personalized learning dashboard has been created! Your custom roadmap is ready for you to explore."
                }]);
                setPhase("done");
              }
            }
          } catch (e) {
            console.error("Partial JSON chunk skip", e);
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setLoading(false);
      setChatDisabled(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || chatDisabled) return;
    const text = inputValue;
    setInputValue("");
    triggerBackendChat(text, phase);
  };

  return (
    <div className="page-enter" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* NAV */}
      <nav className="np-nav" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="np-logo" onClick={onBack} style={{ cursor: "pointer" }}>
          <div className="np-logo-icon"><LogoIcon /></div>
          <span className="np-logo-text">NeuroPath</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button
            onClick={() => setIsDebugMode(!isDebugMode)}
            style={{
              background: isDebugMode ? "#ef4444" : "#f1f5f9",
              color: isDebugMode ? "#fff" : "#64748b",
              border: "none",
              borderRadius: "20px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            {isDebugMode ? "⚡ GOD MODE" : "🪲 DEBUG"}
          </button>
          <button onClick={() => onFinish(null)} style={{ background: "none", border: "none", color: "#64748b", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
            Dashboard
          </button>
        </div>
      </nav>

      {/* FULL WIDTH SCROLLABLE AREA */}
      <div className="chat-window hide-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0" }}>

        {/* CENTERED CONTENT */}
        <div style={{ width: "100%", maxWidth: "800px", padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>

          <div style={{ marginBottom: "8px", textAlign: "center" }}>
            <h1 className="mp-heading fu d1" style={{ fontSize: "28px", color: isDebugMode ? "#ef4444" : "inherit" }}>
              {phase === "setup" ? (isDebugMode ? "God Mode: Skip Assessment" : "Assessing Your Knowledge") : phase === "generate" ? "Designing your Syllabus" : "Your Path is Ready!"}
            </h1>
          </div>

          {(() => {
            const filtered = messages.filter(m => {
              if (m.content.startsWith("HIDDEN_PROMPT:")) return false;
              if (m.role === "assistant" && m.content.trim().startsWith("{") && m.content.includes("user_profile")) return false;
              return true;
            });

            return filtered.map((msg, i) => {
              const isLast = i === filtered.length - 1;
              const isEmptyAssistant = msg.role === "assistant" && msg.content === "";

              return (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "12px",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  maxWidth: "85%",
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: msg.role === "user" ? "#e0e7ff" : "#5A72F6",
                    color: msg.role === "user" ? "#5A72F6" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: "18px"
                  }}>
                    {msg.role === "user" ? "👤" : <LogoIcon />}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    background: msg.role === "user" ? "#5A72F6" : "#fff",
                    color: msg.role === "user" ? "#fff" : "#1f2937",
                    padding: "16px 20px",
                    borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    fontSize: "15px",
                    boxShadow: msg.role === "user" ? "0 2px 8px rgba(90,114,246,0.2)" : "0 2px 12px rgba(0,0,0,0.04)",
                    border: msg.role === "user" ? "none" : "1px solid #e5e7eb",
                    minWidth: isEmptyAssistant && loading && isLast ? "80px" : "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    {isEmptyAssistant && loading && isLast ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="spinner" style={{ width: "18px", height: "18px", margin: 0 }} />
                        <span style={{ color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>
                          {phase === "generate" ? "Building your custom syllabus..." : "AI is thinking..."}
                        </span>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {/* No separate loading block needed anymore as it's handled inside the message bubble */}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* PINNED INPUT AREA */}
      <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto", padding: "0 24px 32px 24px" }}>
        {phase !== "done" ? (
          <form onSubmit={handleSend} style={{ position: "relative", display: "flex" }}>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Type your response..."
              disabled={chatDisabled}
              style={{
                flex: 1,
                padding: "20px 60px 20px 24px",
                borderRadius: "32px",
                border: "1px solid #e5e7eb",
                fontSize: "16px",
                outline: "none",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                background: "#fff"
              }}
            />
            <button
              type="submit"
              disabled={chatDisabled || !inputValue.trim()}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: (chatDisabled || !inputValue.trim()) ? "#e5e7eb" : "#5A72F6",
                color: (chatDisabled || !inputValue.trim()) ? "#9ca3af" : "#fff",
                border: "none",
                borderRadius: "50%",
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: (chatDisabled || !inputValue.trim()) ? "not-allowed" : "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => onFinish(generatedPathId)}
              className="btn-login-primary"
              style={{ display: "inline-block", maxWidth: "240px", padding: "12px 24px", fontSize: "15px" }}
            >
              ✦ Go to My Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
