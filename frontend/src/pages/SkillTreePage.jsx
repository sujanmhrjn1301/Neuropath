import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PathGraph from '../components/PathGraph';

export default function SkillTreePage({ token }) {
    const { pathId } = useParams();
    const navigate = useNavigate();

    return (
        <div className="skill-tree-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
                <button 
                    onClick={() => navigate('/')}
                    style={{ background: '#313244', color: '#cdd6f4', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    ← Back to Dashboard
                </button>
                <h1 style={{ color: '#89b4fa', margin: 0 }}>Interactive Learning Map</h1>
            </div>
            
            <p style={{ color: '#a6adc8', marginBottom: '24px' }}>
                This is your personalized skill tree. Blue nodes are unlocked, green nodes are completed. Click on any unlocked module or purple side-quest to enter the AI Tutor chat.
            </p>

            {/* Render the Graph Component we built earlier */}
            <PathGraph pathId={pathId} token={token} />
        </div>
    );
}
