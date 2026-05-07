import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import AuthContainer from './components/AuthContainer';
import ChatAssessment from './components/ChatAssessment';
import LearnChat from './components/LearnChat';
import PathDetails from './components/PathDetails';
import ModuleChat from './components/ModuleChat';
import ConfusionChat from './components/ConfusionChat';
import SuggestionSimulator from './components/SuggestionSimulator';
import SkillTreePage from './pages/SkillTreePage';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import PricingPage from './pages/PricingPage';
import './App.css';

function DashboardHeader({ handleLogout }) {
  return (
    <div className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span className="brand-title-small">NeuroPath</span>
        </Link>
      </div>
      <div className="dashboard-topbar-right">
        <Link to="/assessment" className="update-knowledge-btn">
          Update Knowledge Summary
        </Link>
        <button onClick={handleLogout} className="logout-btn-small">
          Logout
        </button>
      </div>
    </div>
  );
}

function Dashboard({ handleLogout, token }) {
  const navigate = useNavigate();
  const [knowledgeProfile, setKnowledgeProfile] = React.useState(undefined);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [learningPaths, setLearningPaths] = React.useState([]);

  React.useEffect(() => {
    fetch('/api/chat/knowledge-summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setKnowledgeProfile(data.knowledge_summary))
      .catch(() => setKnowledgeProfile(null));

    fetch('/api/learning-paths', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setLearningPaths(Array.isArray(data) ? data : []))
      .catch(() => setLearningPaths([]));
  }, [token]);

  return (
    <div className="dashboard-full">
      <DashboardHeader handleLogout={handleLogout} />
      <div className="workspace-layout">

        {/* Left Sidebar / Profile Section */}
        <aside className="workspace-sidebar">
          <div className="knowledge-profile-section">
            <h3 className="sidebar-title">Your Knowledge Profile</h3>

            {knowledgeProfile === undefined && (
              <p className="profile-loading">Loading your profile...</p>
            )}

            {knowledgeProfile === null && (
              <p className="coming-soon">
                Your knowledge profile is empty. Complete your assessment to populate it.
              </p>
            )}

            {knowledgeProfile && knowledgeProfile.strengths && (
              <div className="knowledge-strengths">
                <div className={`strengths-content ${!isExpanded ? 'line-clamp-3' : ''}`}>
                  {knowledgeProfile.strengths}
                </div>
                <button
                  className="expand-btn"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Center Action Area */}
        <main className="workspace-main">
          <div className="action-grid">
            {/* Create new path card */}
            <Link to="/learn" style={{ textDecoration: 'none' }}>
              <div className="action-card primary-action-card">
                <div className="card-icon-wrapper">
                  <span className="plus-icon">+</span>
                </div>
                <span className="card-text">Learn something new</span>
              </div>
            </Link>

            {/* Existing learning path cards */}
            {learningPaths.map(path => (
              <div key={path.id} className="action-card path-card" style={{ display: 'flex', flexDirection: 'column', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate(`/path/${path.id}`)}>
                  <div className="path-card-icon">📚</div>
                  <span className="card-text path-card-title">{path.user_request || 'Learning Path'}</span>
                  <span className="path-card-subtitle line-clamp-2">{path.overall_target}</span>
                </div>
                <div className="path-card-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button
                    className="continue-btn"
                    onClick={() => navigate(`/path/${path.id}`)}
                    style={{ background: '#89b4fa', color: '#1e1e2e', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Continue
                  </button>

                  <button
                    onClick={() => navigate(`/path/${path.id}/graph`)}
                    style={{
                      background: 'transparent',
                      color: '#cba6f7',
                      border: '1px solid #cba6f7',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(203, 166, 247, 0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    🗺️ Skill Tree
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      <SuggestionSimulator token={token} />
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <Router>
      <Routes>
        {/* ── Public / Marketing Pages ── */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* ── Authenticated App Routes ── */}
        <Route path="/" element={
          !token ? (
            <div className="app-layout">
              <header className="app-header">
                <h1 className="brand-title">NeuroPath</h1>
              </header>
              <main className="main-content">
                <AuthContainer onLoginSuccess={setToken} />
              </main>
            </div>
          ) : (
            <Dashboard handleLogout={handleLogout} token={token} />
          )
        } />
        <Route path="/assessment" element={
          !token ? <Navigate to="/" /> : <ChatAssessment token={token} />
        } />
        <Route path="/learn" element={
          !token ? <Navigate to="/" /> : <LearnChat token={token} />
        } />
        <Route path="/path/:id" element={
          !token ? <Navigate to="/" /> : <PathDetails token={token} />
        } />
        <Route path="/path/:pathId/graph" element={
          !token ? <Navigate to="/" /> : <SkillTreePage token={token} />
        } />
        <Route path="/module/:moduleId/chat" element={
          !token ? <Navigate to="/" /> : <ModuleChat token={token} />
        } />
        <Route path="/confusion/:nodeId" element={
          !token ? <Navigate to="/" /> : <ConfusionChat token={token} />
        } />
      </Routes>
    </Router>
  );
}

export default App;
