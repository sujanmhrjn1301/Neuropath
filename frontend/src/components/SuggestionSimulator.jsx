import React, { useState } from 'react';

export default function SuggestionSimulator({ token }) {
    const [isOpen, setIsOpen] = useState(false);
    const [useDeepseek, setUseDeepseek] = useState(true); // true = DeepSeek, false = OpenRouter/Perplexity
    const [isLoading, setIsLoading] = useState(false);
    const [recommendations, setRecommendations] = useState(null);
    const [error, setError] = useState(null);

    const handleSimulate = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/recommendations/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                // Autonomous: We ONLY send the engine toggle. The backend fetches the history!
                body: JSON.stringify({ use_deepseek: useDeepseek })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to fetch recommendations");
            }

            const data = await response.json();
            setRecommendations(data.recommendations);
        } catch (err) {
            console.error("Simulation error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="suggestion-simulator-wrapper" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9000 }}>
            {/* The Floating Trigger Button */}
            <button 
                onClick={() => setIsOpen(true)}
                style={{ background: '#cba6f7', color: '#1e1e2e', padding: '12px 24px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', fontSize: '1rem' }}
            >
                💡 AI Career Advisor
            </button>

            {/* The Modal Overlay */}
            {isOpen && (
                <div className="suggestion-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="suggestion-modal" style={{ background: '#1e1e2e', border: '1px solid #444', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', color: '#cdd6f4', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '16px', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, color: '#f5c2e7' }}>Next-Step Generator</h2>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        {!recommendations ? (
                            <div className="modal-controls">
                                <p style={{ color: '#a6adc8', marginBottom: '20px' }}>Our backend will automatically analyze your last 10 modules, knowledge summary, and goals.</p>
                                
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#89b4fa' }}>Select AI Engine:</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button 
                                            style={{ flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: useDeepseek ? '2px solid #a6e3a1' : '1px solid #555', background: useDeepseek ? '#a6e3a1' : '#313244', color: useDeepseek ? '#1e1e2e' : '#cdd6f4', fontWeight: useDeepseek ? 'bold' : 'normal' }}
                                            onClick={() => setUseDeepseek(true)}
                                        >
                                            DeepSeek (Simulated)
                                        </button>
                                        <button 
                                            style={{ flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: !useDeepseek ? '2px solid #a6e3a1' : '1px solid #555', background: !useDeepseek ? '#a6e3a1' : '#313244', color: !useDeepseek ? '#1e1e2e' : '#cdd6f4', fontWeight: !useDeepseek ? 'bold' : 'normal' }}
                                            onClick={() => setUseDeepseek(false)}
                                        >
                                            Perplexity (Live Market Data)
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSimulate}
                                    disabled={isLoading}
                                    style={{ width: '100%', padding: '14px', background: '#89b4fa', color: '#1e1e2e', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
                                >
                                    {isLoading ? 'Researching Market Demands...' : 'Generate Suggestions'}
                                </button>
                                
                                {error && <p style={{ color: '#f38ba8', marginTop: '10px', textAlign: 'center' }}>⚠ {error}</p>}
                            </div>
                        ) : (
                            <div className="recommendations-container">
                                {recommendations.map((rec, index) => (
                                    <div key={index} style={{ background: '#181825', border: '1px solid #313244', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', background: rec.type.toLowerCase() === 'project' ? '#fab387' : '#89dceb', color: '#1e1e2e' }}>
                                                {rec.type}
                                            </span>
                                            <h3 style={{ margin: 0, color: '#89b4fa', fontSize: '1.2rem' }}>{rec.title}</h3>
                                        </div>
                                        <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '16px', color: '#cdd6f4' }}>{rec.description}</p>
                                        
                                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #444' }}>
                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#a6e3a1', textTransform: 'uppercase' }}>📈 Market Demand Facts</h4>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#bac2de', lineHeight: '1.4' }}>{rec.market_demand_facts}</p>
                                        </div>
                                        
                                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #444' }}>
                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#f9e2af', textTransform: 'uppercase' }}>🎯 Goal Alignment</h4>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#bac2de', lineHeight: '1.4' }}>{rec.goal_alignment}</p>
                                        </div>
                                    </div>
                                ))}
                                
                                <button 
                                    onClick={() => setRecommendations(null)}
                                    style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #cba6f7', color: '#cba6f7', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}
                                >
                                    Run Another Simulation
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
