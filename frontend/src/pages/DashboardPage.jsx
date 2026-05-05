import { useState, useEffect, useRef } from "react";
import { LogoIcon } from "../components/Icons";
import TextSelectionWrapper from "../components/TextSelectionWrapper";
import ConfusionChat from "../components/ConfusionChat";
import "../styles/pages.css";

// Format inline markdown (bold, inline code)
const formatInline = (text) => {
  // Split by bold and inline code patterns
  const parts = [];
  let lastIndex = 0;
  const boldRegex = /\*\*(.*?)\*\*/g;
  const inlineCodeRegex = /`([^`]+)`/g;

  // Create a combined regex to find all markdown elements in order
  const combined = text.replace(
    /(\*\*.*?\*\*|`[^`]+`)/g,
    (match) => {
      if (match.startsWith("**")) {
        return `__BOLD_START__${match.slice(2, -2)}__BOLD_END__`;
      } else if (match.startsWith("`")) {
        return `__CODE_START__${match.slice(1, -1)}__CODE_END__`;
      }
      return match;
    }
  );

  // Split by markers and reconstruct with JSX
  return combined.split(/(__BOLD_START__|__BOLD_END__|__CODE_START__|__CODE_END__)/).map((fragment, idx) => {
    if (fragment === "__BOLD_START__") return null;
    if (fragment === "__BOLD_END__") return null;
    if (fragment === "__CODE_START__") return null;
    if (fragment === "__CODE_END__") return null;

    // Check if this should be bold or code
    const isBold = combined.substring(0, combined.indexOf(fragment)).match(/__BOLD_START__/g)?.length >
      combined.substring(0, combined.indexOf(fragment)).match(/__BOLD_END__/g)?.length;
    const isCode = combined.substring(0, combined.indexOf(fragment)).match(/__CODE_START__/g)?.length >
      combined.substring(0, combined.indexOf(fragment)).match(/__CODE_END__/g)?.length;

    if (isBold) {
      return <strong key={idx}>{fragment}</strong>;
    }
    if (isCode) {
      return (
        <code
          key={idx}
          style={{
            background: "#f1f5f9",
            color: "#5A72F6",
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "13px",
            fontWeight: "600"
          }}
        >
          {fragment}
        </code>
      );
    }
    return fragment;
  }).filter(Boolean);
};

