import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import TextSelectionWrapper from './TextSelectionWrapper';

const ModuleChat = ({ token }) => {
    const { moduleId } = useParams();
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [moduleInfo, setModuleInfo] = useState(null);
    const [currentInput, setCurrentInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [provider, setProvider] = useState('deepseek');
    const [debugMode, setDebugMode] = useState(false);
    const messagesEndRef = useRef(null);
    // Prevents React Strict Mode's double-invoke from firing two welcome streams
    const hasInitialized = useRef(false);

    // ── Scroll to bottom on new messages ─────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Hydrate chat history on mount ─────────────────────────────────────────
    useEffect(() => {
        // Reset the lock when moduleId changes so re-navigating to a fresh
        // module always triggers the welcome message for that new module.
        hasInitialized.current = false;

        const loadHistory = async () => {
            try {
                const historyRes = await fetch(`/api/modules/${moduleId}/chat`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!historyRes.ok) throw new Error('Failed to load chat history');
                const history = await historyRes.json();

                if (history.length > 0) {
                    // Resume: restore previous messages
                    setMessages(history.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        id: msg.id,
                    })));
                    setIsLoadingHistory(false);
                } else {
                    setIsLoadingHistory(false);
                    // ── Race-condition guard ───────────────────────────────────
                    // Set the ref synchronously BEFORE the async call so that
                    // React Strict Mode's second effect invocation sees it and bails.
                    if (!hasInitialized.current) {
                        hasInitialized.current = true;
                        triggerWelcomeMessage();
                    }
                }
            } catch (err) {
                console.error('History load error:', err);
                setIsLoadingHistory(false);
            }
        };

        loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduleId, token]);

    // ── Completion handler ────────────────────────────────────────────────────
    const handleCompletion = () => {
        setIsStreaming(false);
        setToastMessage('🎉 Module Completed! Your Knowledge Profile has been updated.');
        setTimeout(() => {
            navigate(-1);
        }, 2500);
    };

    // ── Shared SSE stream consumer ────────────────────────────────────────────
    // Reads a streaming fetch response and pipes JSON envelope chunks into the
    // last assistant bubble in state. Handles completion and error signals.
    const consumeStream = async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (value) {
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop();

                for (const part of parts) {
                    if (!part.startsWith('data:')) continue;
                    const dataStr = part.replace(/^data:\s*/, '').trim();
                    if (!dataStr) continue;

                    try {
                        const jsonData = JSON.parse(dataStr);

                        if (jsonData.status === 'complete') { handleCompletion(); return; }

                        if (jsonData.status === 'error') {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last && last.role === 'assistant') {
                                    updated[updated.length - 1] = { ...last, content: `⚠ Error: ${jsonData.message}` };
                                }
                                return updated;
                            });
                            return;
                        }

                        if (jsonData.text !== undefined) {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last && last.role === 'assistant') {
                                    updated[updated.length - 1] = { ...last, content: last.content + jsonData.text };
                                }
                                return updated;
                            });
                        }
                    } catch (e) {
                        if (!dataStr.startsWith('{')) {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last && last.role === 'assistant') {
                                    updated[updated.length - 1] = { ...last, content: last.content + dataStr };
                                }
                                return updated;
                            });
                        }
                    }
                }
            }
        }
    };

    // ── Auto-welcome trigger ──────────────────────────────────────────────────
    // Posts a silent INIT_MODULE_WELCOME command so the AI introduces itself
    // without the user needing to type anything.
    const triggerWelcomeMessage = async () => {
        setIsStreaming(true);
        setMessages([{ role: 'assistant', content: '', id: Date.now() }]); // AI bubble only — no user row

        try {
            const response = await fetch(`/api/modules/${moduleId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ content: 'INIT_MODULE_WELCOME', provider, debug_mode: debugMode }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: 'Init failed' }));
                throw new Error(err.detail || `HTTP ${response.status}`);
            }

            await consumeStream(response);
        } catch (error) {
            console.error('Welcome init error:', error);
            setMessages([{
                role: 'assistant',
                content: '⚠ Could not start the tutor. Please refresh the page.',
            }]);
        } finally {
            setIsStreaming(false);
        }
    };

    // ── Send message ──────────────────────────────────────────────────────────
    const handleSend = async (e) => {
        if (e) e.preventDefault();
        const inputText = currentInput.trim();
        if (!inputText || isStreaming) return;

        setMessages(prev => [...prev, { role: 'user', content: inputText, id: Date.now() }, { role: 'assistant', content: '', id: Date.now() + 1 }]);
        setCurrentInput('');
        setIsStreaming(true);

        try {
            const response = await fetch(`/api/modules/${moduleId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ content: inputText, provider, debug_mode: debugMode }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: 'Request failed' }));
                throw new Error(err.detail || `HTTP ${response.status}`);
            }

            await consumeStream(response);
        } catch (error) {
            console.error('Module chat error:', error);
            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                        ...last,
                        content: `⚠ ${error.message || 'A connection error occurred. Please try again.'}`,
                    };
                }
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };



    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="assessment-page">
            {/* ── Toast notification ── */}
            {toastMessage && (
                <div className="toast-notification success module-completion-toast">
                    {toastMessage}
                </div>
            )}

            {/* ── Top Navbar ── */}
            <div className="assessment-navbar">
                <button
                    className="assessment-back-link"
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    ← Back
                </button>
                <h1 className="assessment-title">AI Tutor</h1>

                <div className="debug-toggle-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', marginRight: '16px' }}>
                    <label htmlFor="debug-mode-toggle" style={{ fontSize: '0.85rem', color: '#ffb86c', fontWeight: 'bold' }}>
                        🛠 God Mode
                    </label>
                    <input
                        type="checkbox"
                        id="debug-mode-toggle"
                        checked={debugMode}
                        onChange={(e) => setDebugMode(e.target.checked)}
                    />
                </div>

                <div className="provider-select-wrapper">
                    <label htmlFor="module-provider-select">AI Provider</label>
                    <select
                        id="module-provider-select"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="custom-select provider-select"
                    >
                        <option value="deepseek">DeepSeek</option>
                        <option value="openrouter">OpenRouter</option>
                    </select>
                </div>
            </div>

            {/* ── Chat Area ── */}
            <div className="assessment-content">
                <div className="chat-interface">
                    <TextSelectionWrapper
                        disabled={isLoadingHistory}
                        rootModuleId={moduleId}
                        parentConfusionId={null}
                        token={token}
                        onConfusionStarted={(nodeId) => navigate(`/confusion/${nodeId}`)}
                    >
                        <div className="chat-messages-area">

                            {isLoadingHistory ? (
                                <div className="empty-state">
                                    <div className="path-spinner" style={{ margin: '0 auto' }} />
                                    <p style={{ marginTop: '1rem' }}>Loading your session…</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🎓</div>
                                    <h3>Ready to Learn?</h3>
                                    <p>Send a message to your AI tutor to begin this module.</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} data-message-id={msg.id || idx} className={`message-row ${msg.role}`}>
                                        <div className="message-avatar">
                                            {msg.role === 'user' ? 'You' : 'AI'}
                                        </div>
                                        <div className="message-content">
                                            {msg.role === 'assistant' ? (
                                                <div className="message-markdown" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                        {msg.content.replace(/<br\s*\/?>/gi, '\n\n')}
                                                    </ReactMarkdown>
                                                    {isStreaming && idx === messages.length - 1 && (
                                                        <span className="typing-cursor">▋</span>
                                                    )}
                                                </div>
                                            ) : msg.role === 'system' ? (
                                                <div className="message-text system-message" style={{ fontStyle: 'italic', color: '#89b4fa', textAlign: 'center', width: '100%' }}>
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm, remarkBreaks]}
                                                        components={{
                                                            a: ({ node, ...props }) => {
                                                                if (props.href && props.href.startsWith('/confusion/')) {
                                                                    return (
                                                                        <Link
                                                                            to={props.href}
                                                                            className="side-quest-link"
                                                                            style={{ color: '#89b4fa', textDecoration: 'none', borderBottom: '1px dashed #89b4fa', fontWeight: 'bold', paddingBottom: '2px', transition: 'all 0.2s' }}
                                                                        >
                                                                            {props.children}
                                                                        </Link>
                                                                    );
                                                                }
                                                                return <a target="_blank" rel="noopener noreferrer" style={{ color: '#a6e3a1' }} {...props} />;
                                                            }
                                                        }}
                                                    >
                                                        {msg.content.replace(/<br\s*\/?>/gi, '\n\n')}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="message-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{msg.content}</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </TextSelectionWrapper>

                    {/* ── Input Area ── */}
                    <div className="chat-input-area">
                        <form onSubmit={handleSend} className="chat-input-form">
                            <textarea
                                value={currentInput}
                                onChange={(e) => setCurrentInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    isStreaming
                                        ? 'AI Tutor is responding…'
                                        : 'Type your answer or question… (Enter to send, Shift+Enter for new line)'
                                }
                                disabled={isStreaming || isLoadingHistory}
                                className="chat-input"
                                rows={3}
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={isStreaming || isLoadingHistory || !currentInput.trim()}
                                className="send-btn"
                            >
                                {isStreaming ? (
                                    <span className="spinner">⟳</span>
                                ) : (
                                    <span>↑</span>
                                )}
                            </button>
                        </form>
                        <p className="chat-disclaimer">
                            Your tutor will track your progress and unlock the next module when you pass.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModuleChat;
