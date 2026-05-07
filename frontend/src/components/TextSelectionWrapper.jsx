import React, { useState, useEffect, useRef } from 'react';

/**
 * TextSelectionWrapper
 * Wraps a content area and monitors text selection.
 * When text is selected, shows a "Confused?" floating button.
 */
const TextSelectionWrapper = ({ children, disabled, rootModuleId, parentConfusionId, token, onConfusionStarted }) => {
    const [selectionData, setSelectionData] = useState(null);
    const [tooltipPos, setTooltipPos] = useState(null);
    const [showInput, setShowInput] = useState(false);
    const [question, setQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const wrapperRef = useRef(null);

    // Watch for selection changes to clear the popup when text is deselected
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            const currentText = selection.toString().trim();

            if (!currentText && !showInput) {
                setTooltipPos(null);
                setSelectionData(null);
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [showInput]);

    // Handle mouseup globally but filter for our wrapper
    useEffect(() => {
        const handleMouseUp = (e) => {
            // Check if click was inside our wrapper
            if (!wrapperRef.current || !wrapperRef.current.contains(e.target)) {
                return;
            }

            /* 
            if (disabled) {
                return;
            }
            */

            // Capture selection immediately before any state changes or timeouts
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (!selectedText) {
                return;
            }



            // Small delay for DOM rects to be stable
            setTimeout(() => {
                try {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    // Find the closest message container with an ID
                    let node = selection.anchorNode;
                    if (node.nodeType === 3) node = node.parentNode;

                    const messageElem = node.closest('[data-message-id]');
                    if (!messageElem) {
                        return;
                    }

                    const messageId = messageElem.getAttribute('data-message-id');

                    setSelectionData({
                        text: selectedText,
                        messageId: messageId
                    });

                    // IMPORTANT: Check coordinates
                    console.log('Selection Rect:', rect);

                    setTooltipPos({
                        top: rect.top - 55,
                        left: rect.left + (rect.width / 2)
                    });
                } catch (err) {
                    console.error(err);
                }
            }, 50);
        };

        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, [disabled]);

    const handleStartConfusion = async () => {
        if (!question.trim() || isLoading) return;
        setIsLoading(true);

        try {
            const response = await fetch('/api/confusions/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    root_module_id: rootModuleId,
                    parent_confusion_id: parentConfusionId || null,
                    message_id: selectionData.messageId,
                    highlighted_text: selectionData.text,
                    user_query: question
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to start side-quest");
            }

            const data = await response.json();

            // Reset state
            setTooltipPos(null);
            setSelectionData(null);
            setShowInput(false);
            setQuestion('');

            if (onConfusionStarted) {
                onConfusionStarted(data);
            } else {
                window.location.href = `/confusion/${data.id}`;
            }
        } catch (err) {
            console.error('Side-quest spawn error:', err);
            alert(`Error starting side-quest: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div ref={wrapperRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
            {children}

            {tooltipPos && (
                <div
                    style={{
                        position: 'fixed',
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        transform: 'translateX(-50%)',
                        zIndex: 99999,
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        padding: '6px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        animation: 'popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                >
                    {!showInput ? (
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setShowInput(true)}
                            style={{
                                backgroundColor: '#5A72F6',
                                color: '#ffffff',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '13px',
                                boxShadow: '0 4px 12px rgba(90, 114, 246, 0.2)'
                            }}
                        >
                            Confused?
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '2px 4px' }}>
                            <input
                                autoFocus
                                type="text"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleStartConfusion()}
                                placeholder="What's confusing?"
                                style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    outline: 'none',
                                    width: '160px'
                                }}
                            />
                            <button
                                onClick={handleStartConfusion}
                                disabled={!question.trim() || isLoading}
                                style={{
                                    backgroundColor: '#5A72F6',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    opacity: (!question.trim() || isLoading) ? 0.6 : 1
                                }}
                            >
                                {isLoading ? '...' : 'Ask'}
                            </button>
                            <button
                                onClick={() => { setShowInput(false); setTooltipPos(null); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes popIn {
                    from { transform: translateX(-50%) scale(0.9); opacity: 0; }
                    to { transform: translateX(-50%) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default TextSelectionWrapper;
