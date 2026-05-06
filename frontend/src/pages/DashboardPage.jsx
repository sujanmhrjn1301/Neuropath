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

export default function DashboardPage({ pathId, onLogout, onNewPath, onGeneratePath, onUpdateKnowledge, user, goToConfusion, isDashboardActive, metadata, onUpdateMetadata }) {
  const [activeConfusionId, setActiveConfusionId] = useState(null);
  const [activeConfusion, setActiveConfusion] = useState(null);
  const [isConfusionResolved, setIsConfusionResolved] = useState(false);
  const [expandedConfusions, setExpandedConfusions] = useState(new Set());
  const [knowledgeProfile, setKnowledgeProfile] = useState(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allPaths, setAllPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [view, setView] = useState(pathId ? "map" : "home"); // "home" | "mypaths" | "map" | "progress" | "assessment"
  const [activeNode, setActiveNode] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hoveredConfusionId, setHoveredConfusionId] = useState(null);
  const hoverTimeoutRef = useRef(null);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || ""
  });
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/notifications", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || ""
      });
    }
  }, [user]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleMetadataChange = (e) => {
    const { name, value } = e.target;
    onUpdateMetadata({ ...metadata, [name]: value });
  };

  const changeAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    onUpdateMetadata({ ...metadata, avatar_seed: newSeed });
  };

  const toggleSetting = (key) => {
    onUpdateMetadata({ ...metadata, [key]: !metadata[key] });
  };

  const handleSynchronize = async () => {
    setIsSynchronizing(true);
    try {
      const token = localStorage.getItem("token");

      // Update metadata (bio, role, avatar)
      const res = await fetch("/api/profile/metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(metadata)
      });

      if (!res.ok) {
        alert("Failed to synchronize profile metadata");
        return;
      }

      alert("Profile synchronized successfully!");
    } catch (err) {
      console.error("Sync error:", err);
      alert("A network error occurred while synchronizing.");
    } finally {
      setIsSynchronizing(false);
    }
  };

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
      const res = await fetch(`/api/confusions/unresolved/${moduleId}`, {
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
      const res = await fetch(`/api/learning-paths/${currentPath.id}/graph`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCurrentPath({ ...data });

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
      const res = await fetch(`/api/modules/${moduleId}/chat`, {
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
      const response = await fetch(`/api/modules/${selectedModule.id}/chat`, {
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
                    fetchUserStats(); // Update the Knowledge Overview stats
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
    if (view === "assessment") {
      fetchUserStats();
      fetchKnowledgeProfile();
    }
  }, [view]);

  useEffect(() => {
    fetchAllPaths();
    fetchRecommendations();
    fetchKnowledgeProfile();
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/stats/overview", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setUserStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
      // Set empty stats instead of null to stop the infinite spinner
      setUserStats({
        mastery_percent: 0,
        total_mastered: 0,
        total_concepts: 0,
        current_streak: 0,
        total_hours: 0,
        pace_comparison: 0,
        recently_completed: [],
        achievements: [],
        daily_quote: { text: "The expert in anything was once a beginner.", author: "Helen Hayes" }
      });
    }
  };

  const fetchKnowledgeProfile = async () => {
    try {
      setIsRefreshingProfile(true);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/chat/knowledge-summary", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setKnowledgeProfile(data.knowledge_summary);
    } catch (err) {
      console.error("Failed to fetch profile", err);
      setKnowledgeProfile("Profile unavailable.");
    } finally {
      setIsRefreshingProfile(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/recommendations/generate", {
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
      const res = await fetch("/api/learning-paths", {
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
      const res = await fetch(`/api/learning-paths/${id}/graph?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load graph");
      const data = await res.json();

      // DEBUG: Log confusion counts
      const target = data.modules?.find(m => m.id === selectedModule?.id);
      if (target) {
        console.log(`DEBUG: Module '${target.title}' now has ${target.confusions?.length || 0} confusions.`);
      }

      // Safety check: Don't set currentPath if modules are missing
      if (!data.modules || data.modules.length === 0) {
        console.warn("Received empty or invalid path graph", data);
        return;
      }

      setCurrentPath({ ...data });

      // Resumption logic: targetModuleId > localStorage > first unlocked > first module
      if (!stayOnCurrentView) {
        const savedModuleId = targetModuleId || localStorage.getItem(`lastModule_${id}`);
        const currentModule = data.modules?.find(m => m.id === savedModuleId) ||
          data.modules?.find(m => m.status === "unlocked") ||
          data.modules?.[0];

        if (currentModule) setSelectedModule(currentModule);
      } else if (selectedModule) {
        // Sync the status and confusions of the currently selected module
        const updatedSelf = data.modules?.find(m => m.id === selectedModule.id);
        if (updatedSelf) {
          const statusChanged = updatedSelf.status !== selectedModule.status;
          const confusionsChanged = (updatedSelf.confusions?.length || 0) !== (selectedModule.confusions?.length || 0);

          if (statusChanged || confusionsChanged) {
            setSelectedModule(updatedSelf);
          }
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
        display: "flex",
        flexDirection: "column",
        padding: "0",
        zIndex: 20,
        overflow: "visible"
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
              background: "none",
              border: "none",
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
              flexShrink: 0
            }}
            onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"}
            onMouseOut={e => e.currentTarget.style.background = "none"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", width: "100%", padding: "0 12px" }}>
          {[
            { id: "home", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>, label: "Home" },
            { id: "mypaths", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>, label: "My Paths" },
            { id: "progress", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>, label: "Progress", onClick: handleProgressClick },
            { id: "assessment", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>, label: "Learning Journey" },
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
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${metadata.avatar_seed}`} alt="avatar" style={{ width: "90%", height: "90%" }} />
                </div>
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
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                border: "1.5px solid var(--white)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                flexShrink: 0
              }}>
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${metadata.avatar_seed}`} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
              {(() => {
                switch (view) {
                  case 'home': return "My Learning Paths";
                  case 'mypaths': return "All Paths";
                  case 'assessment': return "Learning Journey";
                  case 'saved': return "Saved Topics";
                  case 'settings':
                  case 'profile': return "Account Profile";
                  case 'progress': return "Mastery Progress";
                  case 'map': return currentPath?.overall_target ? `Path: ${currentPath.overall_target}` : "Learning Path Map";
                  default: return "Dashboard";
                }
              })()}
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

            {/* NOTIFICATIONS */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  if (!showNotifications) fetchNotifications();
                  setShowNotifications(!showNotifications);
                }}
                style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "#fff", border: "1.5px solid #e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.2s", color: "#64748b",
                  position: "relative"
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "#5A72F6"; e.currentTarget.style.color = "#5A72F6"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.0247 4.75C9.61049 4.75 9.2747 5.08579 9.2747 5.5C9.2747 5.91421 9.61049 6.25 10.0247 6.25V4.75ZM13.3397 6.25C13.7539 6.25 14.0897 5.91421 14.0897 5.5C14.0897 5.08579 13.7539 4.75 13.3397 4.75V6.25ZM10.4822 17.5C10.4822 17.0858 10.1464 16.75 9.7322 16.75C9.31799 16.75 8.9822 17.0858 8.9822 17.5H10.4822ZM14.3822 17.5C14.3822 17.0858 14.0464 16.75 13.6322 16.75C13.218 16.75 12.8822 17.0858 12.8822 17.5H14.3822ZM11.6822 7.326L11.7043 6.57633C11.6898 6.5759 11.6754 6.57589 11.6609 6.5763L11.6822 7.326ZM16.5514 11.758L17.2986 11.6935C17.2973 11.679 17.2957 11.6646 17.2936 11.6502L16.5514 11.758ZM17.1364 14.758L16.4197 14.9791C16.4441 15.0581 16.4813 15.1326 16.53 15.1994L17.1364 14.758ZM17.3635 16.67L18.0154 17.041C18.0311 17.0132 18.0451 16.9845 18.0573 16.955L17.3635 16.67ZM15.979 17.497L15.979 18.2471L15.9885 18.2469L15.979 17.497ZM7.38343 17.497L7.37395 18.247H7.38343V17.497ZM5.99893 16.67L5.30543 16.9556C5.3175 16.9849 5.33142 17.0134 5.3471 17.041L5.99893 16.67ZM6.2222 14.761L6.82983 15.2006C6.87787 15.1343 6.9147 15.0604 6.93886 14.9821L6.2222 14.761ZM6.8072 11.761L6.06492 11.6536C6.06287 11.6679 6.06122 11.6822 6.05998 11.6965L6.8072 11.761ZM10.0247 6.25H13.3397V4.75H10.0247V6.25ZM8.9822 17.5C8.9822 19.0008 10.1732 20.25 11.6822 20.25V18.75C11.0372 18.75 10.4822 18.2084 10.4822 17.5H8.9822ZM11.6822 20.25C13.1912 20.25 14.3822 19.0008 14.3822 17.5H12.8822C12.8822 18.2084 12.3272 18.75 11.6822 18.75V20.25ZM11.6601 8.07567C13.7382 8.13689 15.4977 9.72056 15.8091 11.8658L17.2936 11.6502C16.8814 8.81119 14.5374 6.65979 11.7043 6.57633L11.6601 8.07567ZM15.8041 11.8225C15.8967 12.8944 16.103 13.9529 16.4197 14.9791L17.853 14.5369C17.5679 13.6128 17.3819 12.6593 17.2986 11.6935L15.8041 11.8225ZM16.53 15.1994C16.7768 15.5384 16.8317 15.9908 16.6698 16.385L18.0573 16.955C18.4159 16.0821 18.298 15.0794 17.7427 14.3166L16.53 15.1994ZM16.7117 16.299C16.5524 16.579 16.2682 16.7433 15.9696 16.7471L15.9885 18.2469C16.832 18.2363 17.5989 17.7727 18.0154 17.041L16.7117 16.299ZM15.979 16.747H7.38343V18.247H15.979V16.747ZM7.3929 16.7471C7.09428 16.7433 6.8101 16.579 6.65075 16.299L5.3471 17.041C5.76357 17.7727 6.53044 18.2363 7.37395 18.2469L7.3929 16.7471ZM6.69242 16.3844C6.53048 15.9912 6.58448 15.5397 6.82983 15.2006L5.61458 14.3214C5.06265 15.0842 4.94681 16.0848 5.30543 16.9556L6.69242 16.3844ZM6.93886 14.9821C7.25551 13.9559 7.4619 12.8974 7.55442 11.8255L6.05998 11.6965C5.97661 12.6623 5.79067 13.6158 5.50554 14.5399L6.93886 14.9821ZM7.54948 11.8684C7.86016 9.72025 9.62274 8.1347 11.7035 8.0757L11.6609 6.5763C8.82409 6.65675 6.47609 8.81078 6.06492 11.6536L7.54948 11.8684Z" />
                </svg>
                {notifications.length > 0 && (
                  <span style={{
                    position: "absolute", top: "0", right: "0",
                    width: "12px", height: "12px", borderRadius: "50%",
                    background: "#ef4444", border: "2px solid #fff"
                  }} />
                )}
              </button>

              {showNotifications && (
                <div style={{
                  position: "absolute", top: "100%", right: "0",
                  width: "320px", background: "#fff", borderRadius: "16px",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0",
                  marginTop: "12px", zIndex: 100, overflow: "hidden",
                  animation: "slideDown 0.2s ease-out"
                }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b" }}>Notifications</span>
                    {notifications.length > 0 && <span style={{ fontSize: "11px", fontWeight: "700", color: "#5A72F6", cursor: "pointer" }} onClick={() => setNotifications([])}>Clear all</span>}
                  </div>
                  <div className="hide-scrollbar" style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "80px 20px", textAlign: "center" }}>
                        <div style={{ color: "#cbd5e1", marginBottom: "16px", display: "flex", justifyContent: "center" }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.1322 4.75C9.71799 4.75 9.3822 5.08579 9.3822 5.5C9.3822 5.91421 9.71799 6.25 10.1322 6.25V4.75ZM13.4053 6.25C13.8195 6.25 14.1553 5.91421 14.1553 5.5C14.1553 5.08579 13.8195 4.75 13.4053 4.75V6.25ZM13.6978 16.629C13.2836 16.629 12.9478 16.9648 12.9478 17.379C12.9478 17.7932 13.2836 18.129 13.6978 18.129V16.629ZM16.0222 17.379L16.0222 18.1291L16.032 18.1289L16.0222 17.379ZM17.392 16.56L18.044 16.9308C18.0597 16.9032 18.0736 16.8746 18.0857 16.8452L17.392 16.56ZM17.1678 14.667L16.4516 14.8895C16.4759 14.9679 16.513 15.0417 16.5612 15.1081L17.1678 14.667ZM16.5828 11.695L17.3299 11.6293C17.3281 11.6086 17.3254 11.5881 17.3219 11.5677L16.5828 11.695ZM15.7736 8.37843C15.4955 8.07147 15.0212 8.04808 14.7142 8.3262C14.4073 8.60431 14.3839 9.07861 14.662 9.38557L15.7736 8.37843ZM13.689 18.132C14.1032 18.132 14.439 17.7962 14.439 17.382C14.439 16.9678 14.1032 16.632 13.689 16.632V18.132ZM9.83775 16.632C9.42354 16.632 9.08775 16.9678 9.08775 17.382C9.08775 17.7962 9.42354 18.132 9.83775 18.132V16.632ZM14.4488 17.382C14.4488 16.9678 14.113 16.632 13.6988 16.632C13.2845 16.632 12.9488 16.9678 12.9488 17.382H14.4488ZM10.5877 17.382C10.5877 16.9678 10.252 16.632 9.83775 16.632C9.42354 16.632 9.08775 16.9678 9.08775 17.382L10.5877 17.382ZM9.83775 18.132C10.252 18.132 10.5878 17.7962 10.5878 17.382C10.5878 16.9678 10.252 16.632 9.83775 16.632V18.132ZM7.51335 17.382L7.51168 18.132H7.51335V17.382ZM7.27215 16.5906C6.88091 16.4546 6.45347 16.6615 6.31745 17.0527C6.18142 17.4439 6.38831 17.8714 6.77955 18.0074L7.27215 16.5906ZM19.062 6.02358C19.3512 5.727 19.3452 5.25216 19.0486 4.963C18.752 4.67384 18.2772 4.67985 17.988 4.97642L19.062 6.02358ZM14.6905 8.35842C14.4014 8.655 14.4074 9.12984 14.704 9.419C15.0006 9.70816 15.4754 9.70215 15.7645 9.40558L14.6905 8.35842ZM4.338 18.9764C4.04884 19.273 4.05485 19.7478 4.35142 20.037C4.648 20.3262 5.12284 20.3202 5.412 20.0236L4.338 18.9764ZM7.557 17.8236C7.84616 17.527 7.84015 17.0522 7.54358 16.763C7.247 16.4738 6.77216 16.4798 6.483 16.7764L7.557 17.8236ZM15.7616 9.40858C16.0508 9.112 16.0448 8.63716 15.7482 8.348C15.4516 8.05884 14.9768 8.06485 14.6876 8.36142L15.7616 9.40858ZM6.483 16.7764C6.19384 17.073 6.19985 17.5478 6.49642 17.837C6.793 18.1262 7.26784 18.1202 7.557 17.8236L6.483 16.7764ZM13.2634 8.36888C13.6433 8.53394 14.0851 8.35977 14.2501 7.97987C14.4152 7.59996 14.241 7.15818 13.8611 6.99312L13.2634 8.36888ZM11.7682 7.308L11.7677 6.558C11.7604 6.55801 11.753 6.55812 11.7457 6.55834L11.7682 7.308ZM6.94785 11.7L6.20559 11.5925C6.20358 11.6064 6.20196 11.6203 6.20074 11.6343L6.94785 11.7ZM6.36285 14.672L7.01763 15.0377C7.04304 14.9923 7.06364 14.9442 7.07909 14.8945L6.36285 14.672ZM5.33462 15.1879C5.21525 15.5845 5.44002 16.0028 5.83666 16.1222C6.23329 16.2416 6.65161 16.0168 6.77098 15.6201L5.33462 15.1879ZM10.1322 6.25H13.4053V4.75H10.1322V6.25ZM13.6978 18.129H16.0222V16.629H13.6978V18.129ZM16.032 18.1289C16.8696 18.1179 17.6307 17.6574 18.044 16.9308L16.7401 16.1892C16.5838 16.4641 16.3051 16.6252 16.0123 16.6291L16.032 18.1289ZM18.0857 16.8452C18.4419 15.9788 18.3252 14.9833 17.7744 14.2259L16.5612 15.1081C16.8039 15.4418 16.8579 15.8869 16.6984 16.2748L18.0857 16.8452ZM17.884 14.4445C17.5999 13.5298 17.4141 12.5857 17.3299 11.6293L15.8357 11.7607C15.9292 12.8234 16.1357 13.8725 16.4516 14.8895L17.884 14.4445ZM17.3219 11.5677C17.1167 10.3761 16.5799 9.26839 15.7736 8.37843L14.662 9.38557C15.275 10.0621 15.6862 10.908 15.8437 11.8223L17.3219 11.5677ZM13.689 16.632H9.83775V18.132H13.689V16.632ZM12.9488 17.382C12.9488 17.8306 12.7153 18.2359 12.3514 18.4514L13.1156 19.7421C13.9463 19.2502 14.4488 18.3482 14.4488 17.382H12.9488ZM12.3514 18.4514C11.9897 18.6655 11.5468 18.6655 11.1851 18.4514L10.4209 19.7421C11.2538 20.2353 12.2827 20.2353 13.1156 19.7421L12.3514 18.4514ZM11.1851 18.4514C10.8212 18.2359 10.5877 17.8306 10.5877 17.382L9.08775 17.382C9.08775 18.3482 9.59024 19.2502 10.4209 19.7421L11.1851 18.4514ZM9.83775 16.632H7.51335V18.132H9.83775V16.632ZM7.51502 16.632C7.43272 16.6318 7.35073 16.6179 7.27215 16.5906L6.77955 18.0074C7.01504 18.0893 7.26235 18.1314 7.51168 18.132L7.51502 16.632ZM17.988 4.97642L14.6905 8.35842L15.7645 9.40558L19.062 6.02358L17.988 4.97642ZM5.412 20.0236L7.557 17.8236L6.483 16.7764L4.338 18.9764L5.412 20.0236ZM14.6876 8.36142L6.483 16.7764L7.557 17.8236L15.7616 9.40858L14.6876 8.36142ZM13.8611 6.99312C13.1995 6.70566 12.4875 6.5575 11.7677 6.558L11.7688 8.058C12.2817 8.05764 12.7899 8.16318 13.2634 8.36888L13.8611 6.99312ZM11.7457 6.55834C8.9363 6.6429 6.61328 8.77736 6.20559 11.5925L7.69011 11.8075C7.99732 9.68609 9.73636 8.1195 11.7908 8.05766L11.7457 6.55834ZM6.20074 11.6343C6.11658 12.5907 5.93074 13.5348 5.64661 14.4495L7.07909 14.8945C7.39498 13.8775 7.60147 12.8284 7.69496 11.7657L6.20074 11.6343ZM5.70807 14.3063C5.55215 14.5854 5.42695 14.8811 5.33462 15.1879L6.77098 15.6201C6.83212 15.417 6.91489 15.2217 7.01763 15.0377L5.70807 14.3063Z" />
                          </svg>
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "#64748b", letterSpacing: "-0.01em" }}>You're all caught up!</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>No new recommendations right now.</div>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.type === "recommendation") {
                              onGeneratePath(n.recommendation.title);
                              setShowNotifications(false);
                            }
                          }}
                          style={{
                            padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
                            cursor: n.type === "recommendation" ? "pointer" : "default",
                            transition: "background 0.2s"
                          }}
                          onMouseOver={(e) => n.type === "recommendation" && (e.currentTarget.style.background = "#f8fafc")}
                          onMouseOut={(e) => n.type === "recommendation" && (e.currentTarget.style.background = "#fff")}
                        >
                          <div style={{ display: "flex", gap: "12px" }}>
                            <div style={{
                              width: "36px", height: "36px", borderRadius: "10px",
                              background: n.type === "motivation" ? "rgba(234, 179, 8, 0.1)" : "rgba(90, 114, 246, 0.1)",
                              color: n.type === "motivation" ? "#ca8a04" : "#5A72F6",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                            }}>
                              {n.type === "motivation" ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zM12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" /></svg>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>{n.title}</div>
                              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", lineHeight: "1.5" }}>{n.content}</div>
                              <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "8px", fontWeight: "600" }}>JUST NOW</div>
                            </div>
                          </div>
                          {n.type === "recommendation" && (
                            <div style={{
                              marginTop: "12px", padding: "8px 12px", borderRadius: "8px",
                              background: "#eff6ff", color: "#5A72F6", fontSize: "11px",
                              fontWeight: "700", textAlign: "center"
                            }}>
                              Start Learning: {n.recommendation?.title} →
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* BREADCRUMBS */}
        {(view === "map" || view === "mypaths" || view === "progress") && (
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
          ) : (view === "profile" || view === "settings") ? (
            /* NEW PREMIUM PROFILE VIEW */
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "60px 40px", background: "#f8fafc" }}>
              <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

                {/* PROFILE SECTION */}
                <div style={{ marginBottom: "80px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "40px" }}>
                      <div style={{ position: "relative" }}>
                        <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${metadata.avatar_seed}`} alt="avatar" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                        </div>
                        <div
                          onClick={changeAvatar}
                          style={{ position: "absolute", bottom: "4px", right: "4px", width: "28px", height: "28px", background: "#5A72F6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(90, 114, 246, 0.4)", border: "2px solid #fff", transition: "transform 0.2s" }}
                          onMouseOver={e => e.currentTarget.style.transform = "scale(1.1)"}
                          onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                          title="Shuffle Avatar"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#1e293b", fontFamily: "inherit" }}>{user?.name || "Alexander Sterling"}</div>
                        <div style={{ marginTop: "4px" }}>
                          <input
                            type="text"
                            name="role"
                            value={metadata.role}
                            onChange={handleMetadataChange}
                            style={{ fontSize: "14px", color: "#64748b", fontWeight: "500", border: "none", background: "none", outline: "none", padding: 0, width: "100%" }}
                          />
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", marginTop: "8px", letterSpacing: "0.08em" }}>Member since Oct 2023</div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "32px" }}>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "8px" }}>Full Name</label>
                        <input
                          type="text"
                          name="name"
                          value={profileData.name}
                          onChange={handleProfileChange}
                          style={{ width: "100%", padding: "14px 18px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "14px", outline: "none", background: "#fff", color: "#1e293b", fontFamily: "inherit" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "8px" }}>Email Address</label>
                        <input
                          type="text"
                          name="email"
                          value={profileData.email}
                          onChange={handleProfileChange}
                          style={{ width: "100%", padding: "14px 18px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "14px", outline: "none", background: "#fff", color: "#1e293b", fontFamily: "inherit" }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: "24px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "12px" }}>Bio</label>
                      <textarea
                        name="bio"
                        value={metadata.bio}
                        onChange={handleMetadataChange}
                        style={{ width: "100%", padding: "18px 22px", borderRadius: "16px", border: "1px solid #e2e8f0", fontSize: "15px", color: "#1e293b", background: "#fff", outline: "none", minHeight: "140px", resize: "none", fontFamily: "inherit", lineHeight: "1.7" }}
                      />
                    </div>
                  </div>
                </div>

                {/* ACCOUNT SECTION */}
                <div style={{ marginBottom: "60px" }}>
                  <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "24px", marginBottom: "32px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", marginBottom: "8px" }}>Account Settings</h2>
                    <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
                      Configure your notification preferences, security protocols, and privacy boundaries.
                    </p>
                  </div>
                  <div>
                    <div style={{ background: "#f8fafc", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "700" }}>Security Access</div>
                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Update your authentication credentials</div>
                      </div>
                      <button
                        style={{ padding: "12px 24px", border: "1.5px solid #5A72F6", background: "none", color: "#5A72F6", borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "8px" }}
                        onMouseOver={e => { e.currentTarget.style.background = "rgba(90, 114, 246, 0.05)"; }}
                        onMouseOut={e => { e.currentTarget.style.background = "none"; }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        Change Password
                      </button>
                    </div>

                    <div style={{ marginBottom: "40px" }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "24px" }}>Notifications</div>
                      {[
                        { title: "Course Progress Updates", desc: "Receive alerts when milestones are reached in your active paths.", key: "course_updates" },
                        { title: "Community Mentions", desc: "Be notified when colleagues tag you in collaborative libraries.", key: "community_mentions" },
                        { title: "Marketing & Research", desc: "Periodic updates on new features and platform improvements.", key: "marketing_research" }
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "700" }}>{item.title}</div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{item.desc}</div>
                          </div>
                          <div
                            onClick={() => toggleSetting(item.key)}
                            style={{ width: "40px", height: "20px", background: metadata[item.key] ? "#5A72F6" : "#cbd5e1", borderRadius: "10px", position: "relative", cursor: "pointer", transition: "all 0.3s" }}
                          >
                            <div style={{ width: "12px", height: "12px", background: "#fff", borderRadius: "50%", position: "absolute", top: "4px", [metadata[item.key] ? "right" : "left"]: "4px", transition: "all 0.3s" }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "24px" }}>Privacy</div>
                      {[
                        { title: "Public Progress Profile", desc: "Allow others in the community to view your learning statistics.", type: "toggle_label", key: "public_profile" },
                        { title: "Data Anonymization", desc: "Contribute your learning patterns to global research anonymously.", type: "toggle", key: "data_anonymization" }
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "700" }}>{item.title}</div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{item.desc}</div>
                          </div>
                          {item.type === "toggle_label" ? (
                            <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                              <div
                                onClick={() => onUpdateMetadata({ ...metadata, public_profile: true })}
                                style={{ padding: "10px 20px", fontSize: "13px", fontWeight: "600", background: metadata.public_profile ? "#5A72F6" : "transparent", color: metadata.public_profile ? "#fff" : "#94a3b8", minWidth: "100px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
                              >
                                Visible
                              </div>
                              <div
                                onClick={() => onUpdateMetadata({ ...metadata, public_profile: false })}
                                style={{ padding: "10px 20px", fontSize: "13px", fontWeight: "600", background: !metadata.public_profile ? "#5A72F6" : "transparent", color: !metadata.public_profile ? "#fff" : "#94a3b8", minWidth: "100px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
                              >
                                Private
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => toggleSetting(item.key)}
                              style={{ width: "40px", height: "20px", background: metadata[item.key] ? "#5A72F6" : "#cbd5e1", borderRadius: "10px", position: "relative", cursor: "pointer", transition: "all 0.3s" }}
                            >
                              <div style={{ width: "12px", height: "12px", background: "#fff", borderRadius: "50%", position: "absolute", top: "4px", [metadata[item.key] ? "right" : "left"]: "4px", transition: "all 0.3s" }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "40px", display: "flex", justifyContent: "flex-end", gap: "24px", marginBottom: "40px", alignItems: "center" }}>
                  <button
                    onClick={() => {
                      setProfileData({
                        name: user?.name || "",
                        email: user?.email || ""
                      });
                    }}
                    style={{ background: "none", border: "none", fontSize: "14px", fontWeight: "600", color: "#94a3b8", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseOver={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseOut={e => e.currentTarget.style.color = "#94a3b8"}
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={handleSynchronize}
                    disabled={isSynchronizing}
                    style={{
                      background: "#fff",
                      color: "#5A72F6",
                      border: "1.5px solid #5A72F6",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: isSynchronizing ? "not-allowed" : "pointer",
                      letterSpacing: "0.02em",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      opacity: isSynchronizing ? 0.6 : 1
                    }}
                    onMouseOver={e => { if (!isSynchronizing) e.currentTarget.style.background = "#eff6ff"; }}
                    onMouseOut={e => { if (!isSynchronizing) e.currentTarget.style.background = "#fff"; }}
                  >
                    <svg
                      className={isSynchronizing ? "spin" : ""}
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animation: isSynchronizing ? "spin 2s linear infinite" : "none" }}
                    >
                      <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    {isSynchronizing ? "Synchronizing..." : "Synchronize Profile"}
                  </button>
                </div>

              </div>
            </div>
          ) : view === "assessment" ? (
            /* NEW PREMIUM KNOWLEDGE PROFILE VIEW */
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "40px" }}>
              <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

                {/* TOP HEADER */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                  <div>
                    <h1 style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b", margin: 0 }}>Your Learning Journey</h1>
                    <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "16px" }}>
                      {userStats ? (
                        userStats.total_concepts - userStats.total_mastered > 0 ? (
                          <>You're making incredible progress! Only <strong style={{ color: "#5A72F6" }}>{userStats.total_concepts - userStats.total_mastered} units</strong> left to reach Master status.</>
                        ) : userStats.total_concepts > 0 ? (
                          <>Congratulations! You have mastered all concepts in your current curriculum.</>
                        ) : (
                          <>Start your first path to begin your learning journey!</>
                        )
                      ) : "Loading your progress..."}
                    </p>
                  </div>
                  <button
                    onClick={() => setView("profile")}
                    style={{
                      background: "#5A72F6",
                      color: "#fff",
                      border: "1.5px solid transparent",
                      borderRadius: "12px",
                      padding: "12px 28px",
                      fontSize: "15px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      boxShadow: "0 4px 14px rgba(90, 114, 246, 0.2)",
                      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxSizing: "border-box"
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = "#fff";
                      e.currentTarget.style.color = "#5A72F6";
                      e.currentTarget.style.borderColor = "#5A72F6";
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = "#5A72F6";
                      e.currentTarget.style.color = "#fff";
                      e.currentTarget.style.borderColor = "transparent";
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                    Continue Learning
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "32px" }}>

                  {/* MAIN COLUMN */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

                    {/* KNOWLEDGE OVERVIEW CARD */}
                    {(() => {
                      if (!userStats) {
                        return (
                          <div style={{ background: "#fff", borderRadius: "24px", padding: "40px", boxShadow: "0 2px 40px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "260px" }}>
                            <div className="spinner" />
                          </div>
                        );
                      }

                      const masteryPercent = userStats.mastery_percent || 0;
                      const totalMastered = userStats.total_mastered || 0;
                      const totalPossible = userStats.total_concepts || 0;
                      const currentStreak = userStats.current_streak || 0;
                      const totalHours = userStats.total_hours || 0;
                      const paceDiff = userStats.pace_comparison || 0;

                      return (
                        <div style={{ background: "#fff", borderRadius: "24px", padding: "40px", boxShadow: "0 2px 40px rgba(0,0,0,0.03)", display: "grid", gridTemplateColumns: "200px 1fr", gap: "40px", alignItems: "center" }}>
                          <div style={{ position: "relative", width: "180px", height: "180px" }}>
                            <svg width="180" height="180" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                              <circle cx="50" cy="50" r="40" fill="none" stroke="#0052cc" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - (masteryPercent / 100))} strokeLinecap="round" transform="rotate(-90 50 50)" />
                            </svg>
                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>{masteryPercent}%</span>
                              <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mastery</span>
                            </div>
                          </div>
                          <div>
                            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", marginBottom: "16px" }}>Knowledge Overview</h2>
                            <p style={{ color: "#64748b", fontSize: "15px", lineHeight: "1.6", marginBottom: "24px" }}>
                              {totalPossible > 0 ? (
                                <>
                                  You have successfully mastered <strong style={{ color: "#1e293b" }}>{totalMastered} out of {totalPossible}</strong> core concepts in your current curriculum.
                                  {paceDiff > 0 && (
                                    <> Your pace is <strong style={{ color: "#10b981" }}>{paceDiff}% faster</strong> than average learners this month.</>
                                  )}
                                  {paceDiff < 0 && (
                                    <> Your pace is <strong style={{ color: "#ef4444" }}>{Math.abs(paceDiff)}% slower</strong> than average learners. Keep it up!</>
                                  )}
                                  {paceDiff === 0 && (
                                    <> Your pace is <strong style={{ color: "#5A72F6" }}>exactly on track</strong> with average learners.</>
                                  )}
                                </>
                              ) : (
                                "Start a learning path to see your knowledge overview and track your mastery across core concepts."
                              )}
                            </p>
                            <div style={{ display: "flex", gap: "32px", marginTop: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ color: "#f59e0b" }}>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Streak</span>
                                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b" }}>{currentStreak} Days</span>
                                </div>
                              </div>
                              <div style={{ width: "1px", height: "30px", background: "#e2e8f0", alignSelf: "center" }} />
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ color: "#5A72F6" }}>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Time</span>
                                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b" }}>{totalHours}h</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ACHIEVEMENTS */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "10px" }}>
                          Achievements & Milestones
                        </h3>
                        <button
                          style={{ background: "none", border: "none", color: "#5A72F6", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "color 0.2s" }}
                          onMouseOver={e => e.currentTarget.style.color = "#4c60d8"}
                          onMouseOut={e => e.currentTarget.style.color = "#5A72F6"}
                        >
                          View All
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                        {(userStats?.achievements || []).length > 0 ? (
                          userStats.achievements.map((ach, i) => (
                            <div key={i} style={{ background: "#fff", padding: "20px", borderRadius: "20px", border: "1px solid #f1f5f9", transition: "all 0.2s" }}>
                              <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#f8fafc", color: ach.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                                {ach.type === "path" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>}
                                {ach.type === "module" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v11.5L13 22l-7-3h-2" /><path d="M9 18h6" /></svg>}
                                {ach.type === "streak" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>}
                                {ach.type === "mastery" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                              </div>
                              <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>{ach.title}</h4>
                              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8", lineHeight: "1.4" }}>{ach.sub}</p>
                            </div>
                          ))
                        ) : (
                          [1, 2, 3].map((_, i) => (
                            <div key={i} style={{ background: "#fff", padding: "20px", borderRadius: "20px", border: "1px solid #f1f5f9", opacity: 0.5 }}>
                              <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#f8fafc", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                              </div>
                              <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "700", color: "#94a3b8" }}>Locked</h4>
                              <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1" }}>Keep learning to unlock</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>


                    {/* DETAILED KNOWLEDGE BREAKDOWN (Integrated real data) */}
                    <div>
                      <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", marginBottom: "20px" }}>AI Knowledge Breakdown</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                        <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", border: "1px solid #e2e8f0" }}>
                          <div style={{ color: "#10b981", fontWeight: "800", fontSize: "12px", textTransform: "uppercase", marginBottom: "12px" }}>Core Strengths</div>
                          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: "1.6" }}>{knowledgeProfile?.strengths || "Assessment pending..."}</p>
                        </div>
                        <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", border: "1px solid #e2e8f0" }}>
                          <div style={{ color: "#f59e0b", fontWeight: "800", fontSize: "12px", textTransform: "uppercase", marginBottom: "12px" }}>Growth Areas</div>
                          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: "1.6" }}>{knowledgeProfile?.weaknesses || "Assessment pending..."}</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* SIDEBAR COLUMN */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

                    {/* RECENTLY COMPLETED */}
                    <div style={{ background: "#fff", borderRadius: "24px", padding: "32px", border: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b", margin: 0 }}>Recently Completed</h3>
                        <div style={{ color: "#94a3b8" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        {(userStats?.recently_completed || []).length > 0 ? (
                          userStats.recently_completed.map((item, i) => (
                            <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                              <div style={{ color: "#10b981", marginTop: "2px" }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              </div>
                              <div>
                                <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", lineHeight: "1.2" }}>{item.title}</div>
                                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{item.date} • {item.score} Score</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", margin: "20px 0" }}>No modules completed yet.</p>
                        )}
                      </div>
                      <button
                        style={{ width: "100%", marginTop: "32px", padding: "12px", background: "none", border: "1px solid #f1f5f9", borderRadius: "12px", fontSize: "13px", fontWeight: "700", color: "#64748b", cursor: "pointer", transition: "all 0.2s" }}
                        onMouseOver={e => { e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseOut={e => { e.currentTarget.style.background = "none"; }}
                      >
                        View Learning History
                      </button>
                    </div>

                    {/* QUOTE CARD */}
                    <div style={{ background: "linear-gradient(135deg, #0052cc 0%, #003d99 100%)", borderRadius: "24px", padding: "32px", color: "#fff", position: "relative" }}>
                      <div style={{ fontSize: "40px", opacity: 0.3, position: "absolute", top: "20px", left: "20px", fontFamily: "serif" }}>“</div>
                      <p style={{ fontSize: "18px", fontWeight: "600", lineHeight: "1.6", margin: "20px 0 24px", position: "relative", zIndex: 1 }}>
                        "{userStats?.daily_quote?.text || "The more that you read, the more things you will know. The more that you learn, the more places you'll go."}"
                      </p>
                      <div style={{ fontSize: "14px", fontWeight: "700", opacity: 0.8 }}>— {userStats?.daily_quote?.author || "Dr. Seuss"}</div>
                    </div>


                  </div>
                </div>

                <div style={{ height: "40px" }} />
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
                    onConfusionStarted={(node) => {
                      console.log("DEBUG: Side-quest started, injecting into local state...");

                      // 1. Manually update currentPath modules to show pill instantly
                      if (currentPath) {
                        const updatedModules = currentPath.modules.map(m => {
                          if (m.id === selectedModule.id) {
                            const newConfusion = {
                              id: node.id,
                              title: node.title || "Side-Quest",
                              status: "active",
                              message_count: 0
                            };
                            return {
                              ...m,
                              confusions: [...(m.confusions || []), newConfusion]
                            };
                          }
                          return m;
                        });

                        setCurrentPath({
                          ...currentPath,
                          modules: updatedModules
                        });

                        // 2. ALSO inject the placeholder into the main chat history
                        const questPlaceholder = {
                          id: Date.now(),
                          role: "side_quest",
                          content: `Side-quest was created [/confusion/${node.id}]`,
                          created_at: new Date().toISOString()
                        };
                        setChatMessages(prev => [...prev, questPlaceholder]);
                      }

                      checkUnresolvedConfusion(selectedModule.id);
                      setActiveConfusionId(node.id);

                      // 2. Auto-expand the deep dives section for this module
                      setExpandedConfusions(prev => {
                        const next = new Set(prev);
                        next.add(selectedModule.id);
                        return next;
                      });

                      // 3. Still trigger a background refresh to be 100% sure
                      setTimeout(() => {
                        if (currentPath) {
                          loadSpecificPath(currentPath.id, selectedModule.id, true);
                        }
                      }, 1000);
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
                                background: msg.role === "user" ? "#f8fafc" : "#f1f5f9",
                                color: msg.role === "user" ? "#fff" : "#5A72F6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontSize: "13px",
                                fontWeight: "700",
                                overflow: "hidden",
                                border: msg.role === "user" ? "1px solid #e2e8f0" : "none"
                              }}>
                                {msg.role === "user" ? (
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${metadata.avatar_seed}`} alt="avatar" style={{ width: "95%", height: "95%", objectFit: "contain" }} />
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
