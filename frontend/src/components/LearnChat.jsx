import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const LearnChat = ({ token }) => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [provider, setProvider] = useState('deepseek');
    const [debugMode, setDebugMode] = useState(false);
    const [useOpenRouter, setUseOpenRouter] = useState(false);
    const [currentInput, setCurrentInput] = useState('');
    const [injectedDebugResponse, setInjectedDebugResponse] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();

        const isDebug = provider === 'debug';
        const inputText = currentInput.trim();

        if (!inputText && !isDebug) return;
        if (isDebug && !injectedDebugResponse.trim()) return;

        const newUserMsg = { role: 'user', content: inputText || '(debug inject)' };
        const newMessagesArray = [...messages, newUserMsg];
        setMessages(newMessagesArray);
        setCurrentInput('');
        setIsStreaming(true);

        // Add empty assistant bubble to stream into
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const payload = {
                messages: newMessagesArray,
                provider: provider,
                ...(isDebug && { injected_response: injectedDebugResponse }),
                debug_mode: debugMode,
                use_openrouter: useOpenRouter
            };

            const response = await fetch('/api/chat/generate-path', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                if (value) {
                    buffer += decoder.decode(value, { stream: true });

                    // Process all complete SSE events in the buffer
                    const parts = buffer.split('\n\n');
                    // Keep the last (potentially incomplete) part in the buffer
                    buffer = parts.pop();

                    for (const part of parts) {
                        if (!part.startsWith('data:')) continue;

                        const dataStr = part.replace(/^data:\s*/, '').trim();
                        if (!dataStr) continue;

                        try {
                            const jsonData = JSON.parse(dataStr);

                            if (jsonData.status === 'complete') {
                                handleCompletion();
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
                            console.error("Stream parse error:", e, "Raw string:", dataStr);
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
        } catch (error) {
            console.error('Chat stream error:', error);
            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                        ...last,
                        content: 'A connection error occurred. Please try again.'
                    };
                }
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    };

    const handleCompletion = () => {
        setIsStreaming(false);
        setToastMessage('Syllabus generated successfully!');
        setTimeout(() => {
            setMessages([]);
            navigate('/');
        }, 2000);
    };

    const handleKeyDown = (e) => {
        // Enter submits, Shift+Enter inserts a newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    const isDebug = provider === 'debug';

    return (
        <div className="assessment-page">
            {toastMessage && (
                <div className="toast-notification success">
                    ✓ {toastMessage}
                </div>
            )}

            {/* Top Navigation Bar */}
            <div className="assessment-navbar">
                <Link to="/" className="assessment-back-link">← NeuroPath</Link>
                <h1 className="assessment-title">Syllabus Builder</h1>

                <div className="openrouter-toggle-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
                    <label htmlFor="openrouter-toggle" style={{ fontSize: '0.85rem', color: '#cba6f7', fontWeight: 'bold', cursor: 'pointer' }}>
                        🌐 Live Market Research
                    </label>
                    <input
                        type="checkbox"
                        id="openrouter-toggle"
                        checked={useOpenRouter}
                        onChange={(e) => setUseOpenRouter(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                </div>

                <div className="debug-toggle-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', marginRight: '16px' }}>
                    <label htmlFor="syllabus-debug-toggle" style={{ fontSize: '0.85rem', color: '#ffb86c', fontWeight: 'bold' }}>
                        🛠 God Mode
                    </label>
                    <input 
                        type="checkbox" 
                        id="syllabus-debug-toggle" 
                        checked={debugMode} 
                        onChange={(e) => setDebugMode(e.target.checked)} 
                    />
                </div>

                <div className="provider-select-wrapper">
                    <label htmlFor="provider-select">AI Provider</label>
                    <select
                        id="provider-select"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="custom-select provider-select"
                    >
                        <option value="deepseek">DeepSeek</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="debug">Debug Mode</option>
                    </select>
                </div>
            </div>

            {/* Main Chat Layout */}
            <div className={`assessment-content ${isDebug ? 'debug-split' : ''}`}>

                {/* Chat Interface */}
                <div className="chat-interface">
                    <div className="chat-messages-area">
                        {messages.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">🚀</div>
                                <h3>What do you want to learn?</h3>
                                <p>Tell me your goal (e.g., 'I want to learn Python for Data Science'). I'll ask a few questions to gauge your level and build a custom syllabus.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`message-row ${msg.role}`}>
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
                                        ) : (
                                            <div className="message-text">{msg.content}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="chat-input-area">
                        <form onSubmit={handleSend} className="chat-input-form">
                            <textarea
                                value={currentInput}
                                onChange={(e) => setCurrentInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isStreaming ? 'AI is responding...' : 'Type your message... (Enter to send, Shift+Enter for new line)'}
                                disabled={isStreaming}
                                className="chat-input"
                                rows={3}
                                autoFocus
                            />
                            <button type="submit" disabled={isStreaming || (!currentInput.trim() && !isDebug)} className="send-btn">
                                {isStreaming ? (
                                    <span className="spinner">⟳</span>
                                ) : (
                                    <span>↑</span>
                                )}
                            </button>
                        </form>
                        <p className="chat-disclaimer">AI can make mistakes. The generated learning path will be saved to your profile.</p>
                    </div>
                </div>

                {/* Debug Injector Panel */}
                {isDebug && (
                    <div className="debug-injector-panel">
                        <div className="debug-panel-header">
                            <span className="debug-badge">DEBUG</span>
                            <h3>Injector Panel</h3>
                        </div>
                        <p className="debug-help">
                            Inject a simulated AI response. To trigger the completion event, inject the exact string:
                            <code> {`{"status": "complete", "message": "Syllabus generated successfully!"}`}</code>
                        </p>
                        <textarea
                            value={injectedDebugResponse}
                            onChange={(e) => setInjectedDebugResponse(e.target.value)}
                            placeholder="Type the mock AI response to inject..."
                            className="debug-textarea"
                        />
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={isStreaming || !injectedDebugResponse.trim()}
                            className="debug-inject-btn"
                        >
                            Inject Response
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LearnChat;