// Code block renderer with terminal styling
const renderMessage = (content) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      // Check for standalone code lines in the text
      const lines = textBefore.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        // Detect if this line looks like code (contains common programming patterns)
        const looksLikeCode = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\[.*?\])?.*[=;{}\(\)].*/.test(trimmed);
        if (looksLikeCode && trimmed.length > 10 && !trimmed.includes(" is ") && !trimmed.includes(" or ")) {
          // This looks like a code line
          if (idx > 0) parts.push({ type: "text", content: lines.slice(0, idx).join("\n") });
          // Detect language from the code
          let lang = "code";
          if (trimmed.includes("import ") || trimmed.includes("public ") || trimmed.includes("class ")) lang = "java";
          else if (trimmed.includes("def ") || trimmed.includes("import ")) lang = "python";
          else if (trimmed.includes("const ") || trimmed.includes("function ")) lang = "javascript";
          parts.push({ type: "code", language: lang, code: trimmed });
          lines.splice(0, idx + 1);
        } else if (trimmed) {
          parts.push({ type: "text", content: line + (idx < lines.length - 1 ? "\n" : "") });
        }
      });
    }
    // Add code block
    parts.push({ type: "code", language: match[1] || "code", code: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  // If no code blocks found, return plain text
  if (parts.length === 0) {
    return content;
  }

  return parts;
};

export default function DashboardPage({ pathId, onLogout, onNewPath, onGeneratePath, onUpdateKnowledge, user, goToConfusion, isDashboardActive }) {
  const [activeConfusionId, setActiveConfusionId] = useState(null);
  const [activeConfusion, setActiveConfusion] = useState(null);
  const [isConfusionResolved, setIsConfusionResolved] = useState(false);
  const [expandedConfusions, setExpandedConfusions] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [allPaths, setAllPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [view, setView] = useState(pathId ? "map" : "home"); // "home" | "mypaths" | "map" | "progress"
  const [activeNode, setActiveNode] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hoveredConfusionId, setHoveredConfusionId] = useState(null); // Track specific branch hover
  const hoverTimeoutRef = useRef(null);

  const handleNodeMouseEnter = (node) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setActiveNode(node);
  };

  const handleNodeMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveNode(null);
    }, 200);
  };

  const handleTooltipMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleTooltipMouseLeave = () => {
    handleNodeMouseLeave();
  };
  const [selectedModule, setSelectedModule] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [savedTopics, setSavedTopics] = useState(() => {
    const saved = localStorage.getItem("savedTopics");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("savedTopics", JSON.stringify(savedTopics));
  }, [savedTopics]);

  const [savingIds, setSavingIds] = useState(new Set());

  const handleSaveTopic = (topic) => {
    // Add to savingIds to trigger exit animation
    setSavingIds(prev => new Set(prev).add(topic.title));

    // Delay the actual state update to allow animation to finish
    setTimeout(() => {
      const isAlreadySaved = savedTopics.find(t => t.title === topic.title);
      if (isAlreadySaved) {
        setSavedTopics(prev => prev.filter(t => t.title !== topic.title));
      } else {
        setSavedTopics(prev => [...prev, topic]);
      }
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(topic.title);
        return next;
      });
    }, 400); // Duration of our animation
  };

  useEffect(() => {
    const filtered = recommendations.filter(rec => !savedTopics.some(s => s.title === rec.title));
    if (filtered.length < 3 && recommendations.length > 0) {
      // Trigger a fresh fetch if we're running low on new suggestions
      fetchRecommendations();
    }
  }, [savedTopics, recommendations]);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef(null);
  const confusionChatRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (selectedModule) {
      setChatMessages([]); // Clear previous messages instantly for a clean transition
      fetchChatHistory(selectedModule.id);
      checkUnresolvedConfusion(selectedModule.id);
      if (currentPath) {
        localStorage.setItem(`lastModule_${currentPath.id}`, selectedModule.id);
      }
    }
  }, [selectedModule?.id, currentPath?.id]); // Use IDs to avoid redundant triggers

  useEffect(() => {
    // Reset resolved state when switching side-quests or closing them
    if (!activeConfusionId) {
      setIsConfusionResolved(false);
    }
  }, [activeConfusionId]);

  useEffect(() => {
    if (isDashboardActive && selectedModule) {
      checkUnresolvedConfusion(selectedModule.id);
    }
  }, [isDashboardActive, selectedModule]);

  const checkUnresolvedConfusion = async (moduleId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/confusions/unresolved/${moduleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveConfusion(data || null);
    } catch (err) {
      console.error("Failed to check side-quest status", err);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleNextModule = async () => {
    if (!currentPath || !selectedModule) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/learning-paths/${currentPath.id}/graph`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCurrentPath(data);

      const next = data.modules?.find(m => m.order_index === selectedModule.order_index + 1);
      if (next && next.status !== "locked") {
        setSelectedModule(next);
      }
    } catch (err) {
      console.error("Failed to navigate", err);
    }
  };

  const fetchChatHistory = async (moduleId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/modules/${moduleId}/chat`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.length === 0) {
        handleSendMessage("INIT_MODULE_WELCOME", true);
      } else {
        setChatMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch chat history", err);
    }
  };

  const handleSendMessage = async (textOverride, isSilentInit = false) => {
    const text = textOverride || chatInput;
    if (!text.trim() || isStreaming) return;

    if (activeConfusionId && confusionChatRef.current && !isSilentInit) {
      confusionChatRef.current.handleExternalSend(text);
      setChatInput("");
      return;
    }

    if (!isSilentInit) {
      setChatMessages(prev => [...prev, { role: "user", content: text }]);
      setChatInput("");
    }

    setIsStreaming(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:8000/api/modules/${selectedModule.id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: text,
          provider: "openrouter",
          debug_mode: isDebugMode
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = { role: "assistant", content: "" };
      let lineBuffer = "";
      let messageAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.text) {
                aiMessage.content += data.text;
                if (!messageAdded) {
                  messageAdded = true;
                  setChatMessages(prev => [...prev, aiMessage]);
                } else {
                  setChatMessages(prev => {
                    const last = prev[prev.length - 1];
                    return [...prev.slice(0, -1), { ...last, content: aiMessage.content }];
                  });
                }
              }

              if (data.status === "complete") {
                const pathIdToRefresh = currentPath?.id || selectedModule?.learning_path_id || localStorage.getItem("lastReadPathId");
                if (pathIdToRefresh) {
                  setTimeout(() => {
                    loadSpecificPath(pathIdToRefresh, null, true); // stayOnCurrentView = true
                    fetchAllPaths(); // Sync the global list
                  }, 1000);
                }
              }
            } catch (e) {
              console.error("SSE Parse Error", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error", err);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleNodeClick = (node) => {
    if (node.status === "locked") return;
    setSelectedModule(node);
    setView("progress");
  };

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  useEffect(() => {
    fetchAllPaths();
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/recommendations/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ use_deepseek: true })
      });
      const data = await res.json();
      const newRecs = data.recommendations || [];

      setRecommendations(prev => {
        // Merge and avoid duplicates by title
        const existingTitles = new Set(prev.map(r => r.title));
        const uniqueNew = newRecs.filter(r => !existingTitles.has(r.title));
        return [...prev, ...uniqueNew];
      });
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    }
  };

  useEffect(() => {
    if (pathId) {
      loadSpecificPath(pathId);
    }
  }, [pathId]);

  const fetchAllPaths = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/learning-paths", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAllPaths(data);
    } catch (err) {
      console.error("Failed to fetch paths", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificPath = async (id, targetModuleId = null, stayOnCurrentView = false) => {
    if (!stayOnCurrentView) setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/learning-paths/${id}/graph`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load graph");
      const data = await res.json();

      // Safety check: Don't set currentPath if modules are missing
      if (!data.modules || data.modules.length === 0) {
        console.warn("Received empty or invalid path graph", data);
        return;
      }

      setCurrentPath(data);

      // Resumption logic: targetModuleId > localStorage > first unlocked > first module
      if (!stayOnCurrentView) {
        const savedModuleId = targetModuleId || localStorage.getItem(`lastModule_${id}`);
        const currentModule = data.modules?.find(m => m.id === savedModuleId) ||
          data.modules?.find(m => m.status === "unlocked") ||
          data.modules?.[0];

        if (currentModule) setSelectedModule(currentModule);
      } else if (selectedModule) {
        // Sync the status of the currently selected module if it changed in the background
        const updatedSelf = data.modules?.find(m => m.id === selectedModule.id);
        if (updatedSelf && updatedSelf.status !== selectedModule.status) {
          setSelectedModule(updatedSelf);
        }
      }

      if (!stayOnCurrentView) {
        setView("map");
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }

      // Save last read path
      localStorage.setItem("lastReadPathId", id);
    } catch (err) {
      console.error("Failed to load path", err);
    } finally {
      if (!stayOnCurrentView) setLoading(false);
    }
  };

  const handleProgressClick = () => {
    if (currentPath) {
      setView("progress");
      // Ensure a module is selected
      if (!selectedModule && currentPath.modules?.length > 0) {
        const savedId = localStorage.getItem(`lastModule_${currentPath.id}`);
        const next = currentPath.modules.find(m => m.id === savedId) ||
          currentPath.modules.find(m => m.status === "unlocked") ||
          currentPath.modules[0];
        setSelectedModule(next);
      }
    } else {
      const lastId = localStorage.getItem("lastReadPathId");
      if (lastId) {
        loadSpecificPath(lastId).then(() => setView("progress"));
      } else if (allPaths.length > 0) {
        loadSpecificPath(allPaths[0].id).then(() => setView("progress"));
      } else {
        setView("mypaths");
      }
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;
    const newZoom = Math.min(Math.max(zoom + delta * zoomSpeed, 0.2), 3);
    setZoom(newZoom);
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  if (loading && !allPaths.length) {
    return (
      <div className="np-dashboard-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const nodes = currentPath?.modules ? currentPath.modules.map((mod, i) => ({
    ...mod,
    x: 280 * Math.cos((i / currentPath.modules.length) * 2 * Math.PI - Math.PI / 2),
    y: 280 * Math.sin((i / currentPath.modules.length) * 2 * Math.PI - Math.PI / 2)
  })) : [];

  return (
    <div className="np-dashboard-container" style={{ display: "flex", height: "100vh", background: "#f8fafc" }}>

      <aside className={`np-sidebar ${isSidebarCollapsed ? "collapsed" : ""}`} style={{
        background: "#fff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        zIndex: 20,
        overflow: "hidden"
      }}>
        <div className="sidebar-header" style={{
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: isSidebarCollapsed ? "center" : "space-between",
          padding: isSidebarCollapsed ? "0" : "0 24px",
          borderBottom: "1px solid #f1f5f9",
          marginBottom: "24px"
        }}>
          {!isSidebarCollapsed && (
            <div className="np-logo" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="np-logo-icon" style={{ flexShrink: 0, width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}><LogoIcon /></div>
              <span className="np-logo-text">NeuroPath</span>
            </div>
          )}

          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              flexShrink: 0
            }}
          >
            <div style={{ width: "16px", height: "2px", background: "#64748b", borderRadius: "1px" }} />
            <div style={{ width: "12px", height: "2px", background: "#64748b", borderRadius: "1px" }} />
            <div style={{ width: "16px", height: "2px", background: "#64748b", borderRadius: "1px" }} />
          </button>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", width: "100%", padding: "0 12px" }}>
          {[
            { id: "home", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>, label: "Home" },
            { id: "mypaths", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>, label: "My Paths" },
            { id: "progress", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>, label: "Progress", onClick: handleProgressClick },
            { id: "assessment", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>, label: "Assessment History" },
          ].map(item => (
            <div
              key={item.id}
              className={`sidebar-item ${view === item.id ? "active" : ""}`}
              onClick={() => item.onClick ? item.onClick() : setView(item.id)}
              title={isSidebarCollapsed ? item.label : ""}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}

          <div className="sidebar-section-header">
            Personal Nodes
          </div>

          {[
            { id: "saved", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>, label: "Saved Topics" },
            { id: "settings", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>, label: "Settings" },
          ].map(item => (
            <div
              key={item.id}
              className={`sidebar-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
              title={isSidebarCollapsed ? item.label : ""}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer" style={{
          marginTop: "auto",
          padding: isSidebarCollapsed ? "20px 0" : "16px 12px",
          borderTop: "1px solid var(--gray-border)",
          width: "100%",
          position: "relative",
          fontFamily: "var(--font-body)"
        }}>
          {/* PROFILE CONTEXT MENU */}
          {showDropdown && (
            <div style={{
              position: "absolute",
              bottom: "100%",
              left: isSidebarCollapsed ? "12px" : "12px",
              width: "220px",
              background: "var(--white)",
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              border: "1px solid var(--gray-border)",
              padding: "8px",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              marginBottom: "12px",
              animation: "slideUp 0.15s ease-out",
              fontFamily: "var(--font-body)"
            }}>
              {/* Profile */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", color: "var(--dark)", fontSize: "14px", fontWeight: "600" }} className="dropdown-item">
                <span style={{ color: "var(--gray)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></span>
                Profile
              </div>

              {/* Help */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", color: "var(--dark)", fontSize: "14px", fontWeight: "600" }} className="dropdown-item">
                <span style={{ color: "var(--gray)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></span>
                Help
              </div>

              <div style={{ height: "1px", background: "var(--gray-border)", margin: "4px 8px" }} />

              {/* Logout */}
              <div onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", color: "#ef4444", fontSize: "14px", fontWeight: "700" }} className="dropdown-item logout-red-hover">
                <span style={{ color: "inherit" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
                Log out
              </div>
            </div>
          )}

          <div
            onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isSidebarCollapsed ? "center" : "space-between",
              width: "100%",
              gap: "12px",
              padding: isSidebarCollapsed ? "0" : "0 8px",
              cursor: "pointer"
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "var(--blue-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                border: "1.5px solid var(--white)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                flexShrink: 0
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              {!isSidebarCollapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-display)" }}>{user?.name || "Sujan Maharjan"}</div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--gray)" }}>Free</div>
                </div>
              )}
            </div>

            {!isSidebarCollapsed && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: showDropdown ? "rotate(90deg)" : "none" }}><path d="m9 18 6-6-6-6" /></svg>
            )}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

        {/* TOPBAR */}
        <header style={{
          height: "72px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          justifyContent: "space-between",
          zIndex: 20,
          gap: "24px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "400px" }}>
              {view === "home" ? "My Learning Paths" : `Path: ${currentPath?.title}`}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", flexShrink: 0 }}>
            <button
              onClick={onUpdateKnowledge}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 16px", borderRadius: "8px",
                background: "#fff", color: "#5A72F6",
                border: "1.5px solid #5A72F6", fontSize: "14px", fontWeight: "600",
                cursor: "pointer", transition: "all 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.boxShadow = "0 0 12px rgba(90, 114, 246, 0.15)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2" /></svg>
              <span>Update Knowledge</span>
            </button>
            <button
              onClick={onNewPath}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 16px", borderRadius: "8px",
                background: "rgba(248, 250, 252, 0.5)", color: "#5A72F6",
                border: "1.5px dashed #5A72F6", fontSize: "14px", fontWeight: "600",
                cursor: "pointer", transition: "all 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = "0 0 12px rgba(90, 114, 246, 0.25)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(248, 250, 252, 0.5)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: "1px dashed currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "900" }}>+</div>
              <span>Create Path</span>
            </button>

          </div>
        </header>

        {/* BREADCRUMBS */}
        {view !== "home" && (
          <div style={{
            height: "40px",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            padding: "0 32px",
            gap: "8px",
            fontSize: "12px",
            fontWeight: "600",
            color: "#94a3b8",
            zIndex: 15
          }}>
            <div
              onClick={() => setView("home")}
              style={{ cursor: "pointer", transition: "color 0.2s" }}
              onMouseOver={(e) => e.target.style.color = "#5A72F6"}
              onMouseOut={(e) => e.target.style.color = "#94a3b8"}
            >
              My Paths
            </div>

            {currentPath && (
              <>
                <span>/</span>
                <div
                  onClick={() => setView("map")}
                  style={{
                    cursor: "pointer",
                    transition: "color 0.2s",
                    color: view === "map" ? "#1e293b" : "#94a3b8"
                  }}
                  onMouseOver={(e) => e.target.style.color = "#5A72F6"}
                  onMouseOut={(e) => e.target.style.color = view === "map" ? "#1e293b" : "#94a3b8"}
                >
                  Nodes
                </div>
              </>
            )}

            {selectedModule && (view === "progress") && (
              <>
                <span>/</span>
                <div style={{ color: "#1e293b", fontWeight: "700" }}>
                  {selectedModule.title}
                </div>
              </>
            )}
          </div>
        )}

        {/* CONTENT AREA */}
        <div onClick={() => setShowDropdown(false)} style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          {view === "home" ? (
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "40px" }}>
              <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", marginBottom: "24px" }}>Continue Learning</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px", marginBottom: "48px" }}>
                  {allPaths.slice(0, 3).map(path => (
                    <div key={path.id} onClick={() => loadSpecificPath(path.id)} style={{ background: "#fff", borderRadius: "16px", border: "1px solid #f1f5f9", padding: "24px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "16px", minHeight: "160px", justifyContent: "space-between", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", transition: "all 0.2s" }} onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#e2e8f0"; }} onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = "#f1f5f9"; }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: path.total_modules > 0 && (path.completed_modules / path.total_modules) * 100 === 100 ? "#10b981" : "#5A72F6" }} />
                          <span style={{ fontSize: "11px", fontWeight: "700", color: path.total_modules > 0 && (path.completed_modules / path.total_modules) * 100 === 100 ? "#10b981" : "#5A72F6", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {path.total_modules > 0 && (path.completed_modules / path.total_modules) * 100 === 100 ? "Completed" : "Active"}
                          </span>
                        </div>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            cursor: 'pointer',
                            color: '#5A72F6',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            transition: 'background 0.2s',
                          }}
                          title="Check Map"
                          onClick={e => { e.stopPropagation(); loadSpecificPath(path.id); setView('map'); }}
                          onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseOut={e => e.currentTarget.style.background = 'none'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4l3 3" />
                          </svg>
                        </button>
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", marginTop: "4px" }}>
                        <h3 style={{ margin: "0", fontSize: "15px", fontWeight: "700", color: "#1e293b", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}>{path.overall_target}</h3>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>Created {new Date(path.created_at).toLocaleDateString()}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, height: "4px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}><div style={{ width: `${path.total_modules > 0 ? (path.completed_modules / path.total_modules) * 100 : 0}%`, height: "100%", background: "#5A72F6", transition: "width 0.5s ease-out" }} /></div>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>{path.total_modules > 0 ? Math.round((path.completed_modules / path.total_modules) * 100) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", marginBottom: "24px" }}>Recommended For You</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
                  {(() => {
                    // Include items that are in savingIds so they can animate out
                    const filteredRecs = recommendations.filter(rec =>
                      !savedTopics.some(s => s.title === rec.title) || savingIds.has(rec.title)
                    );
                    const displayRecs = filteredRecs.slice(0, 3);

                    if (displayRecs.length > 0) {
                      return displayRecs.map((rec, i) => {
                        const isSaved = savedTopics.some(t => t.title === rec.title);
                        const isExiting = savingIds.has(rec.title);

                        return (
                          <div key={rec.title} className={isExiting ? "card-exit" : ""} style={{
                            background: "#fff",
                            borderRadius: "16px",
                            border: "1px solid #f1f5f9",
                            padding: "24px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                            transition: "all 0.2s",
                            position: "relative",
                            visibility: isExiting && isSaved ? "hidden" : "visible" // Hide if it finished saving but still in list briefly
                          }} onMouseOver={e => { if (!isExiting) { e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#e2e8f0"; } }} onMouseOut={e => { if (!isExiting) { e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = "#f1f5f9"; } }}>

                            <button
                              onClick={(e) => { e.stopPropagation(); handleSaveTopic(rec); }}
                              style={{
                                position: "absolute",
                                top: "16px",
                                right: "16px",
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: isSaved ? "#5A72F6" : "rgba(241, 245, 249, 0.8)",
                                color: isSaved ? "#fff" : "#94a3b8",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                zIndex: 2
                              }}
                              title={isSaved ? "Unsave Topic" : "Save Topic"}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                            </button>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ padding: "4px 10px", borderRadius: "20px", background: rec.type === "Project" ? "#fef3c7" : "#e0e7ff", color: rec.type === "Project" ? "#92400e" : "#3730a3", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>{rec.type}</div>
                            </div>
                            <h3 style={{ margin: "0", fontSize: "15px", fontWeight: "700", color: "#1e293b", paddingRight: "30px" }}>{rec.title}</h3>
                            <p style={{ margin: "0", fontSize: "12px", color: "#64748b", lineHeight: "1.5", flex: 1 }}>{rec.description}</p>
                            <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                              <button
                                onClick={() => onGeneratePath(rec.title)}
                                style={{
                                  flex: 1, padding: "10px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#5A72F6",
                                  fontSize: "13px", fontWeight: "600", letterSpacing: "0.02em", cursor: "pointer", transition: "all 0.2s"
                                }}
                                onMouseOver={(e) => e.target.style.background = "#eff6ff"}
                                onMouseOut={(e) => e.target.style.background = "#f8fafc"}
                              >
                                Generate Path
                              </button>
                            </div>
                          </div>
                        );
                      });
                    } else {
                      return (
                        <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "16px", border: "1px dashed #e2e8f0", color: "#94a3b8" }}>
                          Gathering personalized recommendations based on your activity...
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          ) : view === "mypaths" ? (
            /* MY PATHS VIEW (All Paths Grid) */
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "40px" }}>
              <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", marginBottom: "24px" }}>My Learning Paths</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
                  {allPaths.map(path => (
                    <div
                      key={path.id}
                      onClick={() => loadSpecificPath(path.id)}
                      style={{
                        background: "#fff",
                        borderRadius: "16px",
                        border: "1px solid #f1f5f9",
                        padding: "24px",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                        position: "relative",
                        overflow: "hidden",
                        minHeight: "160px",
                        justifyContent: "space-between",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = "#f1f5f9"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: path.total_modules > 0 && (path.completed_modules / path.total_modules) * 100 === 100 ? "#10b981" : "#5A72F6" }} />
                          <span style={{ fontSize: "11px", fontWeight: "700", color: path.total_modules > 0 && (path.completed_modules / path.total_modules) * 100 === 100 ? "#10b981" : "#5A72F6", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {path.total_modules > 0 && (path.completed_modules / path.total_modules) * 100 === 100 ? "Completed" : "Active"}
                          </span>
                        </div>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            cursor: 'pointer',
                            color: '#5A72F6',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            transition: 'background 0.2s',
                          }}
                          title="Check Map"
                          onClick={e => { e.stopPropagation(); loadSpecificPath(path.id); setView('map'); }}
                          onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseOut={e => e.currentTarget.style.background = 'none'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4l3 3" />
                          </svg>
                        </button>
                      </div>

                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", marginTop: "4px" }}>
                        <h3 style={{ margin: "0", fontSize: "15px", fontWeight: "700", color: "#1e293b", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {path.overall_target}
                        </h3>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>Created {new Date(path.created_at).toLocaleDateString()}</p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, height: "4px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{
                            width: `${path.total_modules > 0 ? (path.completed_modules / path.total_modules) * 100 : 0}%`,
                            height: "100%",
                            background: "#5A72F6",
                            transition: "width 0.5s ease-out"
                          }} />
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
                          {path.total_modules > 0 ? Math.round((path.completed_modules / path.total_modules) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : view === "saved" ? (
            /* SAVED TOPICS VIEW */
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "40px" }}>
              <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", marginBottom: "24px" }}>Saved Topics</h2>
                {savedTopics.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
                    {savedTopics.map((topic, i) => {
                      const isExiting = savingIds.has(topic.title);
                      return (
                        <div key={topic.title} className={isExiting ? "card-exit" : ""} style={{
                          background: "#fff",
                          borderRadius: "16px",
                          border: "1px solid #f1f5f9",
                          padding: "24px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                          transition: "all 0.2s",
                          position: "relative",
                          opacity: isExiting ? 0 : 1 // Faster perceived exit
                        }} onMouseOver={e => { if (!isExiting) { e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#e2e8f0"; } }} onMouseOut={e => { if (!isExiting) { e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = "#f1f5f9"; } }}>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleSaveTopic(topic); }}
                            style={{
                              position: "absolute",
                              top: "16px",
                              right: "16px",
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              background: "#5A72F6",
                              color: "#fff",
                              border: "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "all 0.2s",
                              zIndex: 2
                            }}
                            title="Remove from Saved"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                          </button>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ padding: "4px 10px", borderRadius: "20px", background: topic.type === "Project" ? "#fef3c7" : "#e0e7ff", color: topic.type === "Project" ? "#92400e" : "#3730a3", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>{topic.type}</div>
                          </div>
                          <h3 style={{ margin: "0", fontSize: "15px", fontWeight: "700", color: "#1e293b", paddingRight: "30px" }}>{topic.title}</h3>
                          <p style={{ margin: "0", fontSize: "12px", color: "#64748b", lineHeight: "1.5", flex: 1 }}>{topic.description}</p>
                          <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                            <button
                              onClick={() => onGeneratePath(topic.title)}
                              style={{
                                flex: 1, padding: "10px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#5A72F6",
                                fontSize: "13px", fontWeight: "600", letterSpacing: "0.02em", cursor: "pointer", transition: "all 0.2s"
                              }}
                            >
                              Generate Path
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "80px 40px", textAlign: "center", background: "#fff", borderRadius: "24px", border: "2px dashed #f1f5f9" }}>
                    <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔖</div>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>No saved topics yet</h3>
                    <p style={{ color: "#64748b", maxWidth: "300px", margin: "0 auto" }}>Explore your recommendations and save the ones you're interested in for later!</p>
                  </div>
                )}
              </div>
            </div>
          ) : view === "map" ? (
            /* MAP VIEW (Canvas) */
            <div
              style={{
                flex: 1,
                position: "relative",
                cursor: isDragging ? "grabbing" : "grab",
                background: "#f8fafc",
                userSelect: "none",
                WebkitUserSelect: "none"
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <svg ref={svgRef} width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
                <defs>
                  <pattern id="dotGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#e2e8f0" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                <g transform={`translate(${offset.x + (svgRef.current?.clientWidth || 800) / 2}, ${offset.y + (svgRef.current?.clientHeight || 600) / 2}) scale(${zoom})`}>
                  {nodes.map((node, i) => {
                    if (i === 0) return null;
                    const prev = nodes[i - 1];
                    return <line key={`edge-${i}`} x1={prev.x} y1={prev.y} x2={node.x} y2={node.y} stroke="#cbd5e1" strokeWidth="2" />;
                  })}
                  {nodes.length > 2 && <line x1={nodes[nodes.length - 1].x} y1={nodes[nodes.length - 1].y} x2={nodes[0].x} y2={nodes[0].y} stroke="#cbd5e1" strokeWidth="2" />}

                  {nodes.map((node) => {
                    const isCompleted = node.status === "completed";
                    const isUnlocked = node.status === "unlocked";
                    const isLocked = node.status === "locked";
                    const isActive = isUnlocked; // Use unlocked as the 'Current' state

                    const isHovered = activeNode?.id === node.id;

                    return (
                      <g
                        key={node.id}
                        className={isHovered && isLocked ? "node-shake" : ""}
                        style={{
                          cursor: isLocked ? "not-allowed" : "pointer",
                          transformOrigin: `${node.x}px ${node.y}px`,
                          transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                        }}
                        onMouseEnter={() => {
                          handleNodeMouseEnter(node);
                          setShowTooltip(true);
                        }}
                        onMouseLeave={() => {
                          handleNodeMouseLeave();
                          setShowTooltip(false);
                        }}
                        onClick={() => !isLocked && handleNodeClick(node)}
                      >
                        {/* Ripple Effect for Unlocked Nodes */}
                        {isHovered && !isLocked && (
                          <circle
                            className="ripple-circle"
                            cx={node.x} cy={node.y} r="38"
                            fill="none"
                            stroke={isCompleted ? "#10b981" : "#5A72F6"}
                            strokeWidth="2"
                            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                          />
                        )}

                        {/* Pulse Ring for Active Node */}
                        {isActive && (
                          <circle cx={node.x} cy={node.y} r="48" fill="none" stroke="#5A72F6" strokeWidth="2" opacity="0.3">
                            <animate attributeName="r" values="42;52;42" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                          </circle>
                        )}

                        {/* Node Background / Border */}
                        <circle
                          cx={node.x} cy={node.y} r="38"
                          fill={isActive ? "#5A72F6" : isCompleted ? "#10b981" : "#fff"}
                          stroke={isCompleted ? "#10b981" : isActive ? "#5A72F6" : "#e2e8f0"}
                          strokeWidth={isActive || isCompleted ? "0" : "1.5"}
                          strokeDasharray={isLocked ? "4,4" : "none"}
                          style={{
                            transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                            filter: isActive ? "drop-shadow(0 8px 16px rgba(90, 114, 246, 0.3))" : isCompleted ? "drop-shadow(0 4px 8px rgba(16, 185, 129, 0.2))" : "none"
                          }}
                        />

                        {/* Minimal Icons (SVG instead of Text/Emoji) */}
                        {isCompleted && (
                          <g transform={`translate(${node.x - 8}, ${node.y - 8})`}>
                            <path d="M1 8l5 5 9-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </g>
                        )}

                        {isActive && (
                          <g transform={`translate(${node.x - 6}, ${node.y - 8})`}>
                            <path d="M0 0l14 8-14 8z" fill="#fff" />
                          </g>
                        )}

                        {isLocked && (
                          <g transform={`translate(${node.x - 10}, ${node.y - 10})`} opacity="0.6">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="4" y="10" width="16" height="10" rx="1" />
                              <path d="M8 10V6a4 4 0 0 1 8 0v4" />
                            </svg>
                          </g>
                        )}

                        {/* Visual Tree Branching (Strict 3-2-2 Structure) */}
                        {node.confusions && node.confusions.length > 0 && !isLocked && (() => {
                          // Manually structure flat confusions into a visual 3-2-2 tree
                          const buildTree = (list) => {
                            const flat = [...list];
                            const tree = flat.splice(0, 3).map(root => {
                              const children = flat.splice(0, 2).map(child => {
                                return { ...child, children: flat.splice(0, 2) };
                              });
                              return { ...root, children };
                            });
                            return tree;
                          };

                          const visualTree = buildTree(node.confusions);

                          const renderRecursiveBranches = (px, py, baseAngle, children, level = 0) => {
                            return children.map((conf, cIdx) => {
                              const spread = level === 0 ? Math.PI / 2 : Math.PI / 3;
                              const offset = (cIdx - (children.length - 1) / 2) * (spread / Math.max(children.length, 1));
                              const angle = baseAngle + offset;

                              const dist = level === 0 ? 120 : 70;
                              const cx = px + Math.cos(angle) * dist;
                              const cy = py + Math.sin(angle) * dist;
                              const isConfSelected = activeConfusionId === conf.id;

                              return (
                                <g key={conf.id}>
                                  <line
                                    x1={px} y1={py} x2={cx} y2={cy}
                                    stroke={conf.status === "resolved" ? "#10b981" : "#5A72F6"}
                                    strokeWidth={Math.max(1.5, 4 - level * 1.5)}
                                    strokeDasharray="4,4"
                                    opacity={Math.max(0.4, 0.9 - level * 0.25)}
                                  >
                                    <animate attributeName="stroke-dashoffset" from="20" to="0" dur="3s" repeatCount="indefinite" />
                                  </line>

                                  <g 
                                    style={{ cursor: "pointer" }} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedModule(node);
                                      setActiveConfusionId(conf.id);
                                      setView("progress");
                                    }}
                                    onMouseEnter={(e) => {
                                      e.stopPropagation();
                                      setShowTooltip(false);
                                      setHoveredConfusionId(conf.id);
                                    }}
                                    onMouseLeave={() => setHoveredConfusionId(null)}
                                  >
                                    <circle
                                      cx={cx} cy={cy} 
                                      r={Math.max(8, (16 - level * 3) + Math.min(25, (conf.message_count || 0) * 2))}
                                      fill={conf.status === "resolved" ? "#10b981" : "#5A72F6"}
                                      stroke="#fff" strokeWidth="2.5"
                                      style={{ filter: isConfSelected ? "drop-shadow(0 0 15px rgba(90,114,246,0.5))" : "none", transition: "all 0.3s" }}
                                    />
                                  </g>

                                  {conf.children && renderRecursiveBranches(cx, cy, angle, conf.children, level + 1)}

                                  <text
                                    x={cx} y={cy + (level === 0 ? 28 : 18)}
                                    textAnchor="middle" fontSize={Math.max(8, 11 - level)} fontWeight="800" fill="#475569"
                                    style={{ 
                                      pointerEvents: "none", 
                                      opacity: hoveredConfusionId === conf.id ? 1 : 0, 
                                      transition: "opacity 0.2s", 
                                      paintOrder: "stroke", 
                                      stroke: "#fff", 
                                      strokeWidth: "3px", 
                                      strokeLinecap: "round", 
                                      strokeLinejoin: "round" 
                                    }}
                                  >
                                    {conf.title}
                                  </text>
                                </g>
                              );
                            });
                          };

                          return (
                            <g>
                              {renderRecursiveBranches(node.x, node.y, Math.atan2(node.y, node.x), visualTree, 0)}
                            </g>
                          );
                        })()}

                        {/* Minimal Label Below Node */}
                        <text
                          x={node.x}
                          y={node.y + 54}
                          textAnchor="middle"
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            fill: isActive ? "#1e293b" : "#94a3b8",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            pointerEvents: "none",
                            transition: "all 0.3s"
                          }}
                        >
                          {node.title.split(" ")[0]}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Canvas Legend */}
              <div style={{
                position: "absolute",
                bottom: "32px",
                left: "32px",
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(8px)",
                padding: "10px 16px",
                borderRadius: "30px",
                border: "1px solid #e2e8f0",
                display: "flex",
                gap: "20px",
                zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} /> Completed
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#5A72F6" }} /> Current
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#cbd5e1" }} /> Locked
                </div>
              </div>

              {/* Canvas Controls */}
              <div style={{ position: "absolute", bottom: "32px", right: "32px", display: "flex", flexDirection: "column", gap: "8px", zIndex: 10 }}>
                <button
                  onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}
                  style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#fff", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#64748b", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                >+</button>
                <button
                  onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.2))}
                  style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#fff", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#64748b", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                >-</button>
                <button
                  onClick={resetView}
                  style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#fff", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748b", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                >⤢</button>
              </div>

              {/* Tooltip Card (Smart Positioning) */}
              {activeNode && showTooltip && (() => {
                const nodeScreenY = offset.y + (svgRef.current?.clientHeight || 600) / 2 + activeNode.y * zoom;
                const showBelow = nodeScreenY < 240; // Flip if too close to top

                return (
                  <div
                    onMouseEnter={handleTooltipMouseEnter}
                    onMouseLeave={handleTooltipMouseLeave}
                    style={{
                      position: "absolute",
                      top: showBelow
                        ? `${nodeScreenY + 60}px`
                        : `${nodeScreenY - 160}px`,
                      left: `${(offset.x + (svgRef.current?.clientWidth || 800) / 2 + activeNode.x * zoom) - 120}px`,
                      width: "240px",
                      background: "#fff",
                      padding: "20px",
                      borderRadius: "16px",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
                      border: "1px solid #f1f5f9",
                      zIndex: 30,
                      pointerEvents: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      animation: "tooltipIn 0.2s ease-out"
                    }}>
                    <div style={{ pointerEvents: "none" }}>
                      <h4 style={{ margin: "0", fontSize: "15px", fontWeight: "800", color: "#1e293b" }}>Topic: {activeNode.title}</h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>Lesson Module</p>
                    </div>

                    {activeNode.status !== "locked" && (
                      <button
                        onClick={() => handleNodeClick(activeNode)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "8px",
                          background: "#5A72F6",
                          color: "#fff",
                          border: "none",
                          fontSize: "13px",
                          fontWeight: "700",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onMouseOver={(e) => e.target.style.background = "#4861e5"}
                        onMouseOut={(e) => e.target.style.background = "#5A72F6"}
                      >
                        Start Learning
                      </button>
                    )}

                    {/* Triangle Pointer */}
                    <div style={{
                      position: "absolute",
                      [showBelow ? "top" : "bottom"]: "-10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "0",
                      height: "0",
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      [showBelow ? "borderBottom" : "borderTop"]: "10px solid #fff"
                    }} />
                  </div>
                );
              })()}
            </div>
          ) : (
            /* MODULE VIEW (Chat/Learning Interface) - Triggered by "progress" view */
            <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "#fff" }}>
              {/* Left Side: Vertical Roadmap Navigator with Locking Logic */}
              <div style={{ width: "300px", borderRight: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Course Roadmap</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentPath?.title || "Learning Path"}</div>
                </div>

                <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  {currentPath?.modules?.map((mod, i) => {
                    const isSelected = mod.id === selectedModule?.id;
                    const isLocked = mod.status === "locked";
                    const isCompleted = mod.status === "completed";

                    return (
                      <div key={mod.id} style={{ position: "relative" }}>
                        {/* Connector Line */}
                        {i < (currentPath?.modules?.length || 0) - 1 && (
                          <div style={{
                            position: "absolute",
                            left: "23px",
                            top: "40px",
                            bottom: "-10px",
                            width: "2px",
                            background: isCompleted ? "#10b981" : "#e2e8f0",
                            opacity: isLocked ? 0.3 : 1,
                            zIndex: 0
                          }} />
                        )}

                        <div
                          onClick={() => !isLocked && setSelectedModule(mod)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            padding: "12px",
                            borderRadius: "12px",
                            cursor: isLocked ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                            background: isSelected ? "#fff" : "transparent",
                            boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                            border: isSelected ? "1px solid #e2e8f0" : "1px solid transparent",
                            marginBottom: "2px",
                            position: "relative",
                            zIndex: 1,
                            opacity: isLocked ? 0.5 : 1
                          }}
                        >
                          <div style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "6px",
                            background: isCompleted ? "#10b981" : isSelected ? "#5A72F6" : "#fff",
                            border: isCompleted || isSelected ? "none" : "2px solid #cbd5e1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            color: "#fff",
                            flexShrink: 0
                          }}>
                            {isCompleted ? "✓" : isLocked ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="4" y="10" width="16" height="10" rx="1" />
                                <path d="M8 10V6a4 4 0 0 1 8 0v4" />
                              </svg>
                            ) : isSelected ? "▶" : ""}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: isSelected ? "700" : "600", color: isLocked ? "#94a3b8" : isSelected ? "#1e293b" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {mod.title}
                            </div>
                            <div style={{ fontSize: "10px", fontWeight: "600", color: isSelected ? "#5A72F6" : "#94a3b8", textTransform: "uppercase" }}>
                              {isLocked ? "Locked" : mod.module_type || "Lesson"}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Side-Quest Section */}
                        {mod.confusions && mod.confusions.length > 0 && !isLocked && (
                          <div style={{ paddingLeft: "40px", marginTop: "12px", marginBottom: "16px", position: "relative" }}>
                            {/* Decorative Connecting Line */}
                            <div style={{
                              position: "absolute",
                              left: "20px",
                              top: "-12px",
                              bottom: "50%",
                              width: "2px",
                              background: "#e2e8f0",
                              borderRadius: "0 0 0 4px",
                              borderLeft: "2px solid #e2e8f0",
                              borderBottom: "2px solid #e2e8f0",
                              width: "12px",
                              height: "22px"
                            }} />
                            {/* Toggle Button - Premium Redesign */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedConfusions(prev => {
                                  const next = new Set(prev);
                                  if (next.has(mod.id)) next.delete(mod.id);
                                  else next.add(mod.id);
                                  return next;
                                });
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "8px 16px",
                                borderRadius: "20px",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: "800",
                                color: "#5A72F6",
                                background: expandedConfusions.has(mod.id) ? "rgba(90, 114, 246, 0.1)" : "rgba(241, 245, 249, 0.8)",
                                border: expandedConfusions.has(mod.id) ? "1px solid rgba(90, 114, 246, 0.2)" : "1px solid #e2e8f0",
                                width: "fit-content",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                boxShadow: expandedConfusions.has(mod.id) ? "0 4px 12px rgba(90, 114, 246, 0.1)" : "none"
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "rgba(90, 114, 246, 0.12)";
                                e.currentTarget.style.transform = "translateY(-1px)";
                                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06)";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = expandedConfusions.has(mod.id) ? "rgba(90, 114, 246, 0.1)" : "rgba(241, 245, 249, 0.8)";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = expandedConfusions.has(mod.id) ? "0 4px 12px rgba(90, 114, 246, 0.1)" : "none";
                              }}
                            >
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "18px",
                                height: "18px",
                                borderRadius: "50%",
                                background: expandedConfusions.has(mod.id) ? "#5A72F6" : "rgba(90, 114, 246, 0.1)",
                                color: expandedConfusions.has(mod.id) ? "#fff" : "#5A72F6",
                                transition: "all 0.3s"
                              }}>
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    transform: expandedConfusions.has(mod.id) ? "rotate(90deg)" : "rotate(0deg)",
                                    transition: "transform 0.3s"
                                  }}
                                >
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </div>
                              <span>Deep Dives</span>
                              <span style={{
                                background: expandedConfusions.has(mod.id) ? "rgba(255,255,255,0.2)" : "rgba(90, 114, 246, 0.1)",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                marginLeft: "4px"
                              }}>
                                {mod.confusions.length}
                              </span>
                            </div>

                            {/* Expanded List */}
                            {expandedConfusions.has(mod.id) && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px", animation: "slideDown 0.2s ease-out" }}>
                                {mod.confusions.map((conf) => (
                                  <div
                                    key={conf.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedModule(mod);
                                      setActiveConfusionId(conf.id);
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                      padding: "6px 10px",
                                      borderRadius: "8px",
                                      cursor: "pointer",
                                      transition: "all 0.2s",
                                      background: activeConfusionId === conf.id ? "rgba(90, 114, 246, 0.08)" : "transparent",
                                      border: activeConfusionId === conf.id ? "1px solid rgba(90, 114, 246, 0.2)" : "1px solid transparent",
                                    }}
                                    onMouseOver={(e) => {
                                      if (activeConfusionId !== conf.id) e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                                    }}
                                    onMouseOut={(e) => {
                                      if (activeConfusionId !== conf.id) e.currentTarget.style.background = "transparent";
                                    }}
                                  >
                                    <div style={{
                                      width: "14px",
                                      height: "14px",
                                      borderRadius: "4px",
                                      background: conf.status === "resolved" ? "#10b981" : "#5A72F6",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "8px",
                                      color: "#fff",
                                      flexShrink: 0
                                    }}>
                                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                      </svg>
                                    </div>
                                    <div style={{
                                      fontSize: "11px",
                                      fontWeight: activeConfusionId === conf.id ? "700" : "500",
                                      color: activeConfusionId === conf.id ? "#5A72F6" : "#64748b",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis"
                                    }}>
                                      {conf.title}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress Context Footer */}
                <div style={{ padding: "20px", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Path Mastery</span>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#10b981" }}>{Math.round((currentPath?.modules?.filter(m => m.status === "completed").length / currentPath?.modules?.length) * 100) || 0}%</span>
                  </div>
                  <div style={{ height: "4px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{
                      width: `${(currentPath?.modules?.filter(m => m.status === "completed").length / currentPath?.modules?.length) * 100 || 0}%`,
                      height: "100%",
                      background: "#10b981"
                    }} />
                  </div>
                </div>
              </div>

              {/* Right Side: Primary Learning Chat (Main Focus) */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
                <div style={{ padding: "8px 32px 6px 32px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#5A72F6", fontWeight: "900", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "2px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.8 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    AI TUTOR
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h3 style={{ fontSize: "17px", fontWeight: "900", color: "#1e293b", marginBottom: "0px", lineHeight: "1.2" }}>{selectedModule?.title}</h3>
                        {selectedModule?.status === "completed" && (
                          <div style={{
                            padding: "4px 10px",
                            borderRadius: "20px",
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "#10b981",
                            fontSize: "10px",
                            fontWeight: "800",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Completed
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.5", maxWidth: "800px" }}>
                        {selectedModule?.instructional_goal || "Explore the core concepts and practical applications of this topic with interactive AI guidance."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px 32px", display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
                  <TextSelectionWrapper
                    disabled={loading || activeConfusion}
                    rootModuleId={selectedModule?.id}
                    token={localStorage.getItem("token")}
                    onConfusionStarted={(nodeId) => {
                      checkUnresolvedConfusion(selectedModule.id);
                      setActiveConfusionId(nodeId);
                      // Refresh roadmap silently to show the new node
                      if (currentPath) {
                        loadSpecificPath(currentPath.id, selectedModule.id, true);
                      }
                    }}
                  >
                    {activeConfusionId ? (
                      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <ConfusionChat
                          ref={confusionChatRef}
                          token={localStorage.getItem("token")}
                          nodeId={activeConfusionId}
                          onBack={() => setActiveConfusionId(null)}
                          onResolved={(val) => setIsConfusionResolved(val)}
                        />
                      </div>
                    ) : (
                      <>
                        {chatMessages.map((msg, idx) => {
                          const isSideQuest = msg.role === "side_quest" || (msg.role === "system" && msg.content.includes("/confusion/"));

                          if (isSideQuest) {
                            // Extract title if possible, or use default
                            const displayTitle = msg.content.includes("Side-Quest Summary")
                              ? "Side-Quest Resolved"
                              : "Side-Quest Started";

                            return (
                              <div key={idx} style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
                                <div
                                  onClick={() => {
                                    if (msg.confusion_node_id) setActiveConfusionId(msg.confusion_node_id);
                                    else {
                                      // Fallback: try to extract ID from content if it's a legacy system message
                                      const match = msg.content.match(/\/confusion\/([a-zA-Z0-9-]+)/);
                                      if (match) setActiveConfusionId(match[1]);
                                    }
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "6px 12px",
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "20px",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: "#64748b",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = "#fff";
                                    e.currentTarget.style.borderColor = "#5A72F6";
                                    e.currentTarget.style.color = "#5A72F6";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = "#f8fafc";
                                    e.currentTarget.style.borderColor = "#e2e8f0";
                                    e.currentTarget.style.color = "#64748b";
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                  </svg>
                                  {displayTitle}
                                  <span style={{ fontSize: "10px", opacity: 0.6, fontWeight: "500" }}>• View</span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={idx} data-message-id={msg.id || idx} style={{
                              display: "flex",
                              gap: "12px",
                              flexDirection: msg.role === "user" ? "row-reverse" : "row",
                              marginBottom: "28px" // Increased spacing between message rows
                            }}>
                              <div style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: msg.role === "user" ? "#5A72F6" : "#f1f5f9",
                                color: msg.role === "user" ? "#fff" : "#5A72F6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontSize: "13px",
                                fontWeight: "700"
                              }}>
                                {msg.role === "user" ? (
                                  user?.name?.charAt(0).toUpperCase() || "U"
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="8" width="6" height="7" rx="1.5" />
                                    <rect x="15" y="2" width="6" height="7" rx="1.5" />
                                    <rect x="15" y="15" width="6" height="7" rx="1.5" />
                                    <path d="M9 11.5h3.5v-6h2.5" />
                                    <path d="M12.5 11.5v7h2.5" />
                                  </svg>
                                )}
                              </div>
                              <div style={{ flex: 1, maxWidth: "80%", textAlign: msg.role === "user" ? "right" : "left" }}>
                                <div style={{
                                  background: msg.role === "user" ? "#5A72F6" : "#f1f5f9",
                                  color: msg.role === "user" ? "#fff" : "#334155",
                                  padding: "10px 16px",
                                  borderRadius: msg.role === "user" ? "18px 0 18px 18px" : "0 18px 18px 18px",
                                  fontSize: "14.5px",
                                  lineHeight: "1.6",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                                  display: "inline-block",
                                  maxWidth: "100%",
                                  userSelect: "text",
                                  WebkitUserSelect: "text"
                                }}>
                                  {msg.role === "user" ? (
                                    msg.content
                                  ) : typeof renderMessage(msg.content) === "string" ? (
                                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                                  ) : (
                                    renderMessage(msg.content).map((part, pidx) =>
                                      part.type === "text" ? (
                                        <div key={pidx} style={{ whiteSpace: "pre-wrap", marginBottom: "12px" }}>
                                          {formatInline(part.content)}
                                        </div>
                                      ) : (
                                        <div key={pidx} style={{ margin: "16px 0", borderRadius: "12px", overflow: "hidden", border: "1px solid #334155", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                                          <div style={{ background: "#1e293b", color: "#94a3b8", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #334155" }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A72F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                              <polyline points="16 18 22 12 16 6" />
                                              <polyline points="8 6 2 12 8 18" />
                                            </svg>
                                            <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "#e2e8f0" }}>
                                              {part.language || "Code"}
                                            </span>
                                          </div>
                                          <pre style={{ background: "#0f172a", color: "#f8fafc", padding: "20px", fontSize: "13px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", overflow: "auto", margin: 0, lineHeight: "1.7" }}>
                                            <code style={{ color: part.language === "xml" || part.language === "html" ? "#4ade80" : "#f8fafc" }}>{part.code}</code>
                                          </pre>
                                        </div>
                                      )
                                    )
                                  )}
                                </div>
                                {msg.role === "assistant" && idx === chatMessages.length - 1 && !isStreaming && (
                                  <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                                    <button onClick={() => handleSendMessage("Tell me more")} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "13px", fontWeight: "600", color: "#64748b", cursor: "pointer" }}>Tell me more</button>
                                    <button onClick={() => handleSendMessage("Give me an example")} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "13px", fontWeight: "600", color: "#64748b", cursor: "pointer" }}>Give me an example</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {isStreaming && (
                          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                            <div style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "#f1f5f9",
                              color: "#5A72F6",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0
                            }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="8" width="6" height="7" rx="1.5" />
                                <rect x="15" y="2" width="6" height="7" rx="1.5" />
                                <rect x="15" y="15" width="6" height="7" rx="1.5" />
                                <path d="M9 11.5h3.5v-6h2.5" />
                                <path d="M12.5 11.5v7h2.5" />
                              </svg>
                            </div>
                            <div style={{ flex: 1, maxWidth: "80%", textAlign: "left" }}>
                              <div style={{
                                background: "#f1f5f9",
                                color: "#334155",
                                padding: "10px 16px",
                                borderRadius: "0 18px 18px 18px",
                                fontSize: "14.5px",
                                lineHeight: "1.6",
                                display: "inline-flex",
                                alignItems: "center",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                                minHeight: "40px",
                                gap: "10px",
                                width: "fit-content"
                              }}>
                                <div className="spinner" style={{ width: "16px", height: "16px", margin: 0 }} />
                                <span style={{ color: "#94a3b8", fontSize: "14px" }}>Tutoring...</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </>
                    )}
                  </TextSelectionWrapper>
                </div>

                {/* Chat Input Container (Integrated Style) */}
                <div style={{ padding: "8px 32px 16px 32px", borderTop: "none", background: "#fff" }}>
                  <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
                    {selectedModule?.status === "completed" ? (
                      <div style={{ display: "flex", alignItems: "center", paddingTop: "12px" }}>
                        <div style={{
                          flex: 1,
                          height: "52px",
                          borderRadius: "26px",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#16a34a",
                          fontWeight: "700",
                          fontSize: "15px"
                        }}>
                          Module Completed!
                        </div>
                      </div>
                    ) : (
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        {/* Minimal Debug Toggle - INSIDE Input (Left) */}
                        <button
                          onClick={() => setIsDebugMode(!isDebugMode)}
                          title={isDebugMode ? "God Mode Active" : "Enable Debug Mode"}
                          disabled={isStreaming || (activeConfusionId && isConfusionResolved)}
                          style={{
                            position: "absolute",
                            left: "10px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: "32px",
                            height: "32px",
                            borderRadius: "16px",
                            background: isDebugMode ? "rgba(90, 114, 246, 0.1)" : "transparent",
                            border: "none",
                            color: isDebugMode ? "#5A72F6" : "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            zIndex: 10
                          }}
                        >
                          {isDebugMode ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                          )}
                        </button>

                        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                          <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            disabled={isStreaming || (activeConfusionId && isConfusionResolved)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            placeholder={(activeConfusionId && isConfusionResolved) ? "Side-quest is resolved (Read Only)" : "Ask the tutor anything..."}
                            style={{
                              width: "100%",
                              height: "44px",
                              minHeight: "44px",
                              maxHeight: "200px",
                              padding: "12px 52px 10px 52px",
                              borderRadius: "22px",
                              border: "1px solid #e2e8f0",
                              background: (activeConfusionId && isConfusionResolved) ? "#f1f5f9" : "#f8fafc",
                              fontSize: "14px",
                              color: (activeConfusionId && isConfusionResolved) ? "#94a3b8" : "#1e293b",
                              outline: "none",
                              resize: "none",
                              fontFamily: "inherit",
                              lineHeight: "20px",
                              transition: "all 0.2s",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                              display: "block",
                              cursor: (activeConfusionId && isConfusionResolved) ? "not-allowed" : "text"
                            }}
                          />
                          <button
                            onClick={() => handleSendMessage()}
                            disabled={!chatInput.trim() || isStreaming || (activeConfusionId && isConfusionResolved)}
                            style={{
                              position: "absolute",
                              right: "6px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: "32px",
                              height: "32px",
                              borderRadius: "16px",
                              background: (chatInput.trim() && !isStreaming && !(activeConfusionId && isConfusionResolved)) ? "#5A72F6" : "#e2e8f0",
                              color: "#fff",
                              border: "none",
                              cursor: (activeConfusionId && isConfusionResolved) ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s",
                              zIndex: 5
                            }}
                          >
                            {isStreaming ? (
                              <div className="spinner" style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
