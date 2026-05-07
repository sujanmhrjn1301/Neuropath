import { useState, useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import MainPage from "./pages/MainPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import SetupChatPage from "./pages/SetupChatPage";
import ChatsPage from "./pages/ChatsPage";
import DashboardPage from "./pages/DashboardPage";
import PricingPage from "./pages/PricingPage";
import AboutPage from "./pages/AboutPage";
import FeaturesPage from "./pages/FeaturesPage";
import HowItWorksPage from "./pages/HowItWorksPage";

/* ─────────────────────────── ROOT APP ─────────────────────────── */
export default function App() {
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem("np_page") || "landing";
    const token = localStorage.getItem("token");
    const protectedPages = ["main", "chats", "setup-chat", "dashboard"];
    if (protectedPages.includes(saved) && !token) return "landing";
    return saved;
  });
  const [prefillGoal, setPrefillGoal] = useState(() => localStorage.getItem("np_prefillGoal") || "");
  const [setupChatData, setSetupChatData] = useState(() => {
    const saved = localStorage.getItem("np_setupChatData");
    return saved ? JSON.parse(saved) : null;
  });
  const [chatsData, setChatsData] = useState(() => {
    const saved = localStorage.getItem("np_chatsData");
    return saved ? JSON.parse(saved) : null;
  });
  const [activePathId, setActivePathId] = useState(() => localStorage.getItem("np_activePathId"));
  const [user, setUser] = useState(null);
  const [metadata, setMetadata] = useState({
    role: "Senior Cognitive Engineer",
    bio: "",
    avatar_seed: "default",
    course_updates: true,
    community_mentions: false,
    marketing_research: true,
    public_profile: true,
    data_anonymization: true
  });

  // Sync state to localStorage
  useEffect(() => { localStorage.setItem("np_page", page); }, [page]);
  useEffect(() => { localStorage.setItem("np_prefillGoal", prefillGoal); }, [prefillGoal]);
  useEffect(() => { 
    if (setupChatData) localStorage.setItem("np_setupChatData", JSON.stringify(setupChatData));
    else localStorage.removeItem("np_setupChatData");
  }, [setupChatData]);
  useEffect(() => { 
    if (chatsData) localStorage.setItem("np_chatsData", JSON.stringify(chatsData));
    else localStorage.removeItem("np_chatsData");
  }, [chatsData]);
  useEffect(() => { 
    if (activePathId) localStorage.setItem("np_activePathId", activePathId);
    else localStorage.removeItem("np_activePathId");
  }, [activePathId]);

  useEffect(() => {
    // Initial check for token
    const token = localStorage.getItem("token");
    if (token) fetchUser(token);
  }, []);

  async function fetchUser(token) {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        fetchMetadata(token); // Fetch metadata immediately after user info
      }
    } catch (err) {
      console.error("Failed to fetch user", err);
    }
  }

  async function fetchMetadata(token) {
    try {
      const res = await fetch("/api/profile/metadata", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (err) {
      console.error("Failed to fetch metadata", err);
    }
  }

  const goToMain = (goal = "") => {
    setPrefillGoal(goal);
    setPage("main");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToLanding = () => {
    setPage("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToLogin = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("np_page");
    localStorage.removeItem("np_activePathId");
    setUser(null);
    setPage("login");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToSignup = () => {
    setPage("signup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToSetupChat = (goal, difficulty, commitment) => {
    setSetupChatData({ goal, difficulty, commitment });
    setPage("setup-chat");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToChats = (goal = "", difficulty = "Beginner", commitment = "30 - 60 mins (Steady)") => {
    setChatsData({ goal, difficulty, commitment });
    setPage("chats");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToPricing = () => {
    setPage("pricing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToAbout = () => {
    setPage("about");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToFeatures = () => {
    setPage("features");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToHowItWorks = () => {
    setPage("how");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLoginSuccess = () => {
    const token = localStorage.getItem("token");
    if (token) fetchUser(token);
    setPage("main");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToDashboard = (pathId = null) => {
    if (pathId) setActivePathId(pathId);
    setPage("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {page === "landing" && (
        <LandingPage
          onGetStarted={goToMain}
          onLogin={goToLogin}
          onPricing={goToPricing}
          onFeatures={goToFeatures}
          onHowItWorks={goToHowItWorks}
          onAbout={goToAbout}
          user={user}
          metadata={metadata}
        />
      )}
      {page === "main" && (
        <MainPage
          initialGoal={prefillGoal}
          onBack={goToLanding}
          onGenerate={(goal, diff, comm) => goToChats(goal, diff, comm)}
          onGoToDashboard={() => goToDashboard()}
          user={user}
          metadata={metadata}
          onLogout={goToLogin}
        />
      )}
      {page === "chats" && (
        <ChatsPage
          initialGoal={chatsData?.goal || ""}
          initialDifficulty={chatsData?.difficulty}
          initialCommitment={chatsData?.commitment}
          onFinish={goToDashboard}
          onLogout={goToLogin}
          user={user}
          metadata={metadata}
        />
      )}
      {page === "login" && (
        <LoginPage onBack={goToLanding} onLoginSuccess={handleLoginSuccess} onSignUp={goToSignup} />
      )}
      {page === "signup" && (
        <SignupPage onBack={goToLanding} onSignupSuccess={goToLogin} onLogin={goToLogin} />
      )}
      {page === "setup-chat" && setupChatData && (
        <SetupChatPage
          goal={setupChatData.goal}
          difficulty={setupChatData.difficulty}
          commitment={setupChatData.commitment}
          onBack={() => goToMain()}
          onFinish={goToDashboard}
        />
      )}
      {page === "dashboard" && (
        <DashboardPage
          pathId={activePathId}
          onLogout={goToLogin}
          onNewPath={() => goToMain()}
          onGeneratePath={(title) => goToChats(title, "Intermediate", "30 - 60 mins (Steady)")}
          onUpdateKnowledge={() => goToChats()}
          user={user}
          metadata={metadata}
          onUpdateMetadata={(newMetadata) => setMetadata(newMetadata)}
        />
      )}
      {page === "pricing" && (
        <PricingPage
          onBack={goToLanding}
          onSelectPlan={() => goToMain()}
          onGoToHowItWorks={goToHowItWorks}
          onGoToFeatures={goToFeatures}
          onGoToAbout={goToAbout}
        />
      )}
      {page === "about" && (
        <AboutPage
          onBackToLanding={goToLanding}
          onGoToHowItWorks={goToHowItWorks}
          onGoToFeatures={goToFeatures}
          onGoToPricing={goToPricing}
          onTryNeuroPath={goToMain}
        />
      )}
      {page === "features" && (
        <FeaturesPage
          onBackToLanding={goToLanding}
          onGoToHowItWorks={goToHowItWorks}
          onGoToPricing={goToPricing}
          onGoToAbout={goToAbout}
          onTryNeuroPath={goToMain}
        />
      )}
      {page === "how" && (
        <HowItWorksPage
          onBackToLanding={goToLanding}
          onGoToFeatures={goToFeatures}
          onGoToPricing={goToPricing}
          onGoToAbout={goToAbout}
          onTryNeuroPath={goToMain}
        />
      )}
    </>
  );
}
