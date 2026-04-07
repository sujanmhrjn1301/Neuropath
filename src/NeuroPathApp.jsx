import { useState } from "react";
import LandingPage from "./pages/LandingPage";
import MainPage from "./pages/MainPage";
import LoginPage from "./pages/LoginPage";
import PricingPage from "./pages/PricingPage";
import AboutPage from "./pages/AboutPage";
import FeaturesPage from "./pages/FeaturesPage";
import HowItWorksPage from "./pages/HowItWorksPage";

/* ─────────────────────────── ROOT APP ─────────────────────────── */
export default function App() {
  const [page, setPage] = useState("landing");   // "landing" | "main" | "login" | "pricing" | "about" | "features" | "how"
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

  const goToLogin = () => {
    setPage("login");
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
    setPage("main");
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
        <MainPage initialGoal={prefillGoal} onBack={goToLanding} />
      )}
      {page === "login" && (
        <LoginPage onBack={goToLanding} onLoginSuccess={handleLoginSuccess} />
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
