import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import TextSelectionWrapper from './TextSelectionWrapper';

const ConfusionChat = ({ token }) => {
    const { nodeId } = useParams();
    const navigate = useNavigate();

    const [metadata, setMetadata] = useState(null);
    const [messages, setMessages] = useState([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [provider, setProvider] = useState('deepseek');
    const [debugMode, setDebugMode] = useState(false);
    const [title, setTitle] = useState('');
    const [isResolved, setIsResolved] = useState(false);
    
    const messagesEndRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Hydration
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        setMessages([]);
        setIsResolved(false);
        setMetadata(null);

        const loadData = async () => {
            try {
                // 1. Fetch Metadata
                const metaRes = await fetch(`/api/confusions/${nodeId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!metaRes.ok) throw new Error("Failed to load node metadata");
                const metaData = await metaRes.json();
                
                if (!isMounted) return;
                setMetadata(metaData);
                setTitle(metaData.title || '');
                if (metaData.status === 'resolved') setIsResolved(true);

                // 2. Fetch Chat History
                const chatRes = await fetch(`/api/confusions/${nodeId}/chat`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!chatRes.ok) throw new Error("Failed to load chat history");
                const history = await chatRes.json();
                
                if (!isMounted) return;
                if (history.length > 0) {
                    setMessages(history.map(msg => ({ role: msg.role, content: msg.content, id: msg.id })));
                    setIsLoading(false);
                } else {
                    // Trigger INIT
                    setIsLoading(false);
                    triggerInit();
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setIsLoading(false);
            }
        };

        const triggerInit = async () => {
            setIsStreaming(true);
            setMessages([{ role: 'assistant', content: '', id: Date.now() }]);
            
            try {
                const res = await fetch(`/api/confusions/${nodeId}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ content: 'INIT_CONFUSION_WELCOME', provider, debug_mode: debugMode })
                });
                
                if (!res.ok) throw new Error("Init failed");
                await consumeStream(res);
            } catch (e) {
                console.error(e);
            } finally {
                if (isMounted) setIsStreaming(false);
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [nodeId, token]); // Re-run when nodeId changes (e.g., navigating to nested side-quest)

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

                        if (jsonData.status === 'resolved') {
                            setIsResolved(true);
                            return;
                        }

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

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        const inputText = currentInput.trim();
        if (!inputText || isStreaming || isResolved) return;

        setMessages(prev => [...prev, { role: 'user', content: inputText, id: Date.now() }, { role: 'assistant', content: '', id: Date.now() + 1 }]);
        setCurrentInput('');
        setIsStreaming(true);

        try {
            const res = await fetch(`/api/confusions/${nodeId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ content: inputText, provider, debug_mode: debugMode })
            });

            if (!res.ok) throw new Error("Request failed");
            await consumeStream(res);
        } catch (error) {
            console.error(error);
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleReturn = () => {
        if (!metadata) return;
        if (metadata.parent_confusion_id) {
            navigate(`/confusion/${metadata.parent_confusion_id}`);
        } else {
            navigate(`/module/${metadata.root_module_id}/chat`);
        }
    };

    return (
        <div className="assessment-page">
            {/* ── Top Navbar ── */}
            <div className="assessment-navbar">
                <button
                    className="assessment-back-link"
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    ← Back
                </button>
                <h1 className="assessment-title">
                    {title ? `Side-Quest: ${title}` : 'Loading Side-Quest...'}
                </h1>

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
                        disabled={isLoading} 
                        rootModuleId={metadata?.root_module_id}
                        parentConfusionId={nodeId}
                        token={token}
                    >
                        <div className="chat-messages-area">

                        {isLoading ? (
                            <div className="empty-state">
                                <div className="path-spinner" style={{ margin: '0 auto' }} />
                                <p style={{ marginTop: '1rem' }}>Loading side-quest...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">❓</div>
                                <h3>Side-Quest</h3>
                                <p>Loading your clarification tutor...</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={msg.id || idx} data-message-id={msg.id} className={`message-row ${msg.role}`}>
                                    <div className="message-avatar">
                                        {msg.role === 'user' ? 'You' : 'AI'}
                                    </div>
                                    <div className="message-content">
                                        {msg.role === 'assistant' ? (
                                            <div className="message-markdown">
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
                                                        a: ({node, ...props}) => {
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
                                            <div className="message-text">{msg.content}</div>
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
                        {isResolved ? (
                            <button 
                                onClick={handleReturn}
                                style={{ width: '100%', padding: '16px', backgroundColor: '#89b4fa', color: '#1e1e2e', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                {metadata?.parent_confusion_id ? 'Return to Previous Topic' : 'Return to Main Lesson'}
                            </button>
                        ) : (
                            <form onSubmit={handleSend} className="chat-input-form">
                                <textarea
                                    value={currentInput}
                                    onChange={(e) => setCurrentInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        isStreaming
                                            ? 'Clarification Tutor is responding…'
                                            : 'Ask for clarification... (Enter to send, Shift+Enter for new line)'
                                    }
                                    disabled={isStreaming || isLoading}
                                    className="chat-input"
                                    rows={3}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={isStreaming || isLoading || !currentInput.trim()}
                                    className="send-btn"
                                >
                                    {isStreaming ? (
                                        <span className="spinner">⟳</span>
                                    ) : (
                                        <span>↑</span>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfusionChat;
