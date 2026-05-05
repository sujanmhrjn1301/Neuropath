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
  const [page, setPage] = useState("landing");   // "landing" | "main" | "login" | "signup" | "setup-chat" | "chats" | "dashboard" | "pricing" | "about" | "features" | "how"
  const [prefillGoal, setPrefillGoal] = useState("");
  const [setupChatData, setSetupChatData] = useState(null);
  const [chatsData, setChatsData] = useState(null);
  const [activePathId, setActivePathId] = useState(null);
  const [user, setUser] = useState(null);

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
      }
    } catch (err) {
      console.error("Failed to fetch user", err);
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
        />
      )}
      {page === "main" && (
        <MainPage
          initialGoal={prefillGoal}
          onBack={goToLanding}
          onGenerate={(goal, diff, comm) => goToChats(goal, diff, comm)}
          onGoToDashboard={() => goToDashboard()}
          user={user}
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
