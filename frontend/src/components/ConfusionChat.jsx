import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import TextSelectionWrapper from './TextSelectionWrapper';
import '../styles/confusion.css';

const ConfusionChat = forwardRef(({ token, nodeId, onBack, onResolved }, ref) => {
    const [metadata, setMetadata] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [provider, setProvider] = useState('deepseek');
    const [debugMode, setDebugMode] = useState(false);
    const [title, setTitle] = useState('');
    const [isResolved, setIsResolved] = useState(false);
    
    const messagesEndRef = useRef(null);

    // Notify parent when resolution status changes
    useEffect(() => {
        if (onResolved) onResolved(isResolved);
    }, [isResolved, onResolved]);

    // Expose handleSend to parent via ref
    useImperativeHandle(ref, () => ({
        handleExternalSend: (text) => {
            if (isResolved) return;
            handleSend(null, text);
        },
        isResolved
    }));

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    // Hydration
    useEffect(() => {
        let isMounted = true;
        if (!nodeId) return;

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
                
                if (history && history.length > 0) {
                    // We have history, just load it and stop
                    setMessages(history.map(msg => ({ 
                        role: msg.role, 
                        content: msg.content, 
                        id: msg.id 
                    })));
                    setIsLoading(false);
                } else {
                    // Brand new side-quest, trigger the welcome
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
    }, [nodeId, token]);

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
                            // Give user time to read the final message before auto-closing
                            setTimeout(() => {
                                if (onBack) onBack();
                            }, 2500);
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

    const handleSend = async (e, externalText = null) => {
        if (e) e.preventDefault();
        const inputText = (externalText !== null ? externalText : '').trim();
        if (!inputText || isStreaming || isResolved) return;

        setMessages(prev => [...prev, { role: 'user', content: inputText, id: Date.now() }, { role: 'assistant', content: '', id: Date.now() + 1 }]);
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

    return (
        <div className="confusion-container">
            {/* Header */}
            <div className="confusion-header">
                <button className="confusion-back-btn" onClick={onBack} title="Return to Lesson">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                <div className="confusion-title-area">
                    <div className="confusion-subtitle">Clarification Side-Quest</div>
                    <h2 className="confusion-title">{title || 'Loading Deep Dive...'}</h2>
                </div>
            </div>

            {/* Messages Area */}
            <div className="confusion-messages">
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                        <div className="spinner" style={{ marginBottom: '12px' }} />
                        <p>Opening side-quest portal...</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={msg.id || idx} className={`confusion-message-row ${msg.role}`}>
                            <div className={`confusion-avatar ${msg.role === 'user' ? 'user' : 'ai'}`}>
                                {msg.role === 'user' ? 'U' : 'AI'}
                            </div>
                            <div className="confusion-bubble">
                                <div className="confusion-markdown">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                        {msg.content.replace(/<br\s*\/?>/gi, '\n\n')}
                                    </ReactMarkdown>
                                    {isStreaming && idx === messages.length - 1 && msg.role === 'assistant' && !msg.content && (
                                        <div className="typing-dots">
                                            <div className="typing-dot" />
                                            <div className="typing-dot" />
                                            <div className="typing-dot" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
            {/* Input Area Removed - Using Dashboard Input */}
        </div>
    );
});

export default ConfusionChat;
