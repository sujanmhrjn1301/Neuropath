import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

const statusConfig = {
    unlocked: {
        className: 'module-unlocked',
        label: 'Start Module',
        icon: '▶',
    },
    locked: {
        className: 'module-locked',
        label: 'Locked',
        icon: '🔒',
    },
    completed: {
        className: 'module-completed',
        label: 'Completed',
        icon: '✓',
    },
};

const PathDetails = ({ token }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [path, setPath] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(`/api/learning-paths/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => {
                if (!r.ok) throw new Error('Path not found');
                return r.json();
            })
            .then((data) => setPath(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [id, token]);

    if (loading) {
        return (
            <div className="path-page">
                <div className="path-loading">
                    <div className="path-spinner" />
                    <p>Loading your learning path…</p>
                </div>
            </div>
        );
    }

    if (error || !path) {
        return (
            <div className="path-page">
                <div className="path-error">
                    <p>⚠ {error || 'Path not found.'}</p>
                    <Link to="/" className="assessment-back-link">← Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="path-page">
            {/* ── Header ── */}
            <div className="path-header">
                <Link to="/" className="assessment-back-link">← Dashboard</Link>
                <div className="path-header-content">
                    <h1 className="path-title">{path.user_request || 'Learning Path'}</h1>
                    <p className="path-subtitle">{path.overall_target}</p>
                </div>
            </div>

            {/* ── Timeline ── */}
            <div className="path-timeline-wrapper">
                <div className="path-timeline">
                    {path.modules.map((mod, idx) => {
                        const isProject = mod.module_type === 'project';
                        const cfg = statusConfig[mod.status] || statusConfig.locked;

                        return (
                            <div
                                key={mod.id}
                                className={`timeline-node ${cfg.className} ${isProject ? 'timeline-capstone' : ''}`}
                            >
                                {/* Connector line */}
                                {idx < path.modules.length - 1 && (
                                    <div className={`timeline-connector ${mod.status === 'completed' ? 'connector-done' : ''}`} />
                                )}

                                {/* Step badge */}
                                <div className="timeline-badge">
                                    {mod.status === 'completed' ? '✓' : isProject ? '🏆' : idx + 1}
                                </div>

                                {/* Card body */}
                                <div className="timeline-card">
                                    <div className="timeline-card-header">
                                        <span className="module-type-tag">
                                            {isProject ? '⭐ Capstone Project' : 'Lesson'}
                                        </span>
                                        <span className={`module-status-tag status-${mod.status}`}>
                                            {cfg.icon} {mod.status.charAt(0).toUpperCase() + mod.status.slice(1)}
                                        </span>
                                    </div>

                                    <h3 className="timeline-card-title">{mod.title}</h3>

                                    {mod.instructional_goal && (
                                        <p className="timeline-card-goal">{mod.instructional_goal}</p>
                                    )}

                                    {mod.end_condition && (
                                        <div className="timeline-end-condition">
                                            <span className="end-condition-label">Pass condition:</span>
                                            <span className="end-condition-text">{mod.end_condition}</span>
                                        </div>
                                    )}

                                    {mod.status === 'unlocked' && (
                                        <button
                                            className="start-module-btn"
                                            onClick={() => navigate(`/module/${mod.id}/chat`)}
                                        >
                                            {cfg.icon} {cfg.label}
                                        </button>
                                    )}

                                    {mod.status === 'completed' && (
                                        <button
                                            className="start-module-btn resume-module-btn"
                                            onClick={() => navigate(`/module/${mod.id}/chat`)}
                                        >
                                            📖 Review Session
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PathDetails;
